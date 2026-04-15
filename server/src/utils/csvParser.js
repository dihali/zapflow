const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

/**
 * Normaliza um array de objetos (de qualquer fonte) para o formato de contato.
 */
function normalizeRows(records) {
  return records
    .filter((r) => r.phone || r.telefone || r.numero || r.Phone || r.Telefone)
    .map((r) => ({
      name: r.name || r.nome || r.Name || r.Nome || 'Sem nome',
      phone: String(r.phone || r.telefone || r.numero || r.Phone || r.Telefone || '').replace(/\D/g, ''),
      tags: r.tags
        ? String(r.tags).split('|').map((t) => t.trim()).filter(Boolean)
        : [],
    }))
    .filter((r) => r.phone.length >= 10);
}

/**
 * Parseia CSV e retorna array de contatos.
 */
function parseContactsCsv(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return normalizeRows(records);
}

/**
 * Parseia Excel (.xlsx / .xls) e retorna array de contatos.
 * Aceita qualquer aba — usa a primeira.
 */
function parseContactsExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return normalizeRows(records);
}

module.exports = { parseContactsCsv, parseContactsExcel };
