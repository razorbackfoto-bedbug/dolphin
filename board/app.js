(() => {
'use strict';

/* =========================================================================
   Helpers
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORD = ['1st', '2nd', '3rd', '4th', 'last'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseDate = (iso) => { if (!iso) return null; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtLong = (iso) => { const d = parseDate(iso); return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
const fmtFull = (iso) => { const d = parseDate(iso); return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
const fmtShort = (iso) => { const d = parseDate(iso); return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
const monthOf = (iso) => { const d = parseDate(iso); return d ? MONTHS[d.getMonth()] : ''; };
const ordinalDay = (iso) => { const d = parseDate(iso); if (!d) return ''; const n = d.getDate(); const s = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return `${MONTHS[d.getMonth()]} ${n}${s}`; };
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
};
const fmtTimeShort = (t) => fmtTime(t).replace(':00 ', ' ').replace(/ (AM|PM)$/, (x) => x); // "5:30 PM"
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const joinNames = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.length === 2 ? `${arr[0]} and ${arr[1]}` : `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// nth weekday of a month (n: 0-3 = 1st..4th, 4 = last)
function nthWeekday(year, month, weekday, n) {
  if (n === 4) {
    const d = new Date(year, month + 1, 0);
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return d;
  }
  const d = new Date(year, month, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * n);
  return d;
}
function nextScheduled(afterISO) {
  const { week, weekday } = state.settings.schedule;
  const base = afterISO ? parseDate(afterISO) : new Date(new Date().setHours(0, 0, 0, 0) - 86400000);
  for (let i = 0; i < 14; i++) {
    const d = nthWeekday(base.getFullYear(), base.getMonth() + i, weekday, week);
    if (d > base) return toISO(d);
  }
  return toISO(new Date());
}

/* =========================================================================
   State
   ========================================================================= */
const KEY = 'fotmfl.v1';
const defaultSettings = () => ({
  orgName: 'Malvern-Hot Spring County Friends of the Library',
  bodyName: 'Executive Board',
  adjournBody: 'Executive Committee',
  defaultTime: '17:30',
  defaultLocation: '',
  schedule: { week: 2, weekday: 2 }, // 3rd Tuesday
  motionsPlacement: 'end',
  includeLogo: true,
  roster: [
    { id: uid(), name: '', role: 'President' },
    { id: uid(), name: '', role: 'Vice President' },
    { id: uid(), name: '', role: 'Secretary' },
    { id: uid(), name: '', role: 'Treasurer' },
  ],
});

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = Object.assign(defaultSettings(), s.settings || {});
      s.meetings = s.meetings || [];
      return s;
    }
  } catch (e) { /* storage unavailable */ }
  return { settings: defaultSettings(), meetings: [], currentId: null, tab: 'agenda', docMode: 'minutes' };
}
let state = loadState();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const m = cur();
  if (m) m.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
// Flush only pending edits, so an idle tab never overwrites newer data from another tab.
const flush = () => { if (saveTimer) saveNow(); };
window.addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue || saveTimer) return;
  const tab = state.tab, docMode = state.docMode, currentId = state.currentId;
  state = loadState();
  Object.assign(state, { tab, docMode, currentId });
  if (!modal.open && !document.activeElement?.matches('input, textarea, select')) render();
});

const cur = () => state.meetings.find((m) => m.id === state.currentId) || null;
const members = () => state.settings.roster.filter((r) => r.name.trim());
const roleOf = (name) => (state.settings.roster.find((r) => r.name === name) || {}).role || '';
const byRole = (re) => (members().find((r) => re.test(r.role)) || {}).name || '';
const allTopics = (m) => m.sections.flatMap((s) => s.topics);
const findTopic = (id) => { const m = cur(); return m && allTopics(m).find((t) => t.id === id); };
const findMotion = (id) => { const m = cur(); if (!m) return null; for (const t of allTopics(m)) { const mo = t.motions.find((x) => x.id === id); if (mo) return mo; } return null; };
const sortedMeetings = () => [...state.meetings].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const previousMeeting = (m) => sortedMeetings().find((x) => x.id !== m.id && (x.date || '') < (m.date || ''));
const present = (m) => members().filter((r) => m.attendance[r.name] !== 'absent').map((r) => r.name);
const absent = (m) => members().filter((r) => m.attendance[r.name] === 'absent').map((r) => r.name);

const newTopic = (title = '') => ({ id: uid(), title, notes: '', motions: [], deferred: false });
const newMotion = () => ({ id: uid(), action: '', mover: '', seconder: '', result: 'passed unanimously', vote: '' });

function createMeeting({ date, time, location, carry = [] }) {
  const prev = sortedMeetings().find((x) => (x.date || '') < date);
  const prevMonth = prev ? monthOf(prev.date) : MONTHS[(parseDate(date).getMonth() + 11) % 12];
  const m = {
    id: uid(), date, time, location,
    type: state.settings.bodyName,
    attendance: {},
    guests: '',
    calledBy: byRole(/^president/i) || byRole(/vice/i),
    calledAt: '',
    minutesApproval: { month: prevMonth, by: byRole(/secretary/i), method: 'circulated electronically', result: 'approved by unanimous vote' },
    financeApproval: { month: prevMonth, by: byRole(/treasurer/i), method: 'circulated electronically and read', result: 'approved by unanimous vote' },
    opening: '',
    sections: [
      { id: 'old', title: 'Old Business', topics: carry.map((t) => newTopic(t)) },
      { id: 'new', title: 'New Business', topics: [] },
      { id: 'ann', title: 'Announcements/Upcoming Dates', topics: [] },
    ],
    deferMotion: { mover: '', seconder: '', result: 'passed unanimously', vote: '' },
    adjournBy: '', adjournAt: '',
    nextMeeting: { date: nextScheduled(date), time: time, location: '' },
    transcript: [],
    created: Date.now(), updated: Date.now(),
  };
  if (!m.sections[0].topics.length) m.sections[0].topics.push(newTopic('Committee/Task Force Activity/Reports'));
  m.sections[1].topics.push(newTopic('Liaison to the Library Report'));
  state.meetings.push(m);
  state.currentId = m.id;
  state.tab = 'agenda';
  saveNow();
  return m;
}

/* =========================================================================
   Path binding (inputs write straight into state)
   ========================================================================= */
function resolve(path) {
  const parts = path.split('.');
  const head = parts.shift();
  let obj;
  if (head === 'm') obj = cur();
  else if (head === 's') obj = state.settings;
  else if (head === 't') obj = findTopic(parts.shift());
  else if (head === 'mo') obj = findMotion(parts.shift());
  else if (head === 'r') { const id = parts.shift(); obj = state.settings.roster.find((r) => r.id === id); }
  if (!obj) return null;
  const key = parts.pop();
  for (const p of parts) obj = obj[p];
  return { obj, key };
}
const getPath = (p) => { const r = resolve(p); return r ? r.obj[r.key] : ''; };
function setPath(p, v) { const r = resolve(p); if (r) { r.obj[r.key] = v; save(); } }

/* =========================================================================
   UI: toast, modal
   ========================================================================= */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
const modal = $('#modal');
function openModal(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
}
const closeModal = () => modal.open && modal.close();

/* =========================================================================
   Icons
   ========================================================================= */
const I = {
  mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gavel: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/></svg>',
  send: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  word: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13l1.5 5 2.5-5 2.5 5 1.5-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  print: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
  dl: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  rec: '<svg viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="17" height="17"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
};

/* =========================================================================
   Shared form bits
   ========================================================================= */
