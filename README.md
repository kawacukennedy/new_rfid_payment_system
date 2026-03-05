# RFID Wallet Transaction System: iOS 26 Edition

A futuristic, production-grade RFID-based wallet system. This project overhauls traditional transaction tracking with a bleeding-edge "iOS 26" aesthetic, secure authentication, and persistent digital receipts.

🚀 **Live Dashboard:** [http://157.173.101.159:8246](http://157.173.101.159:8246)

---

## ✨ Key Features

### 🎨 Futuristic iOS 26 UI
- **Glassmorphic Design:** Deep blurring, high-saturation accents, and floating depth layers.
- **Spring Animations:** Micro-interactions powered by CSS cubic-bezier springs for a premium feel.
- **Unified Portal:** Seamless transitions between authentication and the control center.

### 🔐 Secure Authentication & Authorization
- **JWT-Powered:** Secure session management via JSON Web Tokens.
- **Encryption:** Passwords hashed with `bcryptjs`.
- **Role Control:** Built-in support for `admin` and `staff` permissions.

### 🧾 Persistent Digital Receipts
- **Activity Feed:** A real-time transaction history on the dashboard.
- **View Past Receipts:** Every transaction generates a persistent digital receipt that can be retrieved and viewed anytime.

### 🛰️ Intelligent Firmware (ESP8266)
- **Zero-Config Hardware:** Auto-detects RFID reader pins (SS/RST) by scanning common SPI pairs.
- **Serial Receipts:** Digital receipts are formatted and printed to the serial console on every tap.

---

## 🛠️ Architecture Overview

The system consists of three main components:
1. **Frontend**: Vanilla JS + Tailwind CSS. Real-time updates via WebSockets.
2. **Backend**: Node.js v22 (LTS) / Express. Uses SQLite (WAL mode) for mission-critical persistence.
3. **Hardware**: ESP8266 communicating via MQTT (broker.benax.rw).

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js**: v22.14.0 or higher
- **MQTT Broker**: `broker.benax.rw` (Port 1883)
- **Hardware**: ESP8266 + MFRC522 RFID Reader

### Installation
1.  **Clone & Install Backend:**
    ```bash
    cd backend
    npm install
    npm run build
    ```
2.  **Environment Variables:**
    Create a `.env` in `backend/`:
    ```env
    JWT_SECRET=your_secure_secret
    MQTT_BROKER=broker.benax.rw
    PORT=8246
    ```

### Running Locally
- **Backend:** `npm run dev` (Starts at `http://localhost:8246`)
- **Frontend:** Serve `frontend/index.html` via any local server (or open directly).
- **Mock ESP:** `node mock-esp8266.js` to simulate card taps.

### Flashing Firmware (ESP8266)
To upload the firmware to the physical ESP8266 hardware using PlatformIO, connect the device via USB and run:
```bash
cd esp8266
pio run --target upload --upload-port /dev/cu.usbserial-0001
```
*(Note: Replace `/dev/cu.usbserial-0001` with your actual serial port. If `pio` is not in your PATH, use its absolute path, e.g., `~/.platformio/penv/bin/pio` or `/Users/n3on/Library/Python/3.9/bin/pio`).*

---

## 🔌 API Endpoints (Protected)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Login and get JWT |
| `GET` | `/api/transactions` | Fetch latest 20 activity items |
| `POST` | `/api/topup` | Add credits to a card UID |
| `POST` | `/api/pay` | Purchase a product and generate receipt |
| `GET` | `/api/receipt/:id` | Retrieve a specific persistent receipt |

---

## 🛰️ MQTT Protocol
All topics are under `rfid/kawacukennedy/`:
- `/card/status`: (Device → Server) Card tap event.
- `/card/pay`: (Server → Device) Command to deduct/blink.
- `/card/topup`: (Server → Device) Command to update balance.

---

## 📦 Deployment
The system is deployed on a Linux VPS using **PM2** and **NVM**.
- **Process Management:** `pm2 restart rfid-backend`
- **Node Stack:** v22.22.0 Node / v10.9.4 NPM

---
**Maintained by:** kawacukennedy Team
**License:** MIT
