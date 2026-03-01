# RFID Wallet Transaction System

A production-grade RFID-based wallet system enabling top-up and payment operations with real-time dashboard updates.

## Architecture Overview

The system consists of three main components:
1. **Frontend (Dashboard)**: Built with vanilla JS and Tailwind CSS, following modern iOS 26 design guidelines. Connects to backend via HTTP and WebSocket.
2. **Backend**: Node.js/Express service. Uses SQLite (with WAL mode) for data persistence. Provides HTTP endpoints for transactions and a WebSocket server for real-time dashboard updates. Acts as an MQTT client to bridge hardware and software.
3. **Hardware (ESP8266)**: Edge controller reading RFID cards. Communicates *exclusively* via MQTT.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (for `better-sqlite3` build if required)
- MQTT Broker (Default: broker.hivemq.com)

### Installation
1. Clone the repository.
2. Go to `backend` directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. (Optional) Create a `.env` file via `cp .env.example .env` if custom broker credentials are required.

### Running the System
**Backend:**
```bash
npm run dev
```
Start the backend. It will listen on `http://localhost:3000`.

**Frontend:**
Open `frontend/index.html` in a web browser. Ensure the backend is running for WebSockets and APIs.

**Mock ESP8266 (Testing):**
```bash
node mock-esp.js
```
Use this script to simulate card taps directly from your terminal.

## API Endpoints

### `POST /topup`
Top-up an account.
- **Body**: `{ "uid": "CARD_UID", "amount": 1000 }`
- **Responses**: 
    - `202 Accepted`: `{ status: "processing", newBalance: 1500, transactionId: "1" }`
    - `400 Bad Request`: Invalid input

### `POST /pay`
Process a payment for a given product.
- **Body**: `{ "uid": "CARD_UID", "productId": 1, "quantity": 1 }`
- **Responses**:
    - `202 Accepted`: Payment successful.
    - `400 Bad Request`: Invalid input
    - `402 Payment Required`: Insufficient balance
    - `404 Not Found`: Card or product not found

### `GET /products`
Retrieve a list of available products.
- **Response**: `200 OK` Array of products `[ { id: 1, name: "Coffee", price: 250 } ]`

## MQTT Topics

All topics are isolated under `rfid/kawacukennedy`.
- `rfid/kawacukennedy/card/status` (ESP8266 → Backend): Sent when a card is tapped.
  - Payload: `{ "uid": "...", "balance": 100 }`
- `rfid/kawacukennedy/card/balance` (ESP8266 → Backend): Sent after ESP8266 applies a command locally.
- `rfid/kawacukennedy/card/topup` (Backend → ESP8266): Sent when top-up succeeds in DB.
  - Payload: `{ "uid": "...", "amount": 1000 }`
- `rfid/kawacukennedy/card/pay` (Backend → ESP8266): Sent when payment succeeds in DB.
  - Payload: `{ "uid": "...", "amount": 250 }`

## Database
Uses `better-sqlite3`. Contains 3 main tables:
- `cards`: Stores UID and balance.
- `products`: Catalog.
- `transactions`: Immutable transaction ledger for TOPUP and PAYMENT.

**Pruning:** A weekly background job deletes transaction logs older than 1 year to save space.

## Testing & Tooling
- **Lint/Format:** `npm run lint`, `npm run format`
- **Tests:** `npm run test` (executes Jest for DB unit tests and HTTP API integration tests).
