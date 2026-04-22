const axios = require('axios');

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_KEY = process.env.WAHA_API_KEY || 'zapflow123';

const waha = axios.create({
    baseURL: WAHA_URL,
    headers: { 'X-Api-Key': WAHA_KEY, 'Content-Type': 'application/json' },
    timeout: 20000,
});

async function getSessionStatus(session) {
    try {
          const { data } = await waha.get(`/api/sessions/${session}`);
          return data.status;
    } catch (e) {
          if (e.response?.status === 404) return 'NOT_FOUND';
          throw e;
    }
}

async function ensureStarted(session) {
    const status = await getSessionStatus(session);
    if (status === 'WORKING') return;
    if (status === 'NOT_FOUND') {
          await waha.post('/api/sessions', { name: session });
    }
    if (status === 'STOPPED' || status === 'FAILED' || status === 'NOT_FOUND') {
          await waha.post(`/api/sessions/${session}/start`);
    }
}

async function connectInstance(session) {
    await ensureStarted(session);
}

async function getInstanceStatus(session) {
    const status = await getSessionStatus(session);
    if (status === 'WORKING') return { status: 'open', qr: null };
    if (status === 'SCAN_QR_CODE') {
          try {
                  const { data } = await waha.get(`/api/screenshot?session=${session}`, { responseType: 'arraybuffer' });
                  const qr = 'data:image/png;base64,' + Buffer.from(data).toString('base64');
                  return { status: 'qr', qr };
          } catch {
                  return { status: 'qr', qr: null };
          }
    }
    if (status === 'STARTING') return { status: 'connecting', qr: null };
    return { status: 'disconnected', qr: null };
}

async function startAndGetQR(session) {
    await ensureStarted(session);
    for (let i = 0; i < 30; i++) {
          const result = await getInstanceStatus(session);
          if (result.status === 'open') return result;
          if (result.status === 'qr' && result.qr) return result;
          await new Promise(r => setTimeout(r, 1000));
    }
    return await getInstanceStatus(session);
}

async function sendTextMessage({ instanceName, phone, text }) {
    const session = instanceName;
    const number = phone.replace(/\D/g, '');
    const { data: check } = await waha.get(`/api/contacts/check-exists?phone=${number}&session=${session}`);
    if (!check.numberExists) {
          throw new Error(`Numero ${phone} nao encontrado no WhatsApp`);
    }
    const chatId = check.chatId;
    console.log(`[waha] Enviando para ${chatId} via sessao ${session}`);
    const { data } = await waha.post('/api/sendText', { session, chatId, text });
    console.log(`[waha] Resposta:`, JSON.stringify(data));
    return { success: true };
}

async function disconnectInstance(session) {
    try {
          await waha.post(`/api/sessions/${session}/stop`);
    } catch { /* ignora */ }
}

module.exports = {
    connectInstance,
    getInstanceStatus,
    startAndGetQR,
    sendTextMessage,
    disconnectInstance,
};
