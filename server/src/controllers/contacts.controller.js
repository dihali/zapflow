const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { parseContactsCsv, parseContactsExcel } = require('../utils/csvParser');

const prisma = new PrismaClient();

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  tags: z.array(z.string()).optional().default([]),
});

async function list(req, res, next) {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      userId: req.userId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ contacts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = contactSchema.parse(req.body);
    const phone = data.phone.replace(/\D/g, '');

    const contact = await prisma.contact.upsert({
      where: { userId_phone: { userId: req.userId, phone } },
      create: { ...data, phone, userId: req.userId },
      update: { name: data.name, tags: data.tags },
    });

    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
}

async function importCsv(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const mimetype = req.file.mimetype;
    const originalname = req.file.originalname.toLowerCase();
    const isExcel = originalname.endsWith('.xlsx') || originalname.endsWith('.xls') ||
      mimetype.includes('spreadsheet') || mimetype.includes('excel');

    const rows = isExcel
      ? parseContactsExcel(req.file.buffer)
      : parseContactsCsv(req.file.buffer);

    if (rows.length === 0) return res.status(400).json({ error: 'Planilha sem contatos válidos. Verifique se há coluna "phone" ou "telefone"' });

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const result = await prisma.contact.upsert({
        where: { userId_phone: { userId: req.userId, phone: row.phone } },
        create: { ...row, userId: req.userId },
        update: { name: row.name, tags: row.tags },
      });
      // Prisma upsert não indica se foi create ou update diretamente, mas podemos checar
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
    }

    res.json({ imported: rows.length, created, updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.contact.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function bulkDelete(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids deve ser um array' });

    const { count } = await prisma.contact.deleteMany({
      where: { id: { in: ids }, userId: req.userId },
    });

    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, importCsv, remove, bulkDelete };
