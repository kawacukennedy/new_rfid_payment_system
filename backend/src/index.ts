import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import apiRoutes from './http';
import { initWebSocket } from './websocket';
import { initPruningJob } from './jobs/prune';
import './mqtt';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', apiRoutes);

const server = createServer(app);

initWebSocket(server);

initPruningJob();

server.listen(config.server.port, () => {
    console.log(`Server running on http://localhost:${config.server.port}`);
});
