/**
 * Seleciona aleatoriamente uma das variações para cada envio individual.
 * @param {string[]} variations
 * @returns {string}
 */
function pickVariation(variations) {
  if (!variations || variations.length === 0) return '';
  return variations[Math.floor(Math.random() * variations.length)];
}

module.exports = { pickVariation };
