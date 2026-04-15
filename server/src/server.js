process.stdout.write('[ZapFlow] Process starting...\n');

process.on('uncaughtException', (err) => {
        process.stdout.write('[ZapFlow] Uncaught exception: ' + err.message + '\n' + err.stack + '\n');
});

process.on('unhandledRejection', (reason) => {
        process.stdout.write('[ZapFlow] Unhandled rejection: ' + (reason?.message || String(reason)) + '\n');
});

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });

process.stdout.write('[ZapFlow] Loading app...\n');
const app = require('./app');

const PORT = process.env.PORT || 3001;
process.stdout.write('[ZapFlow] Binding to port ' + PORT + '...\n');

app.listen(PORT, () => {
        console.log('[ZapFlow] Server running on port ' + PORT);
        console.log('[ZapFlow] Env: ' + process.env.NODE_ENV);
});
