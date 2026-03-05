import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import apiRoutes from './http';
import { initWebSocket } from './websocket';
import { initPruningJob } from './jobs/prune';
import './mqtt';
import { config } from './config';

import compression from 'compression';

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json());

// Security Headers & CSP
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' http://157.173.101.159:8246; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self' ws: wss: http://broker.benax.rw:1883 http://157.173.101.159:8246; " +
        "img-src 'self' data:;"
    );
    next();
});

// Serve frontend static files
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

app.use('/api', apiRoutes);

// Fallback to index.html for SPA behavior
app.get('*all', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
});

const server = createServer(app);

initWebSocket(server);

initPruningJob();

server.listen(config.server.port, () => {
    console.log(`Server running on http://localhost:${config.server.port}`);
});
