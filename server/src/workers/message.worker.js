const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connection } = require('../services/queue.service');
const { pickVariation } = require('../utils/spinText');

const prisma = new PrismaClient();

function startWorker() {
  const worker = new Worker(
    'messages',
    async (job) => {
      const { messageId, userId } = job.data;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { contact: true, campaign: true },
      });

      if (!message) throw new Error(`Mensagem ${messageId} não encontrada`);
      if (message.status === 'SENT') {
        console.log(`[worker] Mensagem ${messageId} já foi enviada. Pulando.`);
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.instanceName) {
        throw new Error(`Usuário ${userId} sem instância WhatsApp configurada`);
      }

      const variations = message.campaign.variations;
      const content = variations.length > 0
        ? pickVariation(variations)
        : message.campaign.originalText;

      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'QUEUED', content },
      });

      const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1m' });
      const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3099}`;
      await axios.post(`${serverUrl}/api/whatsapp/send`, {
        phone: message.contact.phone,
        text: content,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });

      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENT', sentAt: new Date() },
      });

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
      concurrency: 1,
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

  return worker;
}

module.exports = { startWorker };
