const Anthropic = require('@anthropic-ai/sdk');

/**
 * Gera 3–5 variações de uma mensagem para spin text anti-spam.
 * @param {string} originalText
 * @returns {Promise<string[]>}
 */
async function generateVariations(originalText) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Você é um especialista em copywriting para WhatsApp.
Dado o texto original abaixo, gere EXATAMENTE 5 variações que transmitem a mesma mensagem com palavras e estruturas diferentes.
Isso serve para evitar bloqueios por conteúdo repetitivo. Mantenha o mesmo tom e intent.

TEXTO ORIGINAL:
"""
${originalText}
"""

Responda APENAS com um JSON array de strings (sem explicações, sem markdown, sem numeração):
["variação1", "variação2", "variação3", "variação4", "variação5"]`,
      },
    ],
  });

  const raw = message.content[0].text.trim();

  // Extrai o array mesmo se vier com texto ao redor
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('IA não retornou um array JSON válido');

  const variations = JSON.parse(match[0]);
  if (!Array.isArray(variations) || variations.length === 0) {
    throw new Error('Array de variações inválido');
  }

  return variations;
}

module.exports = { generateVariations };