function personOptions(selected, { blank = 'Select…', includeGuests = false } = {}) {
  const m = cur();
  const pres = m ? present(m) : [];
  const names = members().map((r) => r.name);
  const ordered = [...pres, ...names.filter((n) => !pres.includes(n))];
  if (includeGuests && m) {
    m.guests.split('\n').map((g) => g.split(',')[0].trim()).filter(Boolean).forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
  }
  if (selected && !ordered.includes(selected)) ordered.unshift(selected);
  return `<option value="">${blank}</option>` +
    ordered.map((n) => `<option ${n === selected ? 'selected' : ''} value="${esc(n)}">${esc(n)}${roleOf(n) ? ' · ' + esc(roleOf(n)) : ''}</option>`).join('') +
    '<option value="__other">Someone else…</option>';
}
const sel = (path, opts) => `<select class="select" data-path="${path}" data-person>${personOptions(getPath(path), opts)}</select>`;
const options = (list, v) => list.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
const RESULTS = ['passed unanimously', 'passed', 'failed', 'was tabled', 'was withdrawn'];
const APPROVALS = ['approved by unanimous vote', 'approved as amended', 'approved by majority vote', 'not approved', 'tabled'];

/* =========================================================================
   Render: shell
   ========================================================================= */
function render() {
  renderSidebar();
  renderHead();
  const m = cur();
  $('#tabs').hidden = !m;
  $('#delMeetingBtn').hidden = !m;
  $$('#tabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
  const v = $('#view');
  if (!m) { v.innerHTML = renderEmpty(); return; }
  if (state.tab === 'agenda') v.innerHTML = renderAgenda(m);
  else if (state.tab === 'live') v.innerHTML = renderLive(m);
  else v.innerHTML = renderExport(m);
  $$('textarea', v).forEach(autosize);
  syncSpeechUI();
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; }

function renderSidebar() {
  const list = sortedMeetings();
  $('#meetingList').innerHTML = list.length ? list.map((m) => {
    const motions = allTopics(m).reduce((n, t) => n + t.motions.length, 0);
    return `<button class="m-link ${m.id === state.currentId ? 'active' : ''}" data-act="open" data-id="${m.id}">
      <span class="t">${esc(fmtLong(m.date) || 'Undated meeting')}</span>
      <span class="s">${esc(m.type)}${motions ? ` · ${motions} motion${motions > 1 ? 's' : ''}` : ''}</span>
    </button>`;
  }).join('') : '<div class="m-empty">No meetings yet.</div>';
}

function renderHead() {
  const m = cur();
  $('#meetingHead').innerHTML = m
    ? `<h1>${esc(m.type)} Meeting</h1><div class="sub">${esc([fmtShort(m.date), fmtTime(m.time), m.location].filter(Boolean).join(' · '))}</div>`
    : '<h1>Welcome</h1><div class="sub">Agendas, minutes and motions — minus the busywork.</div>';
}

function renderEmpty() {
  const needsRoster = !members().length;
  return `<div class="empty-state">
    <img src="assets/logo.png" alt="">
    <h2>Let’s make minutes painless.</h2>
    <p>Build the agenda, take notes live (by typing or talking), and walk out with an editable Word doc.</p>
    <div class="row" style="justify-content:center">
      ${needsRoster ? `<button class="btn btn-dark" data-act="settings">1. Add your board members</button>` : ''}
      <button class="btn btn-primary" data-act="new">${needsRoster ? '2. ' : ''}Create a meeting</button>
    </div>
  </div>`;
}

/* =========================================================================
   Render: Agenda tab
   ========================================================================= */
function renderAgenda(m) {
  const fixed = (label) => `<div class="agenda-item" style="opacity:.75"><span class="num">•</span><span class="grow" style="padding:6px 4px">${label}</span></div>`;
  const sec = (s) => `
    <div class="section-block">
      <div class="section-head"><h3>${esc(s.title)}</h3><span class="count">${s.topics.length || ''}</span><span class="spacer"></span></div>
      ${s.topics.map((t, i) => `
        <div class="agenda-item">
          <span class="num">${i + 1}</span>
          <input class="input grow" data-path="t.${t.id}.title" value="${esc(t.title)}" placeholder="Agenda item">
          <span class="tools">
            <button class="icon-btn" data-act="move" data-id="${t.id}" data-dir="-1" aria-label="Move up">${I.up}</button>
            <button class="icon-btn" data-act="move" data-id="${t.id}" data-dir="1" aria-label="Move down">${I.down}</button>
            <button class="icon-btn" data-act="del-topic" data-id="${t.id}" aria-label="Remove">${I.x}</button>
          </span>
        </div>`).join('')}
      <form class="add-row" data-add="${s.id}">
        <input class="input" name="title" placeholder="Add an item to ${esc(s.title)}…" autocomplete="off">
        <button class="btn" type="submit">${I.plus} Add</button>
      </form>
    </div>`;
  const prev = previousMeeting(m);
  return `
  <div class="card card-pad">
    <div class="card-title">Meeting details</div>
    <div class="grid g4">
      <label class="field"><span>Meeting</span><input class="input" data-path="m.type" data-head value="${esc(m.type)}"></label>
      <label class="field"><span>Date</span><input class="input" type="date" data-path="m.date" data-head value="${esc(m.date)}"></label>
      <label class="field"><span>Time</span><input class="input" type="time" data-path="m.time" data-head value="${esc(m.time)}"></label>
      <label class="field"><span>Location</span><input class="input" data-path="m.location" data-head value="${esc(m.location)}" placeholder="TBD"></label>
    </div>
  </div>
  <div class="card card-pad">
    <div class="card-title">Agenda <span class="spacer"></span>
      ${prev ? `<button class="btn btn-sm" data-act="carry">Pull items from ${esc(fmtLong(prev.date))}</button>` : ''}
    </div>
    <div class="section-block">
      <div class="section-head"><h3>Opening</h3></div>
      ${fixed('Call to order &amp; attendance')}
      ${fixed(`Approval of the ${esc(m.minutesApproval.month)} minutes`)}
      ${fixed(`${esc(m.financeApproval.month)} financial report`)}
    </div>
    ${m.sections.map(sec).join('')}
    <div class="section-block">
      <div class="section-head"><h3>Close</h3></div>
      ${fixed('Actions, discussion &amp; motions')}
      ${fixed('Adjournment')}
    </div>
  </div>
  <div class="row" style="margin-top:18px">
    <button class="btn btn-dark" data-act="dl-agenda">${I.word} Download agenda (.docx)</button>
    <button class="btn" data-act="preview-agenda">Preview agenda</button>
    <span class="grow"></span>
    <button class="btn btn-primary" data-act="tab" data-tab="live">Start taking minutes →</button>
  </div>`;
}

/* =========================================================================
   Render: Live minutes tab
   ========================================================================= */
let activeTopic = null;
function renderLive(m) {
  const roster = members();
  const chips = roster.length ? roster.map((r) => {
    const st = m.attendance[r.name] === 'absent' ? 'absent' : 'present';
    return `<button class="chip ${st}" data-act="att" data-name="${esc(r.name)}" aria-pressed="${st === 'present'}">
      <span class="dot">${st === 'present' ? '✓' : '✕'}</span>${esc(r.name)}${r.role ? `<span class="role">${esc(r.role)}</span>` : ''}
    </button>`;
  }).join('') : `<div class="hint">No board members yet. <button class="btn btn-sm" data-act="settings">Add your roster</button></div>`;

  const approval = (key, label, methods) => {
    const a = m[key];
    return `<div class="grid g2" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line-2)">
      <label class="field"><span>${label} — month</span><select class="select" data-path="m.${key}.month">${options(MONTHS, a.month)}</select></label>
      <label class="field"><span>Presented by</span>${sel(`m.${key}.by`)}</label>
      <label class="field"><span>How</span><select class="select" data-path="m.${key}.method">${options(methods, a.method)}</select></label>
      <label class="field"><span>Result</span><select class="select" data-path="m.${key}.result">${options(APPROVALS, a.result)}</select></label>
    </div>`;
  };

  const motionHTML = (mo) => `
    <div class="motion">
      <div class="motion-top">
        <span class="motion-label">Motion</span>
        <input class="input grow" data-path="mo.${mo.id}.action" value="${esc(mo.action)}" placeholder="to approve a $1,000 six-month CD">
        <button class="icon-btn" data-act="del-motion" data-id="${mo.id}" aria-label="Remove motion">${I.x}</button>
      </div>
      <div class="grid g2">
        <label class="field"><span>Moved by</span>${sel(`mo.${mo.id}.mover`)}</label>
        <label class="field"><span>Seconded by</span>${sel(`mo.${mo.id}.seconder`)}</label>
        <label class="field"><span>Result</span><select class="select" data-path="mo.${mo.id}.result">${options(RESULTS, mo.result)}</select></label>
        <label class="field"><span>Vote (optional)</span><input class="input" data-path="mo.${mo.id}.vote" value="${esc(mo.vote)}" placeholder="e.g. 5–1"></label>
      </div>
    </div>`;

  const topicHTML = (t) => `
    <article class="topic ${activeTopic === t.id ? 'active' : ''}" data-topic="${t.id}">
      <div class="topic-head">
        <input class="input bare grow" data-path="t.${t.id}.title" value="${esc(t.title)}" placeholder="Topic">
        ${t.deferred ? '<span class="badge info">Next meeting</span>' : ''}
        <button class="icon-btn" data-act="mic" data-id="${t.id}" aria-label="Dictate notes" title="Dictate into this topic">${I.mic}</button>
      </div>
      <div class="topic-body">
        <textarea class="textarea" data-path="t.${t.id}.notes" placeholder="One point per line. Start a line with “-” to indent it.">${esc(t.notes)}</textarea>
        <div class="interim" data-interim="${t.id}"></div>
        ${t.motions.map(motionHTML).join('')}
        <div class="topic-foot">
          <button class="btn btn-sm" data-act="add-motion" data-id="${t.id}">${I.gavel} Add motion</button>
          <label class="toggle"><input type="checkbox" data-path="t.${t.id}.deferred" data-rerender ${t.deferred ? 'checked' : ''}> Move to next meeting</label>
          <span class="grow"></span>
          <button class="btn btn-sm btn-ghost btn-danger" data-act="del-topic" data-id="${t.id}">${I.trash}</button>
        </div>
      </div>
    </article>`;

  const anyDeferred = allTopics(m).some((t) => t.deferred);
  const motions = allTopics(m).reduce((n, t) => n + t.motions.length, 0);

  return `<div class="live">
  <div>
    <div class="sec-label">Call to order</div>
    <div class="card card-pad">
      <div class="card-title">Attendance <span class="spacer"></span><span class="hint" style="text-transform:none;letter-spacing:0;font-weight:500">Tap to mark absent</span></div>
      <div class="chips">${chips}</div>
      <div class="grid g2" style="margin-top:16px">
        <label class="field"><span>Guest attendees (one per line: name, description)</span>
          <textarea class="textarea" data-path="m.guests" style="min-height:64px" placeholder="Drew Bradbury, representative from the Library">${esc(m.guests)}</textarea></label>
        <div class="grid" style="align-content:start">
          <label class="field"><span>Called to order by</span>${sel('m.calledBy')}</label>
          <label class="field"><span>At</span><div class="row"><input class="input grow" type="time" data-path="m.calledAt" value="${esc(m.calledAt)}"><button class="btn btn-sm" data-act="now" data-path="m.calledAt">${I.clock} Now</button></div></label>
        </div>
      </div>
      ${approval('minutesApproval', 'Minutes', ['circulated electronically', 'read', 'circulated electronically and read'])}
      ${approval('financeApproval', 'Financial report', ['circulated electronically and read', 'read', 'circulated electronically'])}
      <label class="field" style="margin-top:12px"><span>Other opening remarks (optional)</span>
        <input class="input" data-path="m.opening" value="${esc(m.opening)}" placeholder="The Board heard a word from our host, …"></label>
    </div>

    ${m.sections.map((s) => `
      <div class="sec-label">${esc(s.title)}</div>
      ${s.topics.map(topicHTML).join('')}
      <form class="add-row" data-add="${s.id}">
        <input class="input" name="title" placeholder="Add a topic to ${esc(s.title)}…" autocomplete="off">
        <button class="btn" type="submit">${I.plus} Add</button>
      </form>`).join('')}

    <div class="sec-label">Adjournment</div>
    <div class="card card-pad">
      ${anyDeferred ? `
        <div class="card-title">Motion to move items to next meeting</div>
        <div class="grid g2" style="margin-bottom:16px">
          <label class="field"><span>Moved by</span>${sel('m.deferMotion.mover')}</label>
          <label class="field"><span>Seconded by</span>${sel('m.deferMotion.seconder')}</label>
          <label class="field"><span>Result</span><select class="select" data-path="m.deferMotion.result">${options(RESULTS, m.deferMotion.result)}</select></label>
          <label class="field"><span>Vote (optional)</span><input class="input" data-path="m.deferMotion.vote" value="${esc(m.deferMotion.vote)}"></label>
        </div>` : ''}
      <div class="grid g2">
        <label class="field"><span>Adjourned on the motion of</span>${sel('m.adjournBy')}</label>
        <label class="field"><span>At</span><div class="row"><input class="input grow" type="time" data-path="m.adjournAt" value="${esc(m.adjournAt)}"><button class="btn btn-sm" data-act="now" data-path="m.adjournAt">${I.clock} Now</button></div></label>
      </div>
      <div class="card-title" style="margin-top:18px">Next meeting</div>
      <div class="grid g3">
        <label class="field"><span>Date</span><input class="input" type="date" data-path="m.nextMeeting.date" value="${esc(m.nextMeeting.date)}"></label>
        <label class="field"><span>Time</span><input class="input" type="time" data-path="m.nextMeeting.time" value="${esc(m.nextMeeting.time)}"></label>
        <label class="field"><span>Location</span><input class="input" data-path="m.nextMeeting.location" value="${esc(m.nextMeeting.location)}" placeholder="TBD"></label>
      </div>
    </div>
    <div class="row" style="margin-top:18px;justify-content:flex-end">
      <button class="btn btn-primary" data-act="tab" data-tab="export">Review &amp; export →</button>
    </div>
  </div>

  <aside class="live-side">
    <div class="card card-pad transcript">
      <div class="card-title">Record &amp; transcribe <span class="spacer"></span>
        ${m.transcript.length ? `<button class="btn btn-sm btn-ghost" data-act="tx-clear">Clear</button>` : ''}
      </div>
      <button class="btn btn-block ${rec.active ? 'rec-on' : 'btn-dark'}" data-act="rec" id="recBtn">
        ${rec.active ? I.stop + ' Stop recording' : I.rec + ' Record meeting'}
      </button>
      ${rec.url ? `<a class="btn btn-block btn-sm" style="margin-top:8px;text-decoration:none" href="${rec.url}" download="${esc(audioName())}">${I.dl} Download audio</a>` : ''}
      ${m.transcript.length || rec.active ? `<div class="transcript-list" id="txList" style="margin-top:12px">${renderTranscript(m)}</div>` : `<p class="hint" style="margin:10px 0 0">${SR
        ? 'Records audio and writes a live transcript here. Tap <b>→</b> on a line to drop it into the highlighted topic, or tap a topic’s mic to dictate straight into it.'
        : 'This browser can record audio but not transcribe it. For live transcription use Chrome, Edge or Safari.'}</p>`}
      <div class="interim" data-interim="__tx"></div>
    </div>
    <div class="card card-pad stats-card">
      <div class="grid g3 stats">
        <div class="stat"><b>${present(m).length}/${members().length}</b><span>Present</span></div>
        <div class="stat"><b>${allTopics(m).length}</b><span>Topics</span></div>
        <div class="stat"><b>${motions}</b><span>Motions</span></div>
      </div>
    </div>
  </aside>
  </div>`;
}

function renderTranscript(m) {
  if (!m.transcript.length) return '<div class="t-empty">Listening… speak naturally.</div>';
  return m.transcript.map((l) => `<div class="t-line" data-line="${l.id}">
    <time>${esc(l.at)}</time><span class="txt">${esc(l.text)}</span>
    <button class="icon-btn" data-act="tx-send" data-id="${l.id}" title="Add to highlighted topic" aria-label="Add to highlighted topic">${I.send}</button>
  </div>`).join('');
}

/* =========================================================================
   Document model → HTML / DOCX / plain text
   Blocks: {t:'title'|'h'|'sub'|'p'|'li'|'table', runs:[{text,b,i,ph}], lvl, rows}
   ========================================================================= */
const R = (text, o = {}) => ({ text, ...o });
const PH = (text) => ({ text, ph: true });
const val = (v, ph) => v ? R(v) : PH(ph);
const personRun = (name, ph = 'NAME') => val(name, ph);

function parseNotes(text) {
  return (text || '').split('\n').map((raw) => {
    if (!raw.trim()) return null;
    const indent = raw.match(/^(\s*)/)[1].replace(/\t/g, '    ').length;
    let line = raw.trim();
    let lvl = indent >= 4 ? 2 : indent >= 2 ? 1 : 0;
    const dash = line.match(/^(-{1,2}|[•●○◦*o])\s+/);
    if (dash) { lvl = Math.max(lvl, dash[1] === '--' ? 2 : 1); line = line.slice(dash[0].length); }
    return { lvl: Math.min(lvl, 2), text: line };
  }).filter(Boolean);
}

function motionRuns(mo) {
  const result = mo.vote && /passed|failed/.test(mo.result) ? `${mo.result.replace(' unanimously', '')} by a vote of ${mo.vote}` : mo.result;
  return [R('On motion by '), personRun(mo.mover), R(', seconded by '), personRun(mo.seconder), R(', '),
    mo.action ? R(`the motion ${/^to\b/i.test(mo.action) ? '' : 'to '}${mo.action.trim().replace(/\.$/, '')}`) : PH('ACTION'),
    R(` ${result}.`)];
}

function minutesBlocks(m) {
  const S = state.settings;
  const B = [];
  const pres = present(m), abs = absent(m);
  B.push({ t: 'title', runs: [R(`${m.type} Meeting Minutes`)] });
  B.push({ t: 'sub', runs: [R(S.orgName)] });
  B.push({ t: 'h', runs: [R('Meeting Details')] });
  B.push({ t: 'table', rows: [
    ['Date', [val(fmtFull(m.date), 'DATE')]],
    ['Time', [val(fmtTime(m.time), 'TIME')]],
    ['Location', [val(m.location, 'LOCATION')]],
    ['Attendees', [val(pres.join(', '), 'ATTENDEES')]],
  ] });
  B.push({ t: 'p', runs: [R('The meeting was called to order by: '), personRun(m.calledBy), R(roleOf(m.calledBy) ? `, ${roleOf(m.calledBy)}` : ''), R(m.calledAt ? `${roleOf(m.calledBy) ? ',' : ''} at ${fmtTime(m.calledAt)}.` : '.')] });
  if (abs.length) B.push({ t: 'p', runs: [R(`${joinNames(abs)} ${abs.length > 1 ? 'were' : 'was'} not in attendance.`)] });
  const guests = m.guests.split('\n').map((g) => g.trim()).filter(Boolean);
  if (guests.length) {
    B.push({ t: 'p', runs: [R('Guest attendees:')] });
    guests.forEach((g) => B.push({ t: 'li', lvl: 0, runs: [R(g)] }));
  }
  const appr = (a, lead, verb) => {
    const role = roleOf(a.by);
    return [R(`${lead} ${verb} ${a.method} by `), personRun(a.by), R(role ? `, ${role},` : ','), R(` and ${a.result}.`)];
  };
  B.push({ t: 'p', runs: appr(m.minutesApproval, `The minutes of the ${m.minutesApproval.month} meeting`, 'were') });
  B.push({ t: 'p', runs: appr(m.financeApproval, `The ${m.financeApproval.month} financial report`, 'was') });
  if (m.opening.trim()) B.push({ t: 'p', runs: [R(m.opening.trim())] });

  const inline = S.motionsPlacement === 'inline';
  const grouped = [];
  for (const s of m.sections) {
    const topics = s.topics.filter((t) => !t.deferred && (t.title.trim() || t.notes.trim() || t.motions.length));
    const extra = s.id === 'ann' && m.nextMeeting.date
      ? [`${monthOf(m.nextMeeting.date)} ${m.type} Meeting: ${ordinalDay(m.nextMeeting.date)}${m.nextMeeting.time ? ' @ ' + fmtTime(m.nextMeeting.time).replace(/ (AM|PM)/, (x) => x.toLowerCase().replace(' ', '')).replace(/:00/, '') : ''} - ${m.nextMeeting.location || 'location TBD'}`]
      : [];
    if (!topics.length && !extra.length) continue;
    B.push({ t: 'h', runs: [R(s.id === 'ann' ? s.title : s.title.toUpperCase())] });
    for (const t of topics) {
      B.push({ t: 'h2', runs: [R(t.title || 'Untitled topic')] });
      parseNotes(t.notes).forEach((n) => B.push({ t: 'li', lvl: n.lvl, runs: [R(n.text)] }));
      if (inline) t.motions.forEach((mo) => B.push({ t: 'p', runs: motionRuns(mo) }));
      else if (t.motions.length) grouped.push(t);
    }
    extra.forEach((x) => B.push({ t: 'li', lvl: 0, runs: [R(x)] }));
  }

  const deferred = allTopics(m).filter((t) => t.deferred);
  if (deferred.length || grouped.length) {
    B.push({ t: 'h', runs: [R('Actions, Discussion and Motions')] });
    if (deferred.length) {
      const nm = m.nextMeeting.date ? `${monthOf(m.nextMeeting.date)} ` : 'next ';
      B.push({ t: 'p', runs: [R(`Move the following agenda items to the ${nm}${m.type} meeting.`)] });
      deferred.forEach((t) => B.push({ t: 'li', lvl: 0, runs: [R(t.title || 'Untitled topic')] }));
      const dm = m.deferMotion;
      B.push({ t: 'p', runs: [R('On motion by '), personRun(dm.mover), R(', seconded by '), personRun(dm.seconder), R(`, the motion ${dm.vote && /passed|failed/.test(dm.result) ? dm.result.replace(' unanimously', '') + ' by a vote of ' + dm.vote : dm.result}.`)] });
    }
    for (const t of grouped) {
      B.push({ t: 'h2', runs: [R(t.title || 'Untitled topic')] });
      t.motions.forEach((mo) => B.push({ t: 'p', runs: motionRuns(mo) }));
    }
  }
  B.push({ t: 'p', runs: [R('On the motion of '), personRun(m.adjournBy), R(`, the ${S.adjournBody} adjourned${m.adjournAt ? ` at ${fmtTime(m.adjournAt)}` : ''}.`)] });
  return B;
}

function agendaBlocks(m) {
  const S = state.settings;
  const B = [];
  B.push({ t: 'title', runs: [R(`${m.type} Agenda`)] });
  B.push({ t: 'sub', runs: [R(S.orgName)] });
  B.push({ t: 'p', runs: [R(fmtLong(m.date) || 'DATE', { b: true }), R(m.time ? ` @ ${fmtTime(m.time)}` : ''), R(m.location ? ` · ${m.location}` : '')] });
  B.push({ t: 'h', runs: [R('Call to Order')] });
  B.push({ t: 'li', lvl: 0, runs: [R(`Approval of the ${m.minutesApproval.month} minutes`)] });
  B.push({ t: 'li', lvl: 0, runs: [R(`${m.financeApproval.month} financial report`)] });
  for (const s of m.sections) {
    B.push({ t: 'h', runs: [R(s.id === 'ann' ? s.title : s.title.toUpperCase())] });
    const ts = s.topics.filter((t) => t.title.trim());
    if (!ts.length) B.push({ t: 'li', lvl: 0, runs: [R('None', { i: true })] });
    ts.forEach((t) => B.push({ t: 'li', lvl: 0, runs: [R(t.title)] }));
  }
  B.push({ t: 'h', runs: [R('Actions, Discussion and Motions')] });
  B.push({ t: 'h', runs: [R('Adjournment')] });
  return B;
}

const runsHTML = (runs) => runs.map((r) => {
  let h = esc(r.text);
  if (r.b) h = `<b>${h}</b>`;
  if (r.i) h = `<i>${h}</i>`;
  if (r.ph) h = `<span class="ph">${h}</span>`;
  return h;
}).join('');

function blocksHTML(B, { logo = true } = {}) {
  let out = '';
  let listDepth = -1;
  const closeTo = (d) => { while (listDepth > d) { out += '</li></ul>'; listDepth--; } };
  let title = '', sub = '';
  for (const b of B) {
    if (b.t === 'li') {
      if (b.lvl > listDepth) { while (listDepth < b.lvl) { out += '<ul><li>'; listDepth++; } }
      else { closeTo(b.lvl); out += '</li><li>'; }
      out += runsHTML(b.runs);
      continue;
    }
    closeTo(-1);
    if (b.t === 'title') title = runsHTML(b.runs);
    else if (b.t === 'sub') sub = runsHTML(b.runs);
    else if (b.t === 'h') out += `<h3>${runsHTML(b.runs)}</h3>`;
    else if (b.t === 'h2') out += `<h4>${runsHTML(b.runs)}</h4>`;
    else if (b.t === 'p') out += `<p>${runsHTML(b.runs)}</p>`;
    else if (b.t === 'table') out += `<table>${b.rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${runsHTML(v)}</td></tr>`).join('')}</table>`;
  }
  closeTo(-1);
  const head = `<div class="doc-head">${logo && state.settings.includeLogo ? '<img src="assets/logo.png" alt="">' : ''}<div><h2>${title}</h2><p>${sub}</p></div></div>`;
  return head + out.replace(/<ul><li><\/li><li>/g, '<ul><li>');
}

function blocksText(B) {
  const t = (runs) => runs.map((r) => r.text).join('');
  return B.map((b) => {
    if (b.t === 'title') return t(b.runs).toUpperCase();
    if (b.t === 'sub') return t(b.runs) + '\n';
    if (b.t === 'h') return '\n' + t(b.runs);
    if (b.t === 'h2') return '\n' + t(b.runs);
    if (b.t === 'li') return `${'    '.repeat(b.lvl)}${['•', '◦', '▪'][b.lvl]} ${t(b.runs)}`;
    if (b.t === 'table') return b.rows.map(([k, v]) => `${k}: ${t(v)}`).join('\n') + '\n';
    return t(b.runs) + '\n';
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------- DOCX ---------- */
let docxLib = null;
function loadDocx() {
  if (docxLib) return Promise.resolve(docxLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/docx.iife.js';
    s.onload = () => { docxLib = window.docx; res(docxLib); };
    s.onerror = () => rej(new Error('Could not load the Word export library.'));
    document.head.appendChild(s);
  });
}
async function logoBytes() {
  try { const r = await fetch('assets/logo.png'); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); } catch (e) { return null; }
}

async function buildDocx(B, headerTitle) {
  const D = await loadDocx();
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Header, Footer, BorderStyle, VerticalAlign, AlignmentType, PageNumber } = D;
  const runs = (rs, base = {}) => rs.map((r) => new TextRun({ text: r.text, bold: r.b || base.bold, italics: r.i, size: base.size, color: base.color, highlight: r.ph ? 'yellow' : undefined }));
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const line = { style: BorderStyle.SINGLE, size: 6, color: '999999' };
  const children = [];
  let subtitle = '';
  for (const b of B) {
    if (b.t === 'title') continue;
    if (b.t === 'sub') { subtitle = b.runs.map((r) => r.text).join(''); continue; }
    if (b.t === 'h') children.push(new Paragraph({ children: runs(b.runs, { bold: true, size: 26 }), spacing: { before: 320, after: 120 } }));
    else if (b.t === 'h2') children.push(new Paragraph({ children: runs(b.runs, { bold: true }), spacing: { before: 200, after: 60 } }));
    else if (b.t === 'p') children.push(new Paragraph({ children: runs(b.runs), spacing: { after: 160 } }));
    else if (b.t === 'li') children.push(new Paragraph({ children: runs(b.runs), bullet: { level: b.lvl }, spacing: { after: 40 } }));
    else if (b.t === 'table') {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [1900, 7460],
        borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
        rows: b.rows.map(([k, v]) => new TableRow({ children: [
          new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
          new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: runs(v) })] }),
        ] })),
      }));
      children.push(new Paragraph({ text: '' }));
    }
  }
  const logo = state.settings.includeLogo ? await logoBytes() : null;
  const headText = [
    new Paragraph({ children: [new TextRun({ text: headerTitle, bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: subtitle, color: '666666', size: 20 })] }),
  ];
  const header = new Header({ children: [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, columnWidths: logo ? [1300, 8060] : [9360],
      rows: [new TableRow({ children: [
        ...(logo ? [new TableCell({ borders: noBorders, width: { size: 14, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 64, height: 64 } })] })] })] : []),
        new TableCell({ borders: noBorders, verticalAlign: VerticalAlign.CENTER, children: headText }),
      ] })],
    }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'F28C1B', space: 4 } }, children: [] }),
  ] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], size: 18, color: '888888' })] })] });
  const doc = new Document({
    creator: state.settings.orgName,
    title: headerTitle,
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1300, bottom: 1080, left: 1260, right: 1260, header: 500 } } }, headers: { default: header }, footers: { default: footer }, children }],
  });
  return Packer.toBlob(doc);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const fileStem = (m, kind) => `${state.settings.bodyName.replace(/\s+/g, '_')}_${kind}_${m.date || 'undated'}`;

async function exportDocx(kind) {
  const m = cur();
  if (!m) return;
  try {
    toast('Building Word document…');
    const B = kind === 'agenda' ? agendaBlocks(m) : minutesBlocks(m);
    const blob = await buildDocx(B, kind === 'agenda' ? `${m.type} Agenda` : `${m.type} Meeting Minutes`);
    download(blob, `${fileStem(m, kind === 'agenda' ? 'Agenda' : 'Minutes')}.docx`);
    toast('Downloaded — open it in Word or Google Docs to make corrections.');
  } catch (e) {
    console.error(e);
    toast(e.message || 'Export failed.');
  }
}

/* =========================================================================
   Render: Export tab
   ========================================================================= */
function issues(m) {
  const out = [];
  if (!members().length) out.push('No board members in the roster.');
  if (!m.calledBy) out.push('Who called the meeting to order?');
  if (!m.minutesApproval.by) out.push('Who circulated the minutes?');
  if (!m.financeApproval.by) out.push('Who presented the financial report?');
  allTopics(m).forEach((t) => t.motions.forEach((mo) => {
    if (!mo.mover || !mo.seconder) out.push(`Motion on “${t.title || 'untitled'}” needs a mover and seconder.`);
    if (!mo.action) out.push(`Motion on “${t.title || 'untitled'}” has no wording.`);
  }));
  if (!m.adjournBy) out.push('Who moved to adjourn?');
  return out;
}

function renderExport(m) {
  const mode = state.docMode || 'minutes';
  const B = mode === 'agenda' ? agendaBlocks(m) : minutesBlocks(m);
  const iss = mode === 'minutes' ? issues(m) : [];
  return `<div class="export">
    <div>
      <div class="doc-toggle" role="group" aria-label="Document">
        <button data-act="doc-mode" data-mode="minutes" aria-pressed="${mode === 'minutes'}">Minutes</button>
        <button data-act="doc-mode" data-mode="agenda" aria-pressed="${mode === 'agenda'}">Agenda</button>
      </div>
      <div class="paper" id="paper">${blocksHTML(B)}</div>
    </div>
    <aside class="export-side">
      <div class="card card-pad">
        <div class="card-title">Export ${mode}</div>
        <div class="stack" style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-block" data-act="${mode === 'agenda' ? 'dl-agenda' : 'dl-minutes'}">${I.word} Word document (.docx)</button>
          <button class="btn btn-block" data-act="copy">${I.copy} Copy formatted text</button>
          <button class="btn btn-block" data-act="print">${I.print} Print / save as PDF</button>
          ${m.transcript.length ? `<button class="btn btn-block" data-act="dl-transcript">${I.dl} Transcript (.txt)</button>` : ''}
        </div>
        <p class="hint" style="margin:12px 0 0">The .docx opens in Word, Pages, or Google Docs (upload to Drive → Open with Google Docs) for final corrections. <span class="ph" style="background:#fff3cd;color:#8a5a00;border-radius:3px;padding:0 3px">Highlighted</span> text is still missing.</p>
      </div>
      ${mode === 'minutes' ? `
      <div class="card card-pad">
        <div class="card-title">Motions appear</div>
        <div class="doc-toggle" style="margin:0">
          <button data-act="placement" data-v="end" aria-pressed="${state.settings.motionsPlacement !== 'inline'}">Grouped at end</button>
          <button data-act="placement" data-v="inline" aria-pressed="${state.settings.motionsPlacement === 'inline'}">Under each topic</button>
        </div>
      </div>
      <div class="card card-pad">
        <div class="card-title">Before you send ${iss.length ? `<span class="badge acc">${iss.length}</span>` : '<span class="badge ok">All set</span>'}</div>
        ${iss.length ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--mute)">${iss.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="hint" style="margin:0">Nothing missing. Nice work.</p>'}
      </div>` : ''}
    </aside>
  </div>`;
}

/* =========================================================================
   Speech recognition (dictation + live transcript)
   ========================================================================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const speech = { rec: null, target: null, running: false };
// target: topic id string, or '__tx' for meeting transcript

function speechTarget() { return speech.dictate || (rec.active ? '__tx' : null); }

function ensureSpeech() {
  if (!SR) return null;
  if (speech.rec) return speech.rec;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = navigator.language || 'en-US';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) deliver(res[0].transcript);
      else interim += res[0].transcript;
    }
    showInterim(interim);
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('Microphone access was blocked. Allow it in your browser’s site settings.');
      speech.dictate = null;
      stopRecording();
    } else if (e.error === 'network') {
      toast('Speech service unavailable — check your connection.');
    }
  };
  r.onend = () => {
    speech.running = false;
    showInterim('');
    if (speechTarget()) { try { r.start(); speech.running = true; } catch (err) { /* retry on next tick */ setTimeout(() => speechTarget() && !speech.running && safeStart(), 300); } }
  };
  speech.rec = r;
  return r;
}
function safeStart() { const r = ensureSpeech(); if (!r || speech.running) return; try { r.start(); speech.running = true; } catch (e) { /* already started */ } }
function updateSpeech() {
  if (speechTarget()) safeStart();
  else if (speech.rec && speech.running) { try { speech.rec.stop(); } catch (e) { /* ignore */ } }
  syncSpeechUI();
}
function showInterim(text) {
  $$('[data-interim]').forEach((el) => { el.textContent = el.dataset.interim === speechTarget() ? text : ''; });
}
function deliver(text) {
  text = text.trim();
  if (!text) return;
  const target = speechTarget();
  const m = cur();
  if (!m || !target) return;
  if (target === '__tx') {
    const at = rec.start ? mmss((Date.now() - rec.start) / 1000) : nowHM();
    m.transcript.push({ id: uid(), at, text: cap(text) });
    const list = $('#txList');
    if (list) { list.innerHTML = renderTranscript(m); list.scrollTop = list.scrollHeight; }
  } else {
    appendToTopic(target, cap(text));
  }
  save();
}
function appendToTopic(id, text) {
  const t = findTopic(id);
  if (!t) return;
  t.notes = t.notes.replace(/\s+$/, '') + (t.notes.trim() ? '\n' : '') + text;
  const ta = document.querySelector(`[data-path="t.${id}.notes"]`);
  if (ta) { ta.value = t.notes; autosize(ta); }
  save();
}
function syncSpeechUI() {
  $$('[data-act="mic"]').forEach((b) => b.classList.toggle('mic-on', speech.dictate === b.dataset.id));
}

/* ---------- audio recording ---------- */
const rec = { active: false, media: null, chunks: [], start: 0, url: null, timer: null, stream: null };
const audioName = () => { const m = cur(); return `${m ? fileStem(m, 'Recording') : 'Recording'}.webm`; };
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) { toast('Recording is not supported in this browser.'); return; }
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) { toast('Microphone access was blocked.'); return; }
  rec.chunks = [];
  if (rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
  if (window.MediaRecorder) {
    rec.media = new MediaRecorder(rec.stream);
    rec.media.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
    rec.media.onstop = () => {
      const blob = new Blob(rec.chunks, { type: rec.media.mimeType || 'audio/webm' });
      rec.url = URL.createObjectURL(blob);
      if (state.tab === 'live') render();
    };
    rec.media.start(1000);
  }
  rec.active = true;
  rec.start = Date.now();
  $('#recPill').hidden = false;
  rec.timer = setInterval(() => { $('#recTime').textContent = mmss((Date.now() - rec.start) / 1000); }, 500);
  updateSpeech();
  if (state.tab === 'live') render();
  toast(SR ? 'Recording — transcript will appear on the right.' : 'Recording audio (transcription not supported in this browser).');
}
function stopRecording() {
  if (!rec.active) return;
  rec.active = false;
  clearInterval(rec.timer);
  $('#recPill').hidden = true;
  if (rec.media && rec.media.state !== 'inactive') rec.media.stop();
  rec.stream?.getTracks().forEach((t) => t.stop());
  updateSpeech();
  if (state.tab === 'live') render();
  toast('Recording stopped. Download the audio to keep it.');
}

/* =========================================================================
   Modals
   ========================================================================= */
function settingsModal() {
  const S = state.settings;
  const rows = S.roster.map((r) => `
    <div class="roster-row">
      <input class="input" data-path="r.${r.id}.name" value="${esc(r.name)}" placeholder="Full name">
      <input class="input role-in" data-path="r.${r.id}.role" value="${esc(r.role)}" placeholder="Role (e.g. Board Member)" list="roles">
      <button class="icon-btn" data-act="del-member" data-id="${r.id}" aria-label="Remove">${I.x}</button>
    </div>`).join('');
  openModal(`
    <div class="modal-head"><h2>Board &amp; settings</h2><button class="icon-btn" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="modal-body">
      <div class="card-title">Board roster</div>
      <datalist id="roles"><option>President</option><option>Vice President</option><option>Interim Vice President</option><option>Secretary</option><option>Interim Secretary</option><option>Treasurer</option><option>Liaison to the Library</option><option>Board Member</option></datalist>
      <div id="rosterRows">${rows}</div>
      <button class="btn btn-sm" style="margin-top:10px" data-act="add-member">${I.plus} Add member</button>
      <p class="hint">Saved only in this browser. Officer roles fill in “called to order by”, minutes and treasurer lines automatically.</p>

      <div class="card-title" style="margin-top:22px">Organization</div>
      <div class="grid g2">
        <label class="field"><span>Organization name (on documents)</span><input class="input" data-path="s.orgName" value="${esc(S.orgName)}"></label>
        <label class="field"><span>Board name</span><input class="input" data-path="s.bodyName" value="${esc(S.bodyName)}"></label>
        <label class="field"><span>“…the ___ adjourned”</span><input class="input" data-path="s.adjournBody" value="${esc(S.adjournBody)}"></label>
        <label class="field"><span>Default location</span><input class="input" data-path="s.defaultLocation" value="${esc(S.defaultLocation)}" placeholder="TBD"></label>
      </div>
      <div class="card-title" style="margin-top:22px">Regular schedule</div>
      <div class="grid g3">
        <label class="field"><span>Week</span><select class="select" data-path="s.schedule.week" data-num>${ORD.map((o, i) => `<option value="${i}" ${S.schedule.week === i ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
        <label class="field"><span>Day</span><select class="select" data-path="s.schedule.weekday" data-num>${DAYS.map((d, i) => `<option value="${i}" ${S.schedule.weekday === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="field"><span>Time</span><input class="input" type="time" data-path="s.defaultTime" value="${esc(S.defaultTime)}"></label>
      </div>
      <label class="toggle" style="margin-top:14px"><input type="checkbox" data-path="s.includeLogo" ${S.includeLogo ? 'checked' : ''}> Put the Library Friends logo on documents</label>

      <div class="card-title" style="margin-top:22px">Your data</div>
      <div class="row">
        <button class="btn btn-sm" data-act="backup">${I.dl} Back up everything (.json)</button>
        <label class="btn btn-sm">Restore backup<input type="file" accept="application/json,.json" id="restoreFile" hidden></label>
      </div>
      <p class="hint">Everything lives in this browser on this device. Back up regularly, or before switching devices.</p>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" data-act="close">Done</button></div>`);
}

function newMeetingModal() {
  const latest = sortedMeetings()[0];
  const date = latest ? (latest.nextMeeting?.date && latest.nextMeeting.date > latest.date ? latest.nextMeeting.date : nextScheduled(latest.date)) : nextScheduled();
  const carry = latest ? allTopics(latest).filter((t) => t.title.trim() && !/liaison to the library report|committee\/task force/i.test(t.title)) : [];
  openModal(`
    <form id="newForm">
    <div class="modal-head"><h2>New meeting</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="modal-body">
      <div class="grid g3">
        <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${date}" required></label>
        <label class="field"><span>Time</span><input class="input" type="time" name="time" value="${esc(latest?.nextMeeting?.time || state.settings.defaultTime)}"></label>
        <label class="field"><span>Location</span><input class="input" name="location" value="${esc(latest?.nextMeeting?.location || state.settings.defaultLocation)}" placeholder="TBD"></label>
      </div>
      ${carry.length ? `
        <div class="card-title" style="margin-top:22px">Carry into Old Business from ${esc(fmtLong(latest.date))}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${carry.map((t) => `<label class="toggle" style="color:var(--text)"><input type="checkbox" name="carry" value="${esc(t.title)}" ${t.deferred || t.motions.some((mo) => /tabled/.test(mo.result)) || !t.motions.length ? 'checked' : ''}> ${esc(t.title)} ${t.deferred ? '<span class="badge info">Moved</span>' : ''}${t.motions.some((mo) => /passed/.test(mo.result)) ? '<span class="badge ok">Passed</span>' : ''}</label>`).join('')}
        </div>` : ''}
      <p class="hint" style="margin-top:16px">Committee reports and the Liaison report are added automatically.</p>
    </div>
    <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Create meeting</button></div>
    </form>`);
}

function carryModal() {
  const m = cur();
  const prev = previousMeeting(m);
  if (!prev) return;
  const existing = new Set(allTopics(m).map((t) => t.title.trim().toLowerCase()));
  const items = allTopics(prev).filter((t) => t.title.trim() && !existing.has(t.title.trim().toLowerCase()));
  openModal(`
    <form id="carryForm">
    <div class="modal-head"><h2>Pull from ${esc(fmtLong(prev.date))}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="modal-body">
      ${items.length ? `<div style="display:flex;flex-direction:column;gap:8px">${items.map((t) => `<label class="toggle" style="color:var(--text)"><input type="checkbox" name="carry" value="${esc(t.title)}" ${t.deferred ? 'checked' : ''}> ${esc(t.title)}</label>`).join('')}</div>` : '<p class="muted">Everything from that meeting is already on this agenda.</p>'}
    </div>
    <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button>${items.length ? '<button class="btn btn-primary" type="submit">Add to Old Business</button>' : ''}</div>
    </form>`);
}

/* =========================================================================
   Events
   ========================================================================= */
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('#tabs .tab');
  if (tab) { state.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const m = cur();
  switch (act) {
    case 'open': state.currentId = id; save(); closeSidebar(); render(); break;
    case 'new': newMeetingModal(); break;
    case 'settings': settingsModal(); closeSidebar(); break;
    case 'close': closeModal(); render(); break;
    case 'tab': state.tab = el.dataset.tab; save(); render(); window.scrollTo(0, 0); break;
    case 'move': {
      const s = m.sections.find((x) => x.topics.some((t) => t.id === id));
      const i = s.topics.findIndex((t) => t.id === id);
      const j = i + Number(el.dataset.dir);
      if (j >= 0 && j < s.topics.length) { [s.topics[i], s.topics[j]] = [s.topics[j], s.topics[i]]; save(); render(); }
      break;
    }
    case 'del-topic': {
      const t = findTopic(id);
      if ((t.notes.trim() || t.motions.length) && !confirm(`Remove “${t.title || 'this topic'}” and its notes?`)) break;
      m.sections.forEach((s) => { s.topics = s.topics.filter((x) => x.id !== id); });
      if (speech.dictate === id) { speech.dictate = null; updateSpeech(); }
      save(); render();
      break;
    }
    case 'att': {
      const n = el.dataset.name;
      m.attendance[n] = m.attendance[n] === 'absent' ? 'present' : 'absent';
      save(); render();
      break;
    }
    case 'now': setPath(el.dataset.path, nowHM()); render(); break;
    case 'add-motion': findTopic(id).motions.push(newMotion()); activeTopic = id; save(); render();
      setTimeout(() => { const ins = $$(`[data-topic="${id}"] .motion .input`); ins[ins.length - 1]?.focus(); }, 0);
      break;
    case 'del-motion': allTopics(m).forEach((t) => { t.motions = t.motions.filter((x) => x.id !== id); }); save(); render(); break;
    case 'mic':
      if (!SR) { toast('Voice dictation needs Chrome, Edge or Safari.'); break; }
      speech.dictate = speech.dictate === id ? null : id;
      activeTopic = id;
      $$('.topic').forEach((x) => x.classList.toggle('active', x.dataset.topic === id));
      updateSpeech();
      if (speech.dictate) toast('Listening… tap the mic again to stop.');
      break;
    case 'rec': rec.active ? stopRecording() : startRecording(); break;
    case 'tx-send': {
      if (!activeTopic || !findTopic(activeTopic)) { toast('Tap a topic first to highlight where lines should go.'); break; }
      const line = m.transcript.find((l) => l.id === id);
      appendToTopic(activeTopic, line.text);
      el.closest('.t-line').style.opacity = '.45';
      toast(`Added to “${findTopic(activeTopic).title || 'topic'}”.`);
      break;
    }
    case 'tx-clear': if (confirm('Clear the transcript?')) { m.transcript = []; save(); render(); } break;
    case 'doc-mode': state.docMode = el.dataset.mode; save(); render(); break;
    case 'placement': state.settings.motionsPlacement = el.dataset.v; save(); render(); break;
    case 'preview-agenda': state.docMode = 'agenda'; state.tab = 'export'; save(); render(); break;
    case 'dl-minutes': exportDocx('minutes'); break;
    case 'dl-agenda': exportDocx('agenda'); break;
    case 'print': window.print(); break;
    case 'copy': {
      const B = state.docMode === 'agenda' ? agendaBlocks(m) : minutesBlocks(m);
      const text = blocksText(B);
      const html = `<div style="font-family:Arial,sans-serif">${blocksHTML(B, { logo: false }).replace(/<span class="ph">/g, '<span style="background:#fff3cd">')}</div>`;
      try {
        if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
        else await navigator.clipboard.writeText(text);
        toast('Copied — paste into an email or Google Doc.');
      } catch (err) { toast('Copy failed — try the Word download instead.'); }
      break;
    }
    case 'dl-transcript': download(new Blob([m.transcript.map((l) => `[${l.at}] ${l.text}`).join('\n')], { type: 'text/plain' }), `${fileStem(m, 'Transcript')}.txt`); break;
    case 'carry': carryModal(); break;
    case 'add-member': state.settings.roster.push({ id: uid(), name: '', role: 'Board Member' }); save(); settingsModal(); setTimeout(() => { const ins = $$('#rosterRows .roster-row input:first-child'); ins[ins.length - 1]?.focus(); }, 0); break;
    case 'del-member': state.settings.roster = state.settings.roster.filter((r) => r.id !== id); save(); settingsModal(); break;
    case 'backup': download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `FOTL_minutes_backup_${toISO(new Date())}.json`); break;
    case 'del-meeting':
      if (confirm('Delete this meeting? This cannot be undone.')) {
        state.meetings = state.meetings.filter((x) => x.id !== m.id);
        state.currentId = sortedMeetings()[0]?.id || null;
        save(); render();
      }
      break;
    case 'menu': $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); break;
  }
});

