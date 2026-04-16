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

// Para e recria a sessão do zero (resolve travamento em STARTING)
async function forceRestartSession() {
  console.log('[waha] Forçando restart da sessão...');
  try { await waha.post(`/api/sessions/${SESSION}/stop`); } catch { /* ignora */ }
  await new Promise(r => setTimeout(r, 1500));
  try { await waha.delete(`/api/sessions/${SESSION}`); } catch { /* ignora */ }
  await new Promise(r => setTimeout(r, 1000));
  try { await waha.post('/api/sessions', { name: SESSION }); } catch { /* ignora */ }
  await new Promise(r => setTimeout(r, 1500));
  console.log('[waha] Sessão recriada.');
}

async function ensureStarted() {
  const status = await getSessionStatus();
  if (status === 'WORKING') return;
  if (status === 'NOT_FOUND' || status === 'STOPPED') {
    if (status === 'NOT_FOUND') {
      await waha.post('/api/sessions', { name: SESSION });
      await new Promise(r => setTimeout(r, 1000));
    }
    await waha.post(`/api/sessions/${SESSION}/start`).catch(() => {});
  }
  if (status === 'FAILED') {
    await forceRestartSession();
  }
}

async function connectInstance() {
  await ensureStarted();
}

async function extractQRFromScreenshot() {
  const Jimp   = require('jimp');
  const jsQR   = require('jsqr');
  const QRCode = require('qrcode');

  const { data: buf } = await waha.get(`/api/screenshot?session=${SESSION}`, { responseType: 'arraybuffer' });
  const image = await Jimp.read(Buffer.from(buf));
  const { data, width, height } = image.bitmap;

  const code = jsQR(new Uint8ClampedArray(data), width, height);
  if (!code) return null;

  // Gera QR limpo 400x400
  return await QRCode.toDataURL(code.data, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

async function getInstanceStatus() {
  const status = await getSessionStatus();
  if (status === 'WORKING') return { status: 'open', qr: null };
  if (status === 'SCAN_QR_CODE') {
    try {
      const qr = await extractQRFromScreenshot();
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
  // Aguarda até 30s para sair do STARTING
  for (let i = 0; i < 30; i++) {
    const result = await getInstanceStatus();
    if (result.status === 'open') return result;
    if (result.status === 'qr' && result.qr) return result;
    await new Promise(r => setTimeout(r, 1000));
  }
  return await getInstanceStatus();
}

// Reinicia sessão completamente — chamado pelo endpoint /restart
async function restartInstance() {
  await forceRestartSession();
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
  restartInstance,
  sendTextMessage,
  disconnectInstance,
};
