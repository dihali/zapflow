require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connection } = require('../services/queue.service');
const { pickVariation } = require('../utils/spinText');

const prisma = new PrismaClient();

const worker = new Worker(
  'messages',
  async (job) => {
    const { messageId, userId } = job.data;

    // Busca a mensagem com dados de contato e campanha
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        contact: true,
        campaign: true,
      },
    });

    if (!message) {
      throw new Error(`Mensagem ${messageId} não encontrada`);
    }

    if (message.status === 'SENT') {
      console.log(`[worker] Mensagem ${messageId} já foi enviada. Pulando.`);
      return;
    }

    // Busca credenciais do usuário (tenant)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.instanceName) {
      throw new Error(`Usuário ${userId} sem instância WhatsApp configurada`);
    }

    // Spin text: pega uma variação aleatória
    const variations = message.campaign.variations;
    const content =
      variations.length > 0
        ? pickVariation(variations)
        : message.campaign.originalText;

    // Marca como QUEUED
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'QUEUED', content },
    });

    // Envia via servidor (HTTP) para usar a conexão Baileys já ativa
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1m' });
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3099}`;
    await axios.post(`${serverUrl}/api/whatsapp/send`, {
      phone: message.contact.phone,
      text: content,
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });

    // Marca como SENT
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    // Se todas as mensagens da campanha foram enviadas, atualiza status
    const pending = await prisma.message.count({
      where: {
        campaignId: message.campaignId,
        status: { in: ['PENDING', 'QUEUED'] },
      },
    });

    if (pending === 0) {
      await prisma.campaign.update({
        where: { id: message.campaignId },
        data: { status: 'COMPLETED' },
      });
    }

    console.log(`[worker] ✓ Enviado para ${message.contact.phone}`);
  },
  {
    connection,
    concurrency: 1, // processa 1 por vez para respeitar o delay anti-ban
  }
);

worker.on('failed', async (job, err) => {
  console.error(`[worker] ✗ Job ${job?.id} falhou:`, err.message);
  if (job?.data?.messageId) {
    await prisma.message
      .update({
        where: { id: job.data.messageId },
        data: { status: 'FAILED', error: err.message },
      })
      .catch(() => {});
  }
});

worker.on('ready', () => console.log('[worker] Message worker pronto'));

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
