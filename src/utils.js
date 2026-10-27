function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function tagsToString(tags) {
  return Array.isArray(tags) ? tags.join(',') : String(tags || '');
}

function overlapDates(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function destinationsOverlap(a, b) {
  const setA = new Set(
    String(a || '')
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const listB = String(b || '')
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return listB.some((d) => setA.has(d));
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(String(username || '').trim());
}

module.exports = {
  escapeHtml,
  parseTags,
  tagsToString,
  overlapDates,
  destinationsOverlap,
  validateEmail,
  validateUsername
};
