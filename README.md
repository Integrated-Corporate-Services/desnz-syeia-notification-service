# DESNZ SYEIA - Notify Callback Service

GOV.UK Notify delivery-callback receiver. Persists webhook events to Postgres (`notify_callback_event`).

## Run locally

```bash
npm ci
npm run dev
```

Required env (see also ECS task definition):

| Variable | Notes |
|----------|--------|
| `HOST` | **Required.** Use `0.0.0.0` for ALB/ECS; `localhost` for local-only bind. |
| `PORT` | Default `3002` |
| `DB_HOST`, `DB_NAME`, `DB_CREDENTIALS` | `DB_CREDENTIALS` must be JSON `{"username","password"}` |
| `NOTIFY_CALLBACK_BEARER_TOKEN` | Preferred direct bearer token (optional if secret name is set) |
| `NOTIFY_CALLBACK_SECRET_NAME` | **Required if bearer token unset.** Secrets Manager name/ARN, or raw token when ECS injects an SSM value |
| `AWS_REGION` | Default `eu-west-2` |

## Endpoints

- `GET /health` — liveness + DB check (ALB health check path)
- `POST /callbacks/notify/delivery` — GOV.UK Notify delivery callback (Bearer auth)
- `GET /callbacks/notify/health` — process liveness only

## Docker

```bash
docker build -t notify-service .
docker run --rm -p 3002:3002 -e HOST=0.0.0.0 ... notify-service
```