$('#newMeetingBtn').dataset.act = 'new';
$('#settingsBtn').dataset.act = 'settings';
$('#menuBtn').dataset.act = 'menu';
$('#scrim').addEventListener('click', closeSidebar);
modal.addEventListener('close', () => render());

// Inputs bound to state
function onInput(e) {
  const el = e.target;
  const path = el.dataset?.path;
  if (!path) return;
  if (el.hasAttribute('data-person') && el.value === '__other') {
    const name = prompt('Name:');
    if (name && name.trim()) setPath(path, name.trim());
    render();
    return;
  }
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.hasAttribute('data-num')) v = Number(v);
  setPath(path, v);
  if (el.hasAttribute('data-head')) { renderHead(); renderSidebar(); }
  if (el.hasAttribute('data-rerender') || (e.type === 'change' && el.tagName === 'SELECT' && !modal.open)) render();
  if (e.type === 'change' && path.startsWith('r.') && modal.open) renderSidebar();
}
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'TEXTAREA') autosize(e.target);
  if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onInput(e);
});
document.addEventListener('change', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onInput(e);
  if (e.target.id === 'restoreFile') restore(e.target.files[0]);
});

// Highlight the topic you're working in
document.addEventListener('focusin', (e) => {
  const t = e.target.closest?.('.topic');
  if (t && t.dataset.topic !== activeTopic) {
    activeTopic = t.dataset.topic;
    $$('.topic').forEach((x) => x.classList.toggle('active', x === t));
  }
});

