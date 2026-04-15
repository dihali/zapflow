const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getByCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;
    const { status, page = 1, limit = 100 } = req.query;

    // Garante que a campanha pertence ao usuário
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: req.userId },
    });
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const where = {
      campaignId,
      ...(status && { status }),
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          contact: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.count({ where }),
    ]);

    // Agrega contadores por status
    const stats = await prisma.message.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const summary = { PENDING: 0, QUEUED: 0, SENT: 0, FAILED: 0 };
    stats.forEach((s) => { summary[s.status] = s._count.status; });

    res.json({ messages, total, summary, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const [totalContacts, totalCampaigns, totalMessages, sentMessages] = await Promise.all([
      prisma.contact.count({ where: { userId: req.userId } }),
      prisma.campaign.count({ where: { userId: req.userId } }),
      prisma.message.count({
        where: { campaign: { userId: req.userId } },
      }),
      prisma.message.count({
        where: { campaign: { userId: req.userId }, status: 'SENT' },
      }),
    ]);

    const recentCampaigns = await prisma.campaign.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { messages: true } } },
    });

    res.json({
      totalContacts,
      totalCampaigns,
      totalMessages,
      sentMessages,
      deliveryRate: totalMessages > 0 ? ((sentMessages / totalMessages) * 100).toFixed(1) : 0,
      recentCampaigns,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByCampaign, getDashboardStats };
