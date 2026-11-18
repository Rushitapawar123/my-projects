const http = require('http');
const { Server } = require('socket.io');

const env = require('./config/env');
const { pool } = require('./config/db');
const app = require('./app');
const { startJobs } = require('./jobs/cleanup');

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.clientUrls, credentials: true },
});
app.set('io', io);
// Chat handlers will be registered in src/sockets/ in a later step.

server.listen(env.PORT, () => {
  console.log(`Pawar API running on port ${env.PORT} (${env.NODE_ENV})`);
  startJobs();
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
