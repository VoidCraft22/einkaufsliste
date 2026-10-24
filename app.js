import { firebaseConfig } from './config.js';

const FB_VERSION = '10.12.2';
const $ = (s) => document.querySelector(s);

// ---------- Listen-Code (steht im Link hinter dem #) ----------
// Alle mit demselben Link sehen dieselbe Liste. Der Code ist lang und zufällig,
// damit niemand ihn erraten kann.
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
let code = location.hash.slice(1);
if (!/^[a-z0-9]{16,64}$/.test(code)) {
  code = localStorage.getItem('einkauf.code') || newCode();
  history.replaceState(null, '', '#' + code);
}
localStorage.setItem('einkauf.code', code);

// ---------- Name ----------
let me = localStorage.getItem('einkauf.name') || '';
function askName() {
  $('#nameInput').value = me;
  $('#nameDialog').showModal();
}
$('#nameForm').addEventListener('submit', () => {
  me = $('#nameInput').value.trim().slice(0, 20) || 'Jemand';
  localStorage.setItem('einkauf.name', me);
  $('#nameBtn').textContent = me;
});
$('#nameBtn').addEventListener('click', askName);
$('#nameBtn').textContent = me || 'unbekannt';
if (!me) askName();

// ---------- Speicher: Firebase (geteilt) oder lokal (Demo) ----------
function setStatus(text, cls) {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status ' + (cls || '');
}

async function firebaseStore() {
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
  const db_ = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);
  const app = initializeApp(firebaseConfig);
  const db = db_.getDatabase(app);
  const itemsRef = db_.ref(db, `lists/${code}/items`);

  db_.onValue(db_.ref(db, '.info/connected'), (s) =>
    s.val() ? setStatus('Live verbunden', 'online') : setStatus('Offline – Änderungen werden nachgeholt', 'offline'));

  return {
    subscribe: (cb) => db_.onValue(itemsRef, (snap) => cb(snap.val() || {}),
      (err) => setStatus('Fehler: ' + err.message, 'offline')),
    add: (item) => db_.set(db_.push(itemsRef), item),
    update: (id, patch) => db_.update(db_.child(itemsRef, id), patch),
    remove: (id) => db_.remove(db_.child(itemsRef, id)),
    restore: (id, item) => db_.set(db_.child(itemsRef, id), item),
  };
}

function localStore() {
  const key = 'einkauf.items.' + code;
  let listeners = [];
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  const write = (data) => { localStorage.setItem(key, JSON.stringify(data)); listeners.forEach((cb) => cb(data)); };
  window.addEventListener('storage', (e) => { if (e.key === key) listeners.forEach((cb) => cb(read())); });
  $('#demoBanner').hidden = false;
  setStatus('Nur auf diesem Gerät', '');
  return {
    subscribe: (cb) => { listeners.push(cb); cb(read()); },
    add: (item) => { const d = read(); d[Date.now().toString(36) + Math.random().toString(36).slice(2, 6)] = item; write(d); },
    update: (id, patch) => { const d = read(); if (d[id]) Object.assign(d[id], patch); write(d); },
    remove: (id) => { const d = read(); delete d[id]; write(d); },
    restore: (id, item) => { const d = read(); d[id] = item; write(d); },
  };
}

const configured = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL;
let store;
try {
  store = configured ? await firebaseStore() : localStore();
} catch (e) {
  console.error(e);
  store = localStore();
  setStatus('Firebase nicht erreichbar – lokaler Modus', 'offline');
}

// ---------- Anzeige ----------
let items = {};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const checkSvg = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function ago(ts) {
  if (!ts) return '';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

function row(id, it) {
  const meta = it.done
    ? `abgehakt von ${esc(it.doneBy || '?')} · ${ago(it.doneAt)}`
    : `${esc(it.by || '?')} · ${ago(it.createdAt)}`;
  return `<li class="item" data-id="${esc(id)}">
    <button class="check" data-act="toggle" aria-label="${it.done ? 'Wieder offen' : 'Abhaken'}">${checkSvg}</button>
    <div class="body" data-act="toggle">
      <div class="name">${esc(it.name)}${it.qty ? `<span class="qty-tag">${esc(it.qty)}</span>` : ''}</div>
      <div class="meta">${meta}</div>
    </div>
    <button class="del" data-act="del" aria-label="Löschen">×</button>
  </li>`;
}

function render() {
  const all = Object.entries(items);
  const open = all.filter(([, i]) => !i.done).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  const done = all.filter(([, i]) => i.done).sort((a, b) => (b[1].doneAt || 0) - (a[1].doneAt || 0));
  $('#openList').innerHTML = open.map(([id, i]) => row(id, i)).join('');
  $('#doneList').innerHTML = done.map(([id, i]) => row(id, i)).join('');
  $('#emptyMsg').hidden = open.length > 0;
  $('#doneSection').hidden = done.length === 0;
  $('#doneCount').textContent = `(${done.length})`;
  document.title = open.length ? `Einkaufsliste (${open.length})` : 'Einkaufsliste';
}

store.subscribe((data) => { items = data; render(); });
setInterval(render, 60000); // "vor x Min." aktuell halten

// ---------- Aktionen ----------
$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#itemInput').value.trim();
  if (!name) return;
  const qty = $('#qtyInput').value.trim();

  // Gleicher Artikel schon abgehakt? Dann einfach wieder öffnen statt doppelt anlegen.
  const existing = Object.entries(items).find(([, i]) => i.name.toLowerCase() === name.toLowerCase());
  if (existing && existing[1].done) {
    store.update(existing[0], { done: false, doneBy: null, doneAt: null, qty: qty || existing[1].qty || '', by: me, createdAt: Date.now() });
  } else if (existing) {
    toast(`„${name}" steht schon drauf`);
  } else {
    store.add({ name: name.slice(0, 80), qty: qty.slice(0, 20), by: me, createdAt: Date.now(), done: false });
  }
  $('#itemInput').value = '';
  $('#qtyInput').value = '';
  $('#itemInput').focus();
});

document.addEventListener('click', (e) => {
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;
  const id = actEl.closest('.item')?.dataset.id;
  const it = items[id];
  if (!it) return;
  if (actEl.dataset.act === 'toggle') {
    store.update(id, it.done
      ? { done: false, doneBy: null, doneAt: null }
      : { done: true, doneBy: me, doneAt: Date.now() });
    if (navigator.vibrate) navigator.vibrate(10);
  } else if (actEl.dataset.act === 'del') {
    store.remove(id);
    toast(`„${it.name}" gelöscht`, () => store.restore(id, it));
  }
});

$('#clearDoneBtn').addEventListener('click', () => {
  const done = Object.entries(items).filter(([, i]) => i.done);
  if (!done.length || !confirm(`${done.length} erledigte Einträge löschen?`)) return;
  done.forEach(([id]) => store.remove(id));
  toast(`${done.length} gelöscht`, () => done.forEach(([id, i]) => store.restore(id, i)));
});

$('#shareBtn').addEventListener('click', async () => {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: 'Unsere Einkaufsliste', url }); } catch { /* abgebrochen */ }
  } else {
    await navigator.clipboard.writeText(url);
    toast('Link kopiert – an die Familie schicken');
  }
});

// ---------- Toast mit Rückgängig ----------
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = esc(msg) + (undo ? ' <button>Rückgängig</button>' : '');
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
