module.exports = {
    apps: [
        {
            name: 'rfid-backend',
            script: 'npm',
            args: 'start',
            instances: 'max', // Spawns an instance per CPU core
            exec_mode: 'cluster', // Enables built-in load balancer
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                RATE_LIMIT_MAX_REQUESTS: '100000',
                RATE_LIMIT_WINDOW_MS: '60000'
            }
        }
    ]
};
