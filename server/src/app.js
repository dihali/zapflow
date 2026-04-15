require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const contactsRoutes = require('./routes/contacts.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const messagesRoutes = require('./routes/messages.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
