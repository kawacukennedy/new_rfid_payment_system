import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import apiRoutes from './http';
import { initWebSocket } from './websocket';
import { initPruningJob } from './jobs/prune';
import './mqtt'; // Initialize MQTT connection

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Main API Router
app.use('/', apiRoutes);

const server = createServer(app);

// Initialize WebSocket attached to HTTP server
initWebSocket(server);

// Initialize scheduled background jobs
initPruningJob();

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
