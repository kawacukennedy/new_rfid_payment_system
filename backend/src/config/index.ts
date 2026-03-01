export const config = {
    server: {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development'
    },
    mqtt: {
        url: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
        useTls: process.env.MQTT_USE_TLS === 'true',
        topicPrefix: 'rfid/kawacukennedy',
        reconnect: {
            maxDelay: 30000,
            maxAttempts: 10
        }
    },
    database: {
        path: process.env.DB_PATH || './data/wallet.db'
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },
    websocket: {
        heartbeatInterval: 30000
    }
};
