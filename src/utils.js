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

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function isUniqueError(error) {
  return Boolean(
    error &&
      (error.code === '23505' ||
        error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        /unique/i.test(error.message || ''))
  );
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(String(username || '').trim());
}

const TRAVEL_REGIONS = [
  { id: 'europe', label: 'Europe', keywords: 'europe eu' },
  { id: 'mainland', label: 'Mainland', keywords: 'mainland china' },
  { id: 'hong-kong', label: 'Hong Kong', keywords: 'hong kong hk' },
  { id: 'japan-korea', label: 'Japan & Korea', keywords: 'japan korea' },
  { id: 'southeast-asia', label: 'Southeast Asia', keywords: 'southeast asia' },
  { id: 'americas', label: 'Americas', keywords: 'america usa canada' },
  { id: 'oceania', label: 'Oceania', keywords: 'oceania australia' },
  { id: 'paris', label: 'Paris', keywords: 'paris france europe' },
  { id: 'london', label: 'London', keywords: 'london uk england europe' },
  { id: 'rome', label: 'Rome', keywords: 'rome italy europe' },
  { id: 'barcelona', label: 'Barcelona', keywords: 'barcelona spain europe' },
  { id: 'lisbon', label: 'Lisbon', keywords: 'lisbon portugal europe' },
  { id: 'beijing', label: 'Beijing', keywords: 'beijing peking mainland china' },
  { id: 'shanghai', label: 'Shanghai', keywords: 'shanghai mainland china' },
  { id: 'guangzhou', label: 'Guangzhou', keywords: 'guangzhou canton mainland china' },
  { id: 'chengdu', label: 'Chengdu', keywords: 'chengdu mainland china' },
  { id: 'taipei', label: 'Taipei', keywords: 'taipei taiwan' },
  { id: 'tokyo', label: 'Tokyo', keywords: 'tokyo japan' },
  { id: 'osaka', label: 'Osaka', keywords: 'osaka japan' },
  { id: 'kyoto', label: 'Kyoto', keywords: 'kyoto japan' },
  { id: 'seoul', label: 'Seoul', keywords: 'seoul korea' },
  { id: 'singapore', label: 'Singapore', keywords: 'singapore southeast asia' },
  { id: 'bangkok', label: 'Bangkok', keywords: 'bangkok thailand southeast asia' },
  { id: 'bali', label: 'Bali', keywords: 'bali indonesia southeast asia' },
  { id: 'new-york', label: 'New York', keywords: 'new york nyc america' },
  { id: 'sydney', label: 'Sydney', keywords: 'sydney australia oceania' },
  { id: 'other', label: 'Other', keywords: 'other' }
];

function isTravelRegion(id) {
  return TRAVEL_REGIONS.some((region) => region.id === id);
}

function regionLabel(id) {
  const match = TRAVEL_REGIONS.find((region) => region.id === id);
  return match ? match.label : '';
}

function filterTravelLocations(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return TRAVEL_REGIONS.slice();
  return TRAVEL_REGIONS
    .map((location) => {
      const label = location.label.toLowerCase();
      const keywords = String(location.keywords || '').toLowerCase();
      let score = 0;
      if (label.startsWith(q)) score = 3;
      else if (label.includes(q)) score = 2;
      else if (keywords.includes(q)) score = 1;
      return score ? { location, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.location.label.localeCompare(b.location.label))
    .map((item) => item.location);
}

module.exports = {
  escapeHtml,
  parseTags,
  tagsToString,
  overlapDates,
  destinationsOverlap,
  validateEmail,
  validateUsername,
  asyncRoute,
  isUniqueError,
  TRAVEL_REGIONS,
  isTravelRegion,
  regionLabel,
  filterTravelLocations
};