// Forms
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.add) {
    const title = f.title.value.trim();
    if (!title) return;
    const m = cur();
    m.sections.find((s) => s.id === f.dataset.add).topics.push(newTopic(title));
    save(); render();
    const again = document.querySelector(`form[data-add="${f.dataset.add}"] input`);
    again?.focus();
    return;
  }
  if (f.id === 'newForm') {
    const fd = new FormData(f);
    createMeeting({ date: fd.get('date'), time: fd.get('time'), location: fd.get('location'), carry: fd.getAll('carry') });
    closeModal(); render();
    toast('Meeting created. Build the agenda, then switch to “Take minutes”.');
    return;
  }
  if (f.id === 'carryForm') {
    const m = cur();
    new FormData(f).getAll('carry').forEach((t) => m.sections[0].topics.push(newTopic(t)));
    save(); closeModal(); render();
  }
});

function restore(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!Array.isArray(s.meetings) || !s.settings) throw new Error('bad');
      if (!confirm(`Replace everything here with this backup (${s.meetings.length} meetings)?`)) return;
      state = s;
      state.settings = Object.assign(defaultSettings(), s.settings);
      saveNow(); closeModal(); render();
      toast('Backup restored.');
    } catch (e) { toast('That file isn’t a valid backup.'); }
  };
  r.readAsText(file);
}

// Keyboard: Tab / Shift+Tab indent bullet lines inside notes
document.addEventListener('keydown', (e) => {
  const ta = e.target;
  if (e.key !== 'Tab' || ta.tagName !== 'TEXTAREA' || !ta.dataset.path?.endsWith('.notes')) return;
  const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  const line = ta.value.slice(start);
  e.preventDefault();
  const pos = ta.selectionStart;
  if (e.shiftKey) {
    const m = line.match(/^(\s{1,2}|-\s?)/);
    if (!m) return;
    ta.value = ta.value.slice(0, start) + ta.value.slice(start + m[0].length);
    ta.selectionStart = ta.selectionEnd = Math.max(start, pos - m[0].length);
  } else {
    ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(start);
    ta.selectionStart = ta.selectionEnd = pos + 2;
  }
  setPath(ta.dataset.path, ta.value);
});

/* =========================================================================
   Boot
   ========================================================================= */
if (!cur() && state.meetings.length) state.currentId = sortedMeetings()[0].id;
render();

})();
