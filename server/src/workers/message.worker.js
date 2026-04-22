require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connection } = require('../services/queue.service');
const { pickVariation } = require('../utils/spinText');

const prisma = new PrismaClient();

const DAILY_LIMIT = 150;
const MAX_ERROR_RATE = 0.15;
const MIN_MESSAGES_TO_CHECK_RATE = 10;

function outsideBusinessHours() {
    const brtString = new Date().toLocaleString('en-US', {
          timeZone: 'America/Sao_Paulo',
          hour: 'numeric',
          weekday: 'short',
          hour12: false,
    });
    const parts = brtString.split(', ');
    const weekday = parts[0];
    const hour = parseInt(parts[1]);
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const isAfterHours = hour < 8 || hour >= 20;
    return isWeekend || isAfterHours;
}

async function countTodayMessages(userId) {
    const now = new Date();
    const todayBRT = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    todayBRT.setHours(0, 0, 0, 0);
    return prisma.message.count({
          where: { campaign: { userId }, status: 'SENT', sentAt: { gte: todayBRT } },
    });
}

async function checkAndAutoPause(campaignId) {
    const [total, failed] = await Promise.all([
          prisma.message.count({ where: { campaignId, status: { in: ['SENT', 'FAILED'] } } }),
          prisma.message.count({ where: { campaignId, status: 'FAILED' } }),
        ]);
    if (total < MIN_MESSAGES_TO_CHECK_RATE) return false;
    const errorRate = failed / total;
    if (errorRate > MAX_ERROR_RATE) {
          await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
          console.error(`[worker] Campanha ${campaignId} AUTO-PAUSADA: taxa de erro ${(errorRate*100).toFixed(1)}%`);
          return true;
    }
    return false;
}

const worker = new Worker(
    'messages',
    async (job) => {
          const { messageId, userId } = job.data;

      if (outsideBusinessHours()) {
              console.log('[worker] Fora do horario comercial. Retry em 30min.');
              throw new Error('OUTSIDE_BUSINESS_HOURS');
      }

      const message = await prisma.message.findUnique({
              where: { id: messageId },
              include: { contact: true, campaign: true },
      });

      if (!message) throw new Error(`Mensagem ${messageId} nao encontrada`);

      if (message.status === 'SENT') {
              console.log(`[worker] Mensagem ${messageId} ja enviada. Pulando.`);
              return;
      }

      if (message.campaign.status === 'PAUSED') {
              await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED', error: 'Campanha pausada' } });
              return;
      }

      const sentToday = await countTodayMessages(userId);
          if (sentToday >= DAILY_LIMIT) {
                  console.log(`[worker] Limite diario atingido (${sentToday}/${DAILY_LIMIT}).`);
                  throw new Error('DAILY_LIMIT_REACHED');
          }

      const user = await prisma.user.findUnique({ where: { id: userId } });
          if (!user?.instanceName) throw new Error(`Usuario ${userId} sem instancia WhatsApp`);

      cpaign.status === 'PAUSED') {
      await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED', error: 'Campanha pausada' } });
              return;
      }

      const sentToday = await countTodayMessages(userId);
          if (sentToday >= DAILY_LIMIT) {
                  console.log(`[worker] Limite diario atingido (${sentToday}/${DAILY_LIMIT}).`);
                  throw new Error('DAILY_LIMIT_REACHED');
          }

      const user = await prisma.user.findUnique({ where: { id: userId } });
          if (!user?.instanceName) throw new Error(`Usuario ${userId} sem instancia WhatsApp`);

      const variations = message.campaign.variations;
          const content = variations.length > 0 ? pickVariation(variations) : message.campaign.originalText;

      await prisma.message.update({ where: { id: messageId }, data: { status: 'QUEUED', content } });

      const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1m' });
          const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3099}`;
          await axios.post(
                  `${serverUrl}/api/whatsapp/send`,
            { phone: message.contact.phone, text: content },
            { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
                );

      await prisma.message.update({ where: { id: messageId }, data: { status: 'SENT', sentAt: new Date() } });

      const pending = await prisma.message.count({
              where: { campaignId: message.campaignId, status: { in: ['PENDING', 'QUEUED'] } },
      });

      if (pending === 0) {
              await prisma.campaign.update({ where: { id: message.campaignId }, data: { status: 'COMPLETED' } });
      }

      console.log(`[worker] Enviado para ${message.contact.phone} (${sentToday + 1}/${DAILY_LIMIT} hoje)`);
    },
  { connection, concurrency: 1 }
  );

worker.on('failed', async (job, err) => {
    if (err.message === 'OUTSIDE_BUSINESS_HOURS' || err.message === 'DAILY_LIMIT_REACHED') {
          console.log(`[worker] Job ${job?.id} aguardando: ${err.message}`);
          return;
    }
    console.error(`[worker] Job ${job?.id} falhou:`, err.message);
    if (job?.data?.messageId) {
          const updated = await prisma.message
            .update({ where: { id: job.data.messageId }, data: { status: 'FAILED', error: err.message } })
            .catch(() => null);
          if (updated?.campaignId) await checkAndAutoPause(updated.campaignId).catch(() => {});
    }
});

worker.on('ready', () => console.log('[worker] Message worker pronto'));

process.on('SIGTERM', async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
});
