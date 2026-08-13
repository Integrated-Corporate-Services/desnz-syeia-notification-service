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
  private isRefreshing: boolean = false;

  /**
   * Build SSL configuration for AWS RDS
   */
  private buildSslConfig(): boolean | { require: boolean; rejectUnauthorized: boolean } {
    if (isLocal) return false;
    return {
      require: true,
      rejectUnauthorized: false,
    };
  }

  /**
   * Get current pool instance (creates if needed)
   */
  async getPool(): Promise<Pool> {
    if (!this.currentPool) {
      await this.initializePool();
    }
    return this.currentPool!;
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
      try {
        const parsed = JSON.parse(process.env.DB_CREDENTIALS);
        if (!parsed.username || !parsed.password) {
          throw new Error('DB_CREDENTIALS must contain username and password');
        }
        logger.info('[DBPoolManager] Loaded credentials from DB_CREDENTIALS');
        return parsed;
      } catch (error) {
        logger.error('[DBPoolManager] Failed to parse DB_CREDENTIALS', { error });
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
    return {
      host: (credentials as any).host || config.database.host,
      port: Number((credentials as any).port || config.database.port),
      database: (credentials as any).dbname || config.database.database,
      user: credentials.username,
      password: credentials.password,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
      ssl: this.buildSslConfig(),
      keepAlive: true,
      application_name: 'notify-service',
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

    this.currentPool.on('error', (err: any) => {
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
        
        if (process.env.DB_CREDENTIALS_SECRET_ARN) {
          logger.info('[DBPoolManager] Triggering automatic credential refresh');
          this.refreshCredentials().catch((refreshErr) => {
            logger.error('[DBPoolManager] Failed to refresh credentials', { error: refreshErr });
          });
        } else {
          logger.warn('[DBPoolManager] DB_CREDENTIALS_SECRET_ARN not configured - cannot auto-refresh');
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

    const secretArn = process.env.DB_CREDENTIALS_SECRET_ARN;
    if (!secretArn) {
      logger.warn('[DBPoolManager] Cannot refresh - DB_CREDENTIALS_SECRET_ARN not configured');
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

    logger.info('[DBPoolManager] Calling Secrets Manager', { secretArn });

    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret has no SecretString');
    }

    const parsed = JSON.parse(response.SecretString);
    
    if (!parsed.username || !parsed.password) {
      throw new Error('Secret must contain username and password fields');
    }

    logger.info('[DBPoolManager] Successfully fetched credentials from Secrets Manager', {
      hasUsername: !!parsed.username,
      hasPassword: !!parsed.password,
      hasHost: !!parsed.host,
    });

    return parsed;
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
