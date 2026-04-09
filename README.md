# Quattro Webhook

A simple Express.js webhook server for receiving and logging data payloads.

## Project Structure

```
quattro-webhook/
├── src/
│   ├── config/           # Configuration files
│   │   └── index.js
│   ├── controllers/      # Route controllers
│   │   └── webhookController.js
│   ├── middleware/       # Express middleware
│   │   └── errorHandler.js
│   └── routes/           # Route definitions
│       └── webhook.js
├── data/                 # Data storage
│   └── received_data.json
├── tests/                # Test files
├── server.js             # Application entry point
├── package.json
├── .env.example
└── .gitignore
```

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   ```

3. Start the server:
   ```bash
   # Production
   bun start
   
   # Development (with auto-reload)
   bun run dev
   ```

## API Endpoints

- `POST /api/webhook` - Receive webhook payloads
- `GET /health` - Health check endpoint

## Data Storage

Received payloads are stored in `data/received_data.json` with timestamps.
