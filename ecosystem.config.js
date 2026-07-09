/**
 * PM2 process configuration for VPS deployments (Linux/Windows).
 *
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs nexus-bot
 *   pm2 restart nexus-bot
 *
 * PM2 provides automatic restarts, log rotation and clustering if needed.
 */
module.exports = {
  apps: [
    {
      name: 'nexus-bot',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
