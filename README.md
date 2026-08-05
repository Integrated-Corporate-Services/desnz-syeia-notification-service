# Notification Callback Service

A lightweight Node.js service for receiving and processing notification callbacks from GOV.UK Notify.

## Overview

This service receives webhook callbacks from GOV.UK Notify and processes notification delivery status updates.

## Features

- RESTful API for receiving notification callbacks
- Database persistence for notification status tracking
- Comprehensive error handling and logging

## Prerequisites

- Node.js >= 22.0.0
- PostgreSQL database

## Installation

```bash
npm install

# Build
npm run build

```bash
# Development
npm run dev


```

## Testing

```bash
# Run all tests
npm test

```

## API Endpoints

### POST /notify/delivery
Receives GOV.UK Notify webhook callbacks

### GET /health
Health check endpoint

## Project Structure

```
src/
├── controllers/ 
├── services/    
├── repositories/  
├── middlewares/  
├── validators/    
├── routes/        
├── database/      
├── config/         
└── types/        
```


## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Security

For security issues, please see [SECURITY.md](SECURITY.md).
