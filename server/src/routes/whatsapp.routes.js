const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const {
  connectInstance,
  getInstanceStatus,
  restartInstance,
  disconnectInstance,
} = require('../services/whatsapp.service');

const prisma = new PrismaClient();

async function getInstanceName(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { instanceName: true },
  });
  return user?.instanceName || null;
}

// POST /api/whatsapp/connect — inicia conexão em background
router.post('/connect', auth, async (req, res, next) => {
  try {
    const instanceName = await getInstanceName(req.userId);
    if (!instanceName) {
      return res.status(400).json({ error: 'Configure um instanceName no seu perfil primeiro.' });
    }
    connectInstance(instanceName).catch(console.error);
    res.json({ status: 'connecting' });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/restart — força restart da sessão WAHA
router.post('/restart', auth, async (req, res, next) => {
  try {
    restartInstance().catch(console.error);
    res.json({ status: 'restarting' });
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/status
router.get('/status', auth, async (req, res, next) => {
  try {
    const instanceName = await getInstanceName(req.userId);
    if (!instanceName) return res.json({ status: 'disconnected', qr: null });
    const result = await getInstanceStatus(instanceName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/send — uso interno pelo worker
router.post('/send', auth, async (req, res, next) => {
  try {
    const { phone, text } = req.body;
    const instanceName = await getInstanceName(req.userId);
    if (!instanceName) return res.status(400).json({ error: 'Sem instância configurada' });
    const { sendTextMessage } = require('../services/whatsapp.service');
    await sendTextMessage({ instanceName, phone, text });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/whatsapp/disconnect
router.delete('/disconnect', auth, async (req, res, next) => {
  try {
    const instanceName = await getInstanceName(req.userId);
    if (instanceName) await disconnectInstance(instanceName);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
