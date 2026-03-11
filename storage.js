const STORAGE_TEXT_KEY = 'wpm_pwa_text';
const STORAGE_LAST_KEY = 'wpm_pwa_last';
const STORAGE_RECORDS_KEY = 'wpm_pwa_records';

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getCurrentText() {
  return localStorage.getItem(STORAGE_TEXT_KEY) || '';
}

function saveCurrentText(text) {
  localStorage.setItem(STORAGE_TEXT_KEY, text);
}

function getLastValue() {
  return localStorage.getItem(STORAGE_LAST_KEY) || '-';
}

function saveLastValue(value) {
  localStorage.setItem(STORAGE_LAST_KEY, value);
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_RECORDS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

function findRecordByText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return getRecords().find(r => r.normalizedText === normalized) || null;
}

function createRecord(text) {
  const record = {
    id: createId(),
    text,
    normalizedText: normalizeText(text),
    wordCount: countWords(text),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    results: []
  };
  const records = getRecords();
  records.unshift(record);
  saveRecords(records);
  return record;
}

function ensureRecordForText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const existing = findRecordByText(text);
  if (existing) return { record: existing, isNew: false };
  const created = createRecord(text);
  return { record: created, isNew: true };
}

function deleteRecordById(id) {
  const records = getRecords().filter(r => r.id !== id);
  saveRecords(records);
}

function addResultToRecord(recordId, result) {
  const records = getRecords();
  const idx = records.findIndex(r => r.id === recordId);
  if (idx === -1) return null;
  records[idx].results.push(result);
  records[idx].updatedAt = Date.now();
  records[idx].wordCount = countWords(records[idx].text);
  saveRecords(records);
  return records[idx];
}

function getLatestWpm(record) {
  if (!record.results.length) return '-';
  return record.results[record.results.length - 1].wpm.toFixed(1);
}

function getBestWpm(record) {
  if (!record.results.length) return '-';
  return Math.max(...record.results.map(r => r.wpm)).toFixed(1);
}
