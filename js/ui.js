/* =========================================================
   IRONLOG — UI kit: router, sheets, toasts, rest timer, haptics
   Routing is hash-based so the phone's BACK button works properly
   once the app is installed to the home screen.
   ========================================================= */
(function (global) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const COLORS = { blue: 'var(--accent)', orange: 'var(--p2)', aqua: '#199e70', magenta: '#d55181', violet: '#9085e9', yellow: '#c98500' };
  const COLOR_KEYS = Object.keys(COLORS);
  const colorOf = p => (p && COLORS[p.color]) || 'var(--accent)';

  /* ---------- formatting ---------- */
  function timeAgo(ts) {
    if (!ts) return 'never';
    const days = Math.floor((Store.startOfDay(Date.now()) - Store.startOfDay(ts)) / 864e5);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 14) return 'last week';
    if (days < 60) return Math.floor(days / 7) + ' weeks ago';
    return Math.floor(days / 30) + ' months ago';
  }
  const dateFull = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const clock = ts => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  function dur(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + 'h ' + m + 'm' : m + 'm';
  }
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.max(0, s % 60)).padStart(2, '0');

  /* ---------- haptics + sound ---------- */
  function haptic(pattern) {
    if (!Store.settings().vibrate) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern || 12); } catch (e) { }
  }
  let actx = null;
  function beep(freq, ms, vol) {
    if (!Store.settings().sound) return;
    try {
      actx = actx || new (global.AudioContext || global.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(vol == null ? .22 : vol, actx.currentTime + .01);
      g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + (ms || 160) / 1000);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (ms || 160) / 1000 + .02);
    } catch (e) { }
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    const el = $('#toast');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = (kind === 'good' ? icon('check', 18) : kind === 'bad' ? icon('alert', 18) : '') + '<span>' + esc(msg) + '</span>';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'bad' ? 4200 : 2400);
  }

  /* ---------- PR celebration ---------- */
  function prBurst(text) {
    const el = $('#prBurst');
    $('#prTxt').textContent = text;
    el.hidden = false;
    haptic([30, 60, 30, 60, 90]); beep(880, 120); setTimeout(() => beep(1180, 220), 130);
    setTimeout(() => { el.hidden = true; }, 1750);
  }

  /* ---------- icons ---------- */
  const ICONS = {
    check: '<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    alert: '<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17.2v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    star: '<path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.4 6.6 20.3l1.1-6.1L3.2 9.9l6.1-.8z" fill="currentColor"/>',
    starO: '<path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.4 6.6 20.3l1.1-6.1L3.2 9.9l6.1-.8z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    cam: '<path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3v10.5H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.6" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/>',
    trash: '<path d="M5 7h14M9.5 7V4.6h5V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    play: '<path d="M7 4.8L19 12 7 19.2z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.6v4.2l2.6 1.6M9 3.2h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    dumb: '<path d="M7 12h10M3.6 9v6M6.4 7.5v9M17.6 7.5v9M20.4 9v6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    fire: '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.4 1-3.4S7.6 11 9 12c0-3.6 3-9 3-9z" fill="currentColor"/>',
    chev: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    up: '<path d="M12 19V6M6 11.5L12 5.5l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M12 5v13M6 12.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    eq: '<path d="M6 10h12M6 14.5h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    crown: '<path d="M4 18l1.6-9 4.4 3.6L12 5l2 7.6L18.4 9 20 18z" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="6.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.8 15.8L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>',
    list: '<path d="M4 6.5h16M4 12h16M4 17.5h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    github: '<path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.9c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.4-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.5 4.9.4.4.7 1 .7 2v3c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.2z" fill="currentColor"/>',
    share: '<path d="M8.7 10.6 15 7.4M8.7 13.4l6.3 3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="18" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/>',
    note: '<path d="M6 3.5h9L19 8v12.5H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12h7M9 15.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const icon = (name, size) => `<svg viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- machine artwork ----------
     Three layers, best available wins:
       1. a photo the user took of the real machine in their gym  (cropped)
       2. the reference photo shipped with the app                (fitted on white)
       3. the hand-drawn illustration                             (always present)
     The drawing sits underneath rather than being swapped in, so it doubles as
     the placeholder while an image loads and as the fallback if one 404s or the
     phone is offline before the image has been cached.
  --------------------------------------------------------------- */
  function artHtml(ex) {
    const user = Store.photoCached(ex.id);
    let out = `<span class="art-l">${Machines.artFor(ex.art)}</span>`;
    if (user) out += `<img class="art-ph art-user" src="${user}" alt="" decoding="async">`;
    else if (ex.photo) out += `<img class="art-ph" src="${esc(ex.photo)}" alt="" loading="lazy" decoding="async">`;
    return out;
  }

  /* ---------- machine cards ---------- */
  function lastLine(ex, pid) {
    const lp = Store.lastPerformance(ex.id, pid);
    if (!lp) return { text: 'not logged yet', none: true, ago: '' };
    const b = lp.best;
    let text;
    if (ex.metric === 'time') text = mmss(b.s || 0);
    else if (ex.metric === 'cardio') text = Math.round((b.s || 0) / 60) + ' min';
    else if (ex.metric === 'reps' && !b.w) text = b.r + ' reps';
    else text = Store.fmtW(b.w, false) + Store.unit() + ' × ' + b.r;
    return { text, none: false, ago: timeAgo(lp.date), lp };
  }
  function machineCard(ex) {
    const m = Store.metaFor(ex.id);
    const ll = lastLine(ex);
    const fav = Store.isFav(ex.id);
    const improved = ll.lp && ll.lp.deltaScore != null && (ex.inverse ? ll.lp.deltaScore < 0 : ll.lp.deltaScore > 0);
    return `<button class="mcard" data-x="${esc(ex.id)}">
      <span class="mcard-art">${artHtml(ex)}
        ${m.num ? `<span class="mcard-num">#${esc(m.num)}</span>` : ''}
        ${fav ? `<span class="mcard-fav">${icon('star', 17)}</span>` : ''}
        ${improved ? `<span class="mcard-pill">UP</span>` : ''}
      </span>
      <span class="mcard-b">
        <span class="mcard-n">${esc(ex.name)}</span>
        <span class="mcard-last${ll.none ? ' none' : ''}">${esc(ll.text)}</span>
        ${ll.ago ? `<span class="mcard-ago">${esc(ll.ago)}</span>` : ''}
      </span>
    </button>`;
  }
  function machineRow(ex) {
    const m = Store.metaFor(ex.id);
    const ll = lastLine(ex);
    return `<button class="mrow" data-x="${esc(ex.id)}">
      <span class="mrow-art">${artHtml(ex)}${m.num ? `<span class="mcard-num" style="transform:scale(.8);transform-origin:top left">#${esc(m.num)}</span>` : ''}</span>
      <span class="mrow-b"><span class="mrow-n">${esc(ex.name)}</span><span class="mrow-s">${esc(ll.none ? 'not logged yet' : ll.ago)}</span></span>
      <span class="mrow-r"><span class="mrow-w">${ll.none ? '<small>—</small>' : esc(ll.text)}</span></span>
    </button>`;
  }

  /* ---------- day container ----------
     One training day: date, muscle groups covered, and every machine used
     with what you did on it. Tapping a machine opens that machine. */
  function dayCard(d, opts) {
    opts = opts || {};
    const vp = Store.volParts(d.volume);
    const when = dayHeading(d.ts);
    return `<div class="dayc">
      <div class="dayc-h">
        <span class="dayc-d"><b>${esc(when)}</b><span>${d.exercises.length} machine${d.exercises.length === 1 ? '' : 's'} · ${d.setCount} set${d.setCount === 1 ? '' : 's'}${d.reps ? ' · ' + d.reps + ' reps' : ''}</span></span>
        ${d.volume ? `<span class="dayc-v">${esc(vp.value)}<small> ${esc(vp.unit)}</small></span>` : ''}
      </div>
      ${d.groups.length ? `<div class="dayc-tags">${d.groups.map(g => `<span class="dayc-tag">${esc(g)}</span>`).join('')}</div>` : ''}
      <div class="dayc-list">
        ${d.exercises.slice(0, opts.max || 99).map(e => `
          <button class="dayc-m" data-x="${esc(e.ex.id)}">
            <span class="dayc-art">${artHtml(e.ex)}</span>
            <span class="dayc-n">${esc(e.ex.name)}<span>${esc(setSummary(e))}</span></span>
            <span class="dayc-c">${e.count}×</span>
          </button>`).join('')}
        ${opts.max && d.exercises.length > opts.max ? `<p class="dim" style="padding:6px 8px 2px">+ ${d.exercises.length - opts.max} more</p>` : ''}
      </div>
    </div>`;
  }
  /* "55 kg × 12 · best of 3" style line for one machine on one day */
  function setSummary(e) {
    const ex = e.ex, b = e.best;
    if (ex.metric === 'time') return mmss(b.s || 0);
    if (ex.metric === 'cardio') return Math.round((b.s || 0) / 60) + ' min';
    if (ex.metric === 'reps' && !b.w) return b.r + ' reps';
    return Store.fmtW(b.w, false) + ' ' + Store.unit() + ' × ' + b.r;
  }
  function dayHeading(ts) {
    const days = Math.floor((Store.startOfDay(Date.now()) - Store.startOfDay(ts)) / 864e5);
    const d = new Date(ts);
    const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    if (days === 0) return 'Today · ' + label;
    if (days === 1) return 'Yesterday · ' + label;
    return label;
  }

  /* ---------- avatar ---------- */
  function avatar(p, size) {
    size = size || 40;
    const photo = Store.profilePhoto(p.id);
    if (photo) {
      return `<span class="vs-av av-img" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px ${colorOf(p)}"><img src="${photo}" alt=""></span>`;
    }
    const initial = (p.emoji || (p.name || '?').charAt(0).toUpperCase());
    return `<span class="vs-av" style="background:${colorOf(p)};width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc(initial)}</span>`;
  }

  /* ---------- bottom sheet ---------- */
  let sheetOnClose = null;
  function sheet(title, html, mount, onClose) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    $('#sheet').hidden = false;
    sheetOnClose = onClose || null;
    if (mount) mount($('#sheetBody'));
    haptic(8);
  }
  function closeSheet() {
    if ($('#sheet').hidden) return;
    $('#sheet').hidden = true;
    $('#sheetBody').innerHTML = '';
    const cb = sheetOnClose; sheetOnClose = null;
    if (cb) cb();
  }
  function confirmSheet(title, body, okLabel, danger) {
    return new Promise(res => {
      let done = false;
      sheet(title, `<p class="sub" style="margin-bottom:18px">${esc(body)}</p>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-wide" id="cfOk">${esc(okLabel || 'Confirm')}</button>
        <button class="btn btn-ghost btn-wide" style="margin-top:9px" data-close="1">Cancel</button>`,
        b => { $('#cfOk', b).onclick = () => { done = true; closeSheet(); res(true); }; },
        () => { if (!done) res(false); });
    });
  }

  /* ---------- rest timer (survives screen lock: uses wall clock) ---------- */
  const rest = {
    endAt: 0, total: 0, tick: null, next: '',
    start(sec, nextLabel) {
      this.total = sec; this.endAt = Date.now() + sec * 1000; this.next = nextLabel || '';
      $('#rest').hidden = false;
      $('#restNext').textContent = this.next;
      this.render();
      clearInterval(this.tick);
      this.tick = setInterval(() => this.render(), 200);
      haptic(10);
    },
    add(sec) { if (!this.endAt) return; this.endAt += sec * 1000; this.total += sec; haptic(8); this.render(); },
    render() {
      const leftMs = this.endAt - Date.now();
      const left = Math.ceil(leftMs / 1000);
      $('#restTime').textContent = mmss(Math.max(0, left));
      const frac = Math.max(0, Math.min(1, leftMs / (this.total * 1000)));
      const C = 2 * Math.PI * 88;
      $('#restArc').setAttribute('stroke-dashoffset', String(C * (1 - frac)));
      if (left === 10 || left === 3 || left === 2 || left === 1) { if (this._last !== left) beep(700, 90, .14); }
      this._last = left;
      if (leftMs <= 0) this.done();
    },
    done() {
      clearInterval(this.tick); this.tick = null; this.endAt = 0;
      haptic([200, 90, 200]); beep(980, 260); setTimeout(() => beep(1240, 300), 260);
      $('#rest').hidden = true;
      toast('Rest done — next set!', 'good');
    },
    stop() { clearInterval(this.tick); this.tick = null; this.endAt = 0; $('#rest').hidden = true; }
  };

  /* ---------- router ---------- */
  const routes = {};
  let current = { name: '', params: {} };
  function register(name, fn) { routes[name] = fn; }
  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { name: 'home', params: {} };
    const parts = h.split('/').map(decodeURIComponent);
    if (parts[0] === 'x') return { name: 'exercise', params: { id: parts[1] } };
    if (parts[0] === 'session') return { name: 'session', params: { id: parts[1] } };
    return { name: parts[0] || 'home', params: { arg: parts[1] } };
  }
  function go(hash, replace) {
    if (replace) location.replace('#' + hash); else location.hash = hash;
  }
  function render() {
    const r = parseHash();
    const fn = routes[r.name] || routes.home;
    current = r;
    const host = $('#view');
    closeSheet();
    host.innerHTML = '';
    try { fn(host, r.params); } catch (e) { console.error(e); host.innerHTML = `<div class="empty"><b>Something broke on this screen</b><span class="dim">${esc(e.message)}</span></div>`; }
    host.scrollTop = 0;
    if (window.scrollTo) window.scrollTo(0, 0);
    syncTabs(r.name);
    /* the live-workout ribbon depends on both the session and the route,
       so it has to repaint on every render, not only on navigation */
    if (global.App && global.App.paintRibbon) global.App.paintRibbon();
    Store.setDevice('lastRoute', location.hash || '#/home');
  }
  function syncTabs(name) {
    const map = { home: 'home', history: 'home', machines: 'machines', exercise: 'machines', progress: 'progress', versus: 'versus', workout: 'workout', session: 'progress' };
    const active = map[name] || '';
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.route === active && t.dataset.route !== 'workout'));
  }
  const currentRoute = () => current;

  /* ---------- misc dom helpers ---------- */
  function stepper(id, label, value, step, unitLabel, min) {
    return `<div class="step">
      <div class="step-l">${esc(label)}</div>
      <div class="step-row">
        <button class="step-b" data-step="${id}" data-dir="-1" aria-label="decrease">−</button>
        <input class="step-i" id="${id}" type="number" inputmode="decimal" value="${esc(value)}" min="${min == null ? 0 : min}" step="${step}">
        <button class="step-b" data-step="${id}" data-dir="1" aria-label="increase">+</button>
      </div>
      <div class="step-u">${esc(unitLabel || '')}</div>
    </div>`;
  }
  function bindSteppers(root, onChange) {
    $$('[data-step]', root).forEach(btn => {
      btn.onclick = () => {
        const input = $('#' + btn.dataset.step, root) || document.getElementById(btn.dataset.step);
        if (!input) return;
        const step = parseFloat(input.step) || 1;
        const min = parseFloat(input.min);
        let v = (parseFloat(input.value) || 0) + step * (+btn.dataset.dir);
        if (!isNaN(min)) v = Math.max(min, v);
        input.value = String(Math.round(v * 1000) / 1000);
        haptic(9);
        if (onChange) onChange(input);
      };
    });
  }
  function tiles(items) {
    return `<div class="tiles${items.length === 3 ? ' tiles-3' : ''}">` + items.map(t =>
      `<div class="tile"><div class="tile-l">${esc(t.label)}</div>
       <div class="tile-v">${esc(t.value)}${t.unit ? `<small>${esc(t.unit)}</small>` : ''}</div>
       ${t.delta ? `<div class="tile-d ${t.deltaDir || 'flat'}">${t.deltaDir === 'up' ? icon('up', 13) : t.deltaDir === 'down' ? icon('down', 13) : ''}${esc(t.delta)}</div>` : ''}</div>`).join('') + '</div>';
  }
  function section(title, action) {
    return `<div class="sec"><span class="sec-t">${esc(title)}</span>${action ? `<button class="sec-a" ${action.id ? `id="${action.id}"` : ''} ${action.href ? `data-href="${esc(action.href)}"` : ''}>${esc(action.label)}</button>` : ''}</div>`;
  }
  function empty(title, sub, iconName) {
    return `<div class="empty">${icon(iconName || 'dumb', 34)}<b>${esc(title)}</b><span class="dim">${esc(sub || '')}</span></div>`;
  }

  global.UI = {
    esc, $, $$, icon, ICONS, COLORS, COLOR_KEYS, colorOf,
    timeAgo, dateFull, clock, dur, mmss,
    haptic, beep, toast, prBurst,
    artHtml, machineCard, machineRow, lastLine, avatar, dayCard, dayHeading, setSummary,
    sheet, closeSheet, confirmSheet, rest,
    register, go, render, parseHash, currentRoute,
    stepper, bindSteppers, tiles, section, empty
  };
})(window);
