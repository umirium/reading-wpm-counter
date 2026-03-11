const textEl = document.getElementById('text');
const wordsEl = document.getElementById('words');
const timeEl = document.getElementById('time');
const wpmEl = document.getElementById('wpm');
const lastEl = document.getElementById('last');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const savedListEl = document.getElementById('savedList');
const emptyStateEl = document.getElementById('emptyState');

let startTime = null;
let timerId = null;
let running = false;
let elapsedMs = 0;
let currentRecordId = null;

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function createPreview(text, max = 120) {
  const normalized = normalizeText(text);
  return normalized.length > max ? normalized.slice(0, max) + '…' : normalized;
}

function setStatus(mode, message = null) {
  if (message) {
    statusText.textContent = message;
  } else if (mode === 'running') {
    statusText.textContent = '計測中';
  } else if (mode === 'done') {
    statusText.textContent = '計測完了';
  } else {
    statusText.textContent = '待機中';
  }

  if (mode === 'running') {
    statusDot.classList.add('running');
  } else {
    statusDot.classList.remove('running');
  }
}

function updateWordCount() {
  const count = countWords(textEl.value);
  wordsEl.textContent = count;
  saveCurrentText(textEl.value);
  return count;
}

function updateDisplayFromElapsed(ms) {
  elapsedMs = ms;
  timeEl.textContent = formatElapsed(ms);
  const words = countWords(textEl.value);
  const minutes = ms / 60000;
  const wpm = minutes > 0 ? words / minutes : 0;
  wpmEl.textContent = wpm.toFixed(1);
}

function startTimer() {
  timerId = setInterval(() => {
    if (!running || startTime === null) return;
    updateDisplayFromElapsed(Date.now() - startTime);
  }, 200);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function renderSavedList() {
  const records = getRecords();
  savedListEl.innerHTML = '';
  if (!records.length) {
    emptyStateEl.style.display = 'block';
    return;
  }
  emptyStateEl.style.display = 'none';

  records.forEach(record => {
    const item = document.createElement('div');
    item.className = 'saved-item';

    const top = document.createElement('div');
    top.className = 'saved-top';

    const preview = document.createElement('div');
    preview.className = 'saved-preview';
    preview.textContent = createPreview(record.text);

    const date = document.createElement('div');
    date.className = 'saved-date';
    date.textContent = formatDate(record.updatedAt || record.createdAt);

    top.appendChild(preview);
    top.appendChild(date);

    const meta = document.createElement('div');
    meta.className = 'saved-meta';

    const metaItems = [
      ['単語数', String(record.wordCount ?? countWords(record.text))],
      ['最新WPM', getLatestWpm(record)],
      ['最高WPM', getBestWpm(record)],
      ['計測回数', String(record.results.length)]
    ];

    for (const [k, v] of metaItems) {
      const box = document.createElement('div');
      box.className = 'meta-box';
      box.innerHTML = `<div class="mk">${k}</div><div class="mv">${v}</div>`;
      meta.appendChild(box);
    }

    const actions = document.createElement('div');
    actions.className = 'saved-actions';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '読み込む';
    loadBtn.addEventListener('click', () => {
      textEl.value = record.text;
      currentRecordId = record.id;
      updateWordCount();
      updateDisplayFromElapsed(0);
      setStatus('idle', '保存済み英文を読み込みました');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'danger';
    deleteBtn.addEventListener('click', () => {
      deleteRecordById(record.id);
      if (currentRecordId === record.id) currentRecordId = null;
      renderSavedList();
      setStatus('idle', '英文を削除しました');
    });

    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(top);
    item.appendChild(meta);
    item.appendChild(actions);
    savedListEl.appendChild(item);
  });
}

function saveCurrentTextManually() {
  const rawText = textEl.value;
  const normalized = normalizeText(rawText);
  if (!normalized) {
    alert('先に英文を貼り付けてください。');
    return;
  }

  const existing = findRecordByText(rawText);
  if (existing) {
    currentRecordId = existing.id;
    setStatus('idle', 'この英文はすでに保存済みです');
    renderSavedList();
    return;
  }

  const record = createRecord(rawText);
  currentRecordId = record.id;
  renderSavedList();
  setStatus('idle', '英文を保存しました');
}

textEl.addEventListener('input', () => {
  updateWordCount();
  currentRecordId = null;
});

saveBtn.addEventListener('click', saveCurrentTextManually);

startBtn.addEventListener('click', () => {
  const words = updateWordCount();
  if (words === 0) {
    alert('先に英文を貼り付けてください。');
    return;
  }
  if (running) return;

  const result = ensureRecordForText(textEl.value);
  if (!result || !result.record) {
    alert('英文の保存に失敗しました。');
    return;
  }

  currentRecordId = result.record.id;
  startTime = Date.now();
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus('running', result.isNew ? '新規英文を保存して計測中' : '保存済み英文で計測中');
  updateDisplayFromElapsed(0);
  startTimer();
  renderSavedList();
});

stopBtn.addEventListener('click', () => {
  if (!running || startTime === null) {
    alert('先に開始ボタンを押してください。');
    return;
  }

  running = false;
  stopTimer();
  updateDisplayFromElapsed(Date.now() - startTime);

  if (!currentRecordId) {
    const ensured = ensureRecordForText(textEl.value);
    if (ensured?.record) currentRecordId = ensured.record.id;
  }

  const wpm = parseFloat(wpmEl.textContent);
  const result = {
    measuredAt: Date.now(),
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    wpm: Number.isFinite(wpm) ? wpm : 0
  };

  if (currentRecordId) addResultToRecord(currentRecordId, result);

  const lastValue = `${wpmEl.textContent} WPM`;
  lastEl.textContent = lastValue;
  saveLastValue(lastValue);

  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('done');
  renderSavedList();
});

resetBtn.addEventListener('click', () => {
  running = false;
  startTime = null;
  stopTimer();
  updateDisplayFromElapsed(0);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('idle');
});

function loadSaved() {
  textEl.value = getCurrentText();
  lastEl.textContent = getLastValue();
  updateWordCount();
  updateDisplayFromElapsed(0);
  renderSavedList();
  setStatus('idle');
}

loadSaved();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
