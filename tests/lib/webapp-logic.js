/**
 * Extracted business logic from webapp/index.html
 */

function formatCurrency(val) {
  return '€' + val.toFixed(2).replace('.', ',');
}

function calculateFooter(mengen, artikel) {
  let totalItems = 0;
  let totalPrice = 0;

  Object.entries(mengen).forEach(([id, qty]) => {
    const art = artikel.find(a => a.id == id);
    if (art && qty > 0) {
      totalItems += qty;
      totalPrice += qty * art.preis;
    }
  });

  return { totalItems, totalPrice };
}

function buildPositionen(mengen, artikel) {
  return Object.entries(mengen)
    .filter(([_, qty]) => qty > 0)
    .map(([id, menge]) => {
      const art = artikel.find(a => a.id == id);
      return {
        artikelId: parseInt(id),
        name: art.name,
        einheit: art.einheit,
        preis: art.preis,
        menge: menge,
        summe: +(menge * art.preis).toFixed(2)
      };
    });
}

function clampQty(value) {
  return Math.max(0, Math.min(99, parseInt(value) || 0));
}

function getButtonText(editToken, totalItems, isOffline) {
  if (isOffline) return totalItems > 0 ? 'Bestellung absenden' : 'Wähle Artikel aus';
  if (editToken) {
    return totalItems > 0 ? 'Bestellung aktualisieren' : 'Keine Artikel gewählt';
  }
  return totalItems > 0 ? 'Bestellung absenden' : 'Wähle Artikel aus';
}

function isButtonDisabled(totalItems, isOffline) {
  return totalItems === 0 || isOffline;
}

function extractCategories(artikel) {
  return [...new Set(artikel.map(a => a.kategorie))];
}

function filterArticles(artikel, searchTerm, activeCategory) {
  const search = (searchTerm || '').toLowerCase().trim();
  return artikel.filter(a => {
    const matchesCat = activeCategory === 'all' || a.kategorie === activeCategory;
    const matchesSearch = !search || a.name.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });
}

module.exports = {
  formatCurrency,
  calculateFooter,
  buildPositionen,
  clampQty,
  getButtonText,
  isButtonDisabled,
  extractCategories,
  filterArticles
};
