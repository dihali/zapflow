const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { generateVariations } = require('../services/ai.service');
const { enqueueCampaignMessages } = require('../services/queue.service');

const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string().min(1),
  originalText: z.string().min(5),
});

async function list(req, res, next) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        _count: { select: { messages: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);

    // Gera variações via IA
    const variations = await generateVariations(data.originalText);

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        originalText: data.originalText,
        variations,
        status: 'DRAFT',
        userId: req.userId,
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const { variations } = req.body;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Somente campanhas em DRAFT podem ser aprovadas' });
    }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        variations: variations || campaign.variations,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function launch(req, res, next) {
  try {
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um contato' });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (!['APPROVED', 'PAUSED'].includes(campaign.status)) {
      return res.status(400).json({ error: 'A campanha precisa estar APPROVED para ser disparada' });
    }

    // Valida que os contatos pertencem ao usuário
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, userId: req.userId },
      select: { id: true },
    });

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'Nenhum contato válido encontrado' });
    }

    // Cria registros de mensagem para cada contato
    const messages = await prisma.$transaction(
      contacts.map((c) =>
        prisma.message.create({
          data: {
            campaignId: campaign.id,
            contactId: c.id,
            content: '', // será preenchido pelo worker
            status: 'PENDING',
          },
        })
      )
    );

    // Enfileira tudo
    await enqueueCampaignMessages(
      messages.map((m) => ({ messageId: m.id, userId: req.userId }))
    );

    // Atualiza status da campanha
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING' },
    });

    res.json({ queued: messages.length });
  } catch (err) {
    next(err);
  }
}

async function pause(req, res, next) {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status !== 'RUNNING') {
      return res.status(400).json({ error: 'Somente campanhas RUNNING podem ser pausadas' });
    }

    await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' },
    });

    res.json({ status: 'PAUSED' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.campaign.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, approve, launch, pause, remove };
