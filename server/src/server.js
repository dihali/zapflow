process.on('uncaughtException', (err) => {
    console.error('[ZapFlow] Uncaught exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ZapFlow] Unhandled rejection:', reason?.message || reason);
});

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });
const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[ZapFlow] Server running on port ${PORT}`);
  console.log(`[ZapFlow] Env: ${process.env.NODE_ENV}`);
});
