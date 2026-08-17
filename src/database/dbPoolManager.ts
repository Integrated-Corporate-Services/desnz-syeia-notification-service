/**
 * Database Pool Manager with On-Demand Password Rotation
 * 
 * Supports two credential modes:
 * 1. DB_CREDENTIALS (ECS valueFrom) - Recommended for production
 *    - Initial credentials loaded from DB_CREDENTIALS (JSON injected by ECS)
 *    - On authentication failure, fetches fresh credentials from DB_CREDENTIALS_SECRET_ARN
 *    - No ECS restart required for password rotation
 * 
 * 2. Environment Variables - Fallback mode
 *    - Uses DB_HOST, DB_USER, DB_PASSWORD directly
 *    - No automatic password rotation support
 *    - Requires container restart for password changes
 * 
 * Environment Variables:
 * - DB_CREDENTIALS: JSON credentials injected by ECS (optional, recommended for rotation)
 * - DB_CREDENTIALS_SECRET_ARN: Secrets Manager ARN for fetching rotated passwords (required for rotation)
 * - DB_HOST, DB_PORT, DB_NAME: Database connection details
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import config from '../config/config';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

interface DbCredentials {
  username: string;
  password: string;
  host?: string;
  port?: number;
  dbname?: string;
  engine?: string;
}

const isLocal = (process.env.NODE_ENV || '').toLowerCase() === 'local';

class DatabasePoolManager {
  private currentPool: Pool | null = null;
  private currentCredentials: DbCredentials | null = null;
  private isRefreshing = false;

  /**
   * Build SSL configuration for AWS RDS
   * RDS uses AWS-managed certificates which may not be in default trust store
   * Set rejectUnauthorized: false to allow connections without cert validation
   */
  private buildSslConfig(): boolean | { require: boolean; rejectUnauthorized: boolean } {
    if (isLocal) return false;
    const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
    if (sslMode === 'disable') return false;
    
    return {
      require: true,
      rejectUnauthorized: false,
    };
  }

  /**
   * Check if error is an authentication failure
   */
  private isAuthenticationError(error: unknown): boolean {
    if (error instanceof Error) {
      const pgError = error as Error & { code?: string };
      return (
        pgError.code === '28P01' ||
        pgError.message?.toLowerCase().includes('password authentication failed')
      );
    }
    return false;
  }

  /**
   * Get current pool instance (creates if needed)
   * Returns a wrapped pool that handles authentication failures with automatic refresh
   */
  async getPool(): Promise<Pool> {
    if (!this.currentPool) {
      await this.initializePool();
    }
    if (!this.currentPool) {
      throw new Error('Failed to initialize database pool');
    }
    
    // Wrap the pool to intercept authentication failures
    return this.wrapPoolWithAutoRefresh(this.currentPool);
  }

  /**
   * Wrap pool to detect authentication failures and trigger automatic refresh with retry
   */
  private wrapPoolWithAutoRefresh(pool: Pool): Pool {
    const originalQuery = pool.query.bind(pool);
    const originalConnect = pool.connect.bind(pool);

    // Wrap query method
    (pool as any).query = async (...args: any[]): Promise<any> => {
      try {
        return await (originalQuery as any)(...args);
      } catch (error) {
        if (this.isAuthenticationError(error)) {
          logger.warn('[DBPoolManager] [query] Authentication error detected during query - attempting credential refresh');
          
          // Check if refresh is available
          const hasSecretArn = 
            process.env.DB_CREDENTIALS_SECRET_ARN || 
            process.env.DB_CREDENTIALS?.startsWith('arn:aws:secretsmanager:');
          
          if (hasSecretArn && !this.isRefreshing) {
            try {
              await this.refreshCredentials();
              logger.info('[DBPoolManager] [query] Retrying query after credential refresh');
              // Retry once with refreshed pool
              if (this.currentPool) {
                return await (this.currentPool.query as any)(...args);
              }
            } catch (refreshError) {
              logger.error('[DBPoolManager] [query] Credential refresh failed', { error: refreshError });
            }
          }
        }
        throw error;
      }
    };

    // Wrap connect method
    (pool as any).connect = async (...args: any[]): Promise<any> => {
      try {
        return await (originalConnect as any)(...args);
      } catch (error) {
        if (this.isAuthenticationError(error)) {
          logger.warn('[DBPoolManager] [connect] Authentication error detected during connect - attempting credential refresh');
          
          const hasSecretArn = 
            process.env.DB_CREDENTIALS_SECRET_ARN || 
            process.env.DB_CREDENTIALS?.startsWith('arn:aws:secretsmanager:');
          
          if (hasSecretArn && !this.isRefreshing) {
            try {
              await this.refreshCredentials();
              logger.info('[DBPoolManager] [connect] Retrying connect after credential refresh');
              // Retry once with refreshed pool
              if (this.currentPool) {
                return await (this.currentPool.connect as any)(...args);
              }
            } catch (refreshError) {
              logger.error('[DBPoolManager] [connect] Credential refresh failed', { error: refreshError });
            }
          }
        }
        throw error;
      }
    };

    return pool;
  }

  /**
   * Initialize database pool with credentials
   */
  private async initializePool(): Promise<void> {
    logger.info('[DBPoolManager] Initializing database connection pool');

    const credentials = await this.loadInitialCredentials();
    this.currentCredentials = credentials;

    const poolConfig = this.createPoolConfig(credentials);
    this.currentPool = new Pool(poolConfig);

    this.setupEventHandlers();

    logger.info('[DBPoolManager] Database pool initialized successfully', {
      host: poolConfig.host,
      database: poolConfig.database,
      credentialSource: process.env.DB_CREDENTIALS ? 'DB_CREDENTIALS' : 'environment',
      rotationEnabled: !!process.env.DB_CREDENTIALS_SECRET_ARN
    });
  }

  /**
   * Load initial credentials from DB_CREDENTIALS or environment
   */
  private async loadInitialCredentials(): Promise<DbCredentials> {
    if (process.env.DB_CREDENTIALS) {
      // Check if DB_CREDENTIALS is a Secrets Manager ARN
      if (process.env.DB_CREDENTIALS.startsWith('arn:aws:secretsmanager:')) {
        logger.info('[DBPoolManager] DB_CREDENTIALS is an ARN, fetching from Secrets Manager');
        return await this.fetchCredentialsFromSecretsManager(process.env.DB_CREDENTIALS);
      }
      
      // Otherwise treat as JSON
      try {
        const parsed = JSON.parse(process.env.DB_CREDENTIALS);
        if (!parsed.username || !parsed.password) {
          throw new Error('DB_CREDENTIALS must contain username and password');
        }
        logger.info('[DBPoolManager] Loaded credentials from DB_CREDENTIALS (JSON)');
        return parsed;
      } catch (error) {
        if (error instanceof SyntaxError) {
          logger.error('[DBPoolManager] DB_CREDENTIALS is not valid JSON or ARN', { error });
        }
        throw error;
      }
    }

    // Fallback to config
    logger.info('[DBPoolManager] Using credentials from config');
    return {
      username: config.database.user,
      password: config.database.password,
    };
  }

  /**
   * Create pool configuration
   */
  private createPoolConfig(credentials: DbCredentials): PoolConfig {
    const appName = process.env.DB_APPLICATION_NAME || 'notify-service';
    
    return {
      host: credentials.host || config.database.host,
      port: Number(credentials.port || config.database.port),
      database: credentials.dbname || config.database.database,
      user: credentials.username,
      password: credentials.password,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
      ssl: this.buildSslConfig(),
      keepAlive: true,
      application_name: appName,
    };
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    if (!this.currentPool) return;

    this.currentPool.on('connect', () => {
      logger.debug('[DBPoolManager] New connection established');
    });

    this.currentPool.on('error', (err: Error & { code?: string }) => {
      logger.error('[DBPoolManager] Pool error', {
        code: err.code,
        message: err.message,
      });

      // Detect authentication failures (password rotation)
      if (
        err.code === '28P01' ||
        err.message?.toLowerCase().includes('password authentication failed')
      ) {
        logger.warn('[DBPoolManager] Authentication error detected - password may have been rotated');
        
        // Check if we have a Secrets Manager ARN available for refresh
        const hasSecretArn = 
          process.env.DB_CREDENTIALS_SECRET_ARN || 
          process.env.DB_CREDENTIALS?.startsWith('arn:aws:secretsmanager:');
        
        if (hasSecretArn) {
          logger.info('[DBPoolManager] Triggering automatic credential refresh');
          this.refreshCredentials().catch((refreshErr) => {
            logger.error('[DBPoolManager] Failed to refresh credentials', { error: refreshErr });
          });
        } else {
          logger.warn('[DBPoolManager] No Secrets Manager ARN configured - cannot auto-refresh');
          logger.warn('[DBPoolManager] ECS restart required to pick up new password');
        }
      }
    });
  }

  /**
   * Fetch fresh credentials from Secrets Manager and recreate pool
   */
  async refreshCredentials(): Promise<void> {
    if (this.isRefreshing) {
      logger.debug('[DBPoolManager] Credential refresh already in progress');
      return;
    }

    // Check DB_CREDENTIALS_SECRET_ARN first, then fall back to DB_CREDENTIALS if it's an ARN
    let secretArn = process.env.DB_CREDENTIALS_SECRET_ARN;
    if (!secretArn && process.env.DB_CREDENTIALS?.startsWith('arn:aws:secretsmanager:')) {
      secretArn = process.env.DB_CREDENTIALS;
      logger.info('[DBPoolManager] Using DB_CREDENTIALS as secret ARN for refresh');
    }
    
    if (!secretArn) {
      logger.warn('[DBPoolManager] Cannot refresh - no Secrets Manager ARN configured');
      return;
    }

    const refreshStartTime = Date.now();
    
    try {
      this.isRefreshing = true;
      logger.info('[DBPoolManager] CREDENTIAL REFRESH STARTED', {
        secretArnConfigured: true,
        timestamp: new Date().toISOString(),
      });

      // Fetch fresh credentials from Secrets Manager
      logger.info('[DBPoolManager] Fetching fresh credentials from Secrets Manager');
      const newCredentials = await this.fetchCredentialsFromSecretsManager(secretArn);

      // Check if credentials actually changed
      const credentialsChanged =
        this.currentCredentials?.username !== newCredentials.username ||
        this.currentCredentials?.password !== newCredentials.password;

      if (credentialsChanged) {
        logger.info('[DBPoolManager] Credentials changed - recreating pool', {
          usernameChanged: this.currentCredentials?.username !== newCredentials.username,
          passwordChanged: this.currentCredentials?.password !== newCredentials.password,
        });

        await this.recreatePool(newCredentials);

        const refreshDuration = Date.now() - refreshStartTime;
        logger.info('[DBPoolManager] CREDENTIAL REFRESH COMPLETED', {
          refreshDurationMs: refreshDuration,
        });
      } else {
        logger.info('[DBPoolManager] Credentials unchanged - pool error may be transient');
      }
    } catch (error) {
      const refreshDuration = Date.now() - refreshStartTime;
      logger.error('[DBPoolManager] CREDENTIAL REFRESH FAILED', {
        error,
        refreshDurationMs: refreshDuration,
      });
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Fetch credentials from AWS Secrets Manager
   */
  private async fetchCredentialsFromSecretsManager(secretArn: string): Promise<DbCredentials> {
    const region = process.env.AWS_REGION || 'eu-west-2';
    const client = new SecretsManagerClient({ region });

    try {
      logger.info('[DBPoolManager] Calling Secrets Manager', { secretArn });

      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await client.send(command);

      let secretString: string;
      
      // Support both SecretString and SecretBinary
      if (response.SecretString) {
        secretString = response.SecretString;
      } else if (response.SecretBinary) {
        // Decode binary secret to string
        const buffer = Buffer.from(response.SecretBinary);
        secretString = buffer.toString('utf-8');
      } else {
        throw new Error('Secret has neither SecretString nor SecretBinary');
      }

      const parsed = JSON.parse(secretString);
      
      if (!parsed.username || !parsed.password) {
        throw new Error('Secret must contain username and password fields');
      }

      logger.info('[DBPoolManager] Successfully fetched credentials from Secrets Manager', {
        hasUsername: !!parsed.username,
        hasPassword: !!parsed.password,
        hasHost: !!parsed.host,
      });

      return parsed;
    } finally {
      // Clean up client to prevent socket/file descriptor leaks
      client.destroy();
    }
  }

  /**
   * Recreate pool with new credentials
   */
  private async recreatePool(newCredentials: DbCredentials): Promise<void> {
    logger.info('[DBPoolManager] Recreating connection pool with new credentials');

    // Close existing pool
    if (this.currentPool) {
      logger.info('[DBPoolManager] Closing old connection pool');
      await this.currentPool.end();
      this.currentPool = null;
    }

    // Create new pool
    this.currentCredentials = newCredentials;
    const poolConfig = this.createPoolConfig(newCredentials);
    this.currentPool = new Pool(poolConfig);
    this.setupEventHandlers();

    logger.info('[DBPoolManager] New connection pool created successfully');
  }

  /**
   * Close database pool (graceful shutdown)
   */
  async closePool(): Promise<void> {
    if (this.currentPool) {
      logger.info('[DBPoolManager] Closing connection pool');
      await this.currentPool.end();
      this.currentPool = null;
      logger.info('[DBPoolManager] Connection pool closed');
    }
  }
}

// Singleton instance
const poolManager = new DatabasePoolManager();

export default poolManager;
