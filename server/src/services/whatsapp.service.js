const axios = require('axios');

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_KEY = process.env.WAHA_API_KEY || 'zapflow123';
const SESSION   = 'default';

const waha = axios.create({
  baseURL: WAHA_URL,
  headers: { 'X-Api-Key': WAHA_KEY, 'Content-Type': 'application/json' },
  timeout: 20000,
});

async function getSessionStatus() {
  try {
    const { data } = await waha.get(`/api/sessions/${SESSION}`);
    return data.status; // STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
  } catch (e) {
    if (e.response?.status === 404) return 'NOT_FOUND';
    throw e;
  }
}

async function ensureStarted() {
  const status = await getSessionStatus();
  if (status === 'WORKING') return;
  if (status === 'NOT_FOUND') {
    await waha.post('/api/sessions', { name: SESSION });
  }
  if (status === 'STOPPED' || status === 'FAILED' || status === 'NOT_FOUND') {
    await waha.post(`/api/sessions/${SESSION}/start`);
  }
}

async function connectInstance() {
  await ensureStarted();
}

async function getInstanceStatus() {
  const status = await getSessionStatus();
  if (status === 'WORKING') return { status: 'open', qr: null };
  if (status === 'SCAN_QR_CODE') {
    try {
      const { data } = await waha.get(`/api/screenshot?session=${SESSION}`, { responseType: 'arraybuffer' });
      const qr = 'data:image/png;base64,' + Buffer.from(data).toString('base64');
      return { status: 'qr', qr };
    } catch {
      return { status: 'qr', qr: null };
    }
  }
  if (status === 'STARTING') return { status: 'connecting', qr: null };
  return { status: 'disconnected', qr: null };
}

async function startAndGetQR() {
  await ensureStarted();
  for (let i = 0; i < 30; i++) {
    const result = await getInstanceStatus();
    if (result.status === 'open') return result;
    if (result.status === 'qr' && result.qr) return result;
    await new Promise(r => setTimeout(r, 1000));
  }
  return await getInstanceStatus();
}

async function sendTextMessage({ phone, text }) {
  const number = phone.replace(/\D/g, '');

  // Verifica o chatId correto no WhatsApp (resolve formato 8 vs 9 dígitos)
  const { data: check } = await waha.get(`/api/contacts/check-exists?phone=${number}&session=${SESSION}`);
  if (!check.numberExists) {
    throw new Error(`Número ${phone} não encontrado no WhatsApp`);
  }
  const chatId = check.chatId;

  console.log(`[waha] Enviando para ${chatId}`);
  const { data } = await waha.post('/api/sendText', {
    session: SESSION,
    chatId,
    text,
  });
  console.log(`[waha] Resposta:`, JSON.stringify(data));
  return { success: true };
}

async function disconnectInstance() {
  try {
    await waha.post(`/api/sessions/${SESSION}/stop`);
  } catch { /* ignora */ }
}

module.exports = {
  connectInstance,
  getInstanceStatus,
  startAndGetQR,
  sendTextMessage,
  disconnectInstance,
};
