/* =========================================================
   IRONLOG — screens
   ========================================================= */
(function (global) {
  'use strict';
  const { esc, $, $$, icon, section, tiles, empty, toast, haptic } = UI;

  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

  /* =========================================================
     HOME
  ========================================================= */
  UI.register('home', function (host) {
    const p = Store.activeProfile();
    const live = Store.liveSession();
    const t = Store.totals();
    const wv = Store.weekVolume(null, 8);
    const thisWeek = wv[wv.length - 1] || { volume: 0, days: 0 };
    const lastWeek = wv[wv.length - 2] || { volume: 0 };
    const st = Store.streak();
    const recent = Store.recentExercises(null, 8);
    const favs = Store.allExercises().filter(e => Store.isFav(e.id));
    const prs = Store.prList(null, 40);
    const recentPRs = prs.filter(r => Store.isPR(r.set) && (Date.now() - r.set.t) < 21 * 864e5).slice(0, 3);

    let html = '';

    /* hero */
    if (live) {
      const s = Store.sessionStats(live.id);
      html += `<div class="hero ${p && p.color === 'orange' ? 'p2' : ''}">
        <div class="hero-k">Workout in progress</div>
        <div class="hero-v">${esc(UI.dur(Date.now() - live.start))}</div>
        <div class="sub">${s.setCount} set${s.setCount === 1 ? '' : 's'} · ${s.exercises.length} machine${s.exercises.length === 1 ? '' : 's'} · ${esc(Store.fmtVol(s.volume))} moved</div>
        <div class="hero-row"><button class="btn btn-primary grow" data-href="#/workout">${icon('play', 18)} Continue</button></div>
      </div>`;
    } else {
      const greet = (h => h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')(new Date().getHours());
      html += `<div class="hero ${p && p.color === 'orange' ? 'p2' : ''}">
        <div class="hero-k">${esc(greet)}${p ? ', ' + esc((p.name || '').split(' ')[0]) : ''}</div>
        <div class="hero-v">${st > 0 ? esc(st + ' day streak') : 'Ready to lift'}</div>
        <div class="sub">${st > 0 ? 'Keep it alive — train today.' : t.days ? 'Last session ' + esc(UI.timeAgo(Store.sets().length ? Store.sets()[Store.sets().length - 1].t : 0)) + '.' : 'Log your first set and the app remembers forever.'}</div>
        <div class="hero-row">
          <button class="btn btn-primary grow" id="startBtn">${icon('play', 18)} Start workout</button>
          <button class="btn" data-href="#/machines" aria-label="Browse machines">${icon('grid', 18)}</button>
        </div>
      </div>`;
    }

    /* tiles */
    const volDelta = lastWeek.volume ? Math.round((thisWeek.volume - lastWeek.volume) / lastWeek.volume * 100) : null;
    html += `<div style="margin-top:12px">` + tiles([
      { label: 'This week', value: Store.volParts(thisWeek.volume).value, unit: Store.volParts(thisWeek.volume).unit, delta: volDelta == null ? '' : (volDelta > 0 ? '+' : '') + volDelta + '% vs last week', deltaDir: volDelta == null ? 'flat' : volDelta > 0 ? 'up' : volDelta < 0 ? 'down' : 'flat' },
      { label: 'Sessions', value: String(t.workouts), delta: thisWeek.days + ' day' + (thisWeek.days === 1 ? '' : 's') + ' this week' },
      { label: 'Streak', value: String(st), unit: 'd' },
      { label: 'Machines used', value: String(t.machines) }
    ]) + `</div>`;

    /* recent PRs */
    if (recentPRs.length) {
      html += section('New records');
      recentPRs.forEach(r => {
        html += `<button class="mrow card-tap" data-x="${esc(r.ex.id)}">
          <span class="mrow-art">${UI.artHtml(r.ex)}</span>
          <span class="mrow-b"><span class="mrow-n">${esc(r.ex.name)}</span><span class="mrow-s" style="color:var(--good)">personal best · ${esc(UI.timeAgo(r.set.t))}</span></span>
          <span class="mrow-r"><span class="mrow-w">${esc(setLabel(r.set, r.ex))}</span></span>
        </button>`;
      });
    }

    /* what you trained, day by day */
    const diary = Store.dayLog(null, 3);
    if (diary.length) {
      const total = Store.dayCount();
      html += section('Your training days', { label: total > 3 ? 'All ' + total : 'All', href: '#/history' });
      html += diary.map(d => UI.dayCard(d, { max: 6 })).join('');
    } else if (recent.length) {
      html += section('Last machines you used', { label: 'All', href: '#/machines' });
      html += '<div class="mgrid">' + recent.slice(0, 4).map(r => UI.machineCard(r.ex)).join('') + '</div>';
    } else {
      html += section('Get started');
      html += `<div class="card">${empty('No sets logged yet', 'Open Machines, pick what you trained, and type the weight. Next time the app tells you exactly what you did.', 'dumb')}
        <button class="btn btn-primary btn-wide" data-href="#/machines">Browse machines</button></div>`;
    }

    /* favourites */
    if (favs.length) {
      html += section('Your favourites');
      html += '<div class="mgrid">' + favs.slice(0, 6).map(e => UI.machineCard(e)).join('') + '</div>';
    }

    /* weekly volume */
    if (t.sets > 2) {
      html += section('Weekly volume');
      html += `<div class="chartcard"><div class="chart-h"><span class="chart-t">Total weight moved</span><span class="chart-s">last 8 weeks · ${esc(Store.unit())}</span></div><div id="hVol"></div></div>`;
    }

    host.innerHTML = html;

    const sb = $('#startBtn', host);
    if (sb) sb.onclick = () => { Store.startSession(); haptic(20); UI.go('/workout'); };
    if ($('#hVol', host)) {
      Charts.columns($('#hVol', host), {
        data: wv.map(w => ({ label: w.label, value: Math.round(Store.unit() === 'lb' ? w.volume / 0.45359237 : w.volume), sub: w.label + ' · ' + w.sets + ' sets' })),
        yFmt: v => v >= 1000 ? Math.round(v / 1000) + 'k' : String(v)
      });
    }
  });

  /* =========================================================
     HISTORY — every training day, newest first
  ========================================================= */
  let histShown = 20;
  UI.register('history', function (host) {
    const total = Store.dayCount();
    if (!total) {
      host.innerHTML = `<h1 class="h1">Training days</h1>
        <div class="card" style="margin-top:14px">${empty('Nothing logged yet', 'Every day you train gets its own card here, showing which machines you used and what you lifted.', 'dumb')}
        <button class="btn btn-primary btn-wide" data-href="#/machines">Choose a machine</button></div>`;
      return;
    }
    const days = Store.dayLog(null, histShown);
    const t = Store.totals();

    /* month separators, so scrolling back through a year stays readable */
    let out = '', lastMonth = '';
    days.forEach(d => {
      const m = new Date(d.ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (m !== lastMonth) { out += `<div class="daysep">${esc(m)}</div>`; lastMonth = m; }
      out += UI.dayCard(d);
    });

    host.innerHTML = `<h1 class="h1">Training days</h1>
      <p class="dim" style="margin-top:6px">${total} day${total === 1 ? '' : 's'} logged · ${t.sets} sets · ${esc(Store.fmtVol(t.volume))} lifted in total</p>
      ${out}
      ${total > days.length ? `<button class="btn btn-wide" style="margin-top:14px" id="hMore">Show ${Math.min(20, total - days.length)} more days</button>` : `<p class="dim" style="text-align:center;margin-top:16px">That's everything — your first day was ${esc(UI.dateFull(days[days.length - 1].ts))}.</p>`}`;

    const more = $('#hMore', host);
    if (more) more.onclick = () => { histShown += 20; UI.render(); };
  });

  /* =========================================================
     MACHINES
  ========================================================= */
  let mState = { q: '', group: 'all', fav: false };
  UI.register('machines', function (host, params) {
    if (params && params.arg && Machines.GROUPS.some(g => g.id === params.arg)) mState.group = params.arg;
    const view = Store.device().view || 'grid';

    host.innerHTML = `
      <div class="search">
        <span class="s-ico">${icon('search', 20)}</span>
        <input id="mq" type="search" placeholder="Search machines…" value="${esc(mState.q)}" autocomplete="off" enterkeyhint="search">
        <button class="s-clr" id="mqx" hidden aria-label="Clear">${icon('x', 18)}</button>
      </div>
      <div class="chips" id="mchips"></div>
      <div class="sec">
        <span class="sec-t" id="mcount"></span>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="sec-a" id="addCustom">+ Add machine</button>
          <button class="icon-btn" id="viewToggle" style="width:36px;height:36px" aria-label="Toggle view">${icon(view === 'grid' ? 'list' : 'grid', 19)}</button>
        </div>
      </div>
      <div id="mlist"></div>`;

    function chips() {
      const groups = [{ id: 'all', name: 'All' }].concat(Machines.GROUPS);
      $('#mchips', host).innerHTML =
        `<button class="chip ${mState.fav ? 'on' : ''}" data-fav="1">${icon('star', 14)} Favourites</button>` +
        groups.map(g => `<button class="chip ${mState.group === g.id && !mState.fav ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('');
      $$('#mchips [data-g]', host).forEach(b => b.onclick = () => { mState.group = b.dataset.g; mState.fav = false; chips(); list(); });
      $$('#mchips [data-fav]', host).forEach(b => b.onclick = () => { mState.fav = !mState.fav; chips(); list(); });
    }

    function list() {
      const q = mState.q.trim().toLowerCase();
      let items = Store.allExercises();
      if (mState.fav) items = items.filter(e => Store.isFav(e.id));
      else if (mState.group !== 'all') items = items.filter(e => e.group === mState.group);
      /* name and machine number only — matching the group name here would make
         "leg" return the whole Legs group, and the chips already do that job */
      if (q) items = items.filter(e => e.name.toLowerCase().indexOf(q) > -1 ||
        (Store.metaFor(e.id).num || '') === q ||
        (e.muscles || []).some(m => m.toLowerCase() === q));

      /* recently used first, then never-used, alphabetical inside */
      const lastMap = {};
      Store.sets({ p: Store.activeId() }).forEach(s => { lastMap[s.x] = Math.max(lastMap[s.x] || 0, s.t); });
      items.sort((a, b) => (lastMap[b.id] || 0) - (lastMap[a.id] || 0) || a.name.localeCompare(b.name));

      $('#mcount', host).textContent = items.length + ' machine' + (items.length === 1 ? '' : 's');
      const el = $('#mlist', host);
      if (!items.length) { el.innerHTML = empty('Nothing found', q ? 'Try another word, or add it as a custom machine.' : 'Add your own machine with the + button.', 'search'); return; }
      el.innerHTML = view === 'grid'
        ? '<div class="mgrid">' + items.map(e => UI.machineCard(e)).join('') + '</div>'
        : items.map(e => UI.machineRow(e)).join('');
    }

    chips(); list();
    const qi = $('#mq', host);
    $('#mqx', host).hidden = !mState.q;
    qi.oninput = () => { mState.q = qi.value; $('#mqx', host).hidden = !mState.q; list(); };
    $('#mqx', host).onclick = () => { mState.q = ''; qi.value = ''; $('#mqx', host).hidden = true; list(); qi.focus(); };
    $('#viewToggle', host).onclick = () => { Store.setDevice('view', view === 'grid' ? 'list' : 'grid'); UI.render(); };
    $('#addCustom', host).onclick = customMachineSheet;
  });

  function customMachineSheet() {
    UI.sheet('Add a machine', `
      <div class="field"><label>Name</label><input id="cmName" placeholder="e.g. Plate-loaded Chest Press" autocomplete="off"></div>
      <div class="field"><label>Muscle group</label><select id="cmGroup">${Machines.GROUPS.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>
      <div class="row2">
        <div class="field"><label>Machine number</label><input id="cmNum" inputmode="numeric" placeholder="optional"></div>
        <div class="field"><label>Weight step</label><select id="cmStep"><option value="1">1</option><option value="1.25">1.25</option><option value="2.5" selected>2.5</option><option value="5">5</option><option value="10">10</option></select></div>
      </div>
      <div class="field"><label>Illustration</label><select id="cmArt">${Machines.ART_KEYS.map(k => `<option value="${k}" ${k === 'generic' ? 'selected' : ''}>${esc(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</option>`).join('')}</select>
      <div class="hint">You can replace this with a photo of the real machine after saving.</div></div>
      <button class="btn btn-primary btn-wide" id="cmSave">Save machine</button>`,
      b => {
        $('#cmSave', b).onclick = () => {
          const name = $('#cmName', b).value.trim();
          if (!name) { toast('Give it a name first', 'bad'); return; }
          const ex = Store.addCustom({ name, group: $('#cmGroup', b).value, art: $('#cmArt', b).value, step: parseFloat($('#cmStep', b).value) });
          const num = $('#cmNum', b).value.trim();
          if (num) Store.setMeta(ex.id, { num });
          UI.closeSheet(); toast('Machine added', 'good'); UI.go('/x/' + ex.id);
        };
      });
  }

  /* =========================================================
     EXERCISE / LOGGING  — the core screen
  ========================================================= */
  const setLabel = (s, ex) => {
    if (!s) return '—';
    if (ex.metric === 'time') return UI.mmss(s.s || 0);
    if (ex.metric === 'cardio') return Math.round((s.s || 0) / 60) + ' min';
    if (ex.metric === 'reps' && !s.w) return s.r + ' reps';
    return Store.fmtW(s.w, false) + ' × ' + s.r;
  };

  UI.register('exercise', function (host, params) {
    const ex = Store.exercise(params.id);
    if (!ex) { host.innerHTML = empty('Machine not found', 'It may have been deleted.'); return; }
    const meta = Store.metaFor(ex.id);
    const lp = Store.lastPerformance(ex.id);
    const todayKey = Store.dayKey(Date.now());
    const todaySets = Store.sets({ x: ex.id, p: Store.activeId() }).filter(s => Store.dayKey(s.t) === todayKey);
    const groupName = (Machines.GROUPS.find(g => g.id === ex.group) || {}).name || '';
    const fav = Store.isFav(ex.id);
    const photo = Store.photoCached(ex.id);

    /* ---- last time card ---- */
    let lastCard;
    if (lp) {
      const b = lp.best;
      const dS = lp.deltaScore;
      const better = dS != null && (ex.inverse ? dS < 0 : dS > 0);
      const worse = dS != null && (ex.inverse ? dS > 0 : dS < 0);
      const isAllTime = lp.allTimeBest && lp.allTimeBest.id === b.id;
      lastCard = `<div class="lastcard ${isAllTime ? 'pr' : ''}">
        <div class="lastcard-k">Last time · ${esc(UI.timeAgo(lp.date))}</div>
        <div class="lastcard-main">
          ${ex.metric === 'time' || ex.metric === 'cardio'
          ? `<div class="lastcard-w">${esc(setLabel(b, ex))}</div>`
          : `<div class="lastcard-w">${esc(Store.fmtW(b.w, false))}<small> ${esc(Store.unit())}</small></div>
               <div class="lastcard-x">× ${b.r}</div>`}
          <div class="grow"></div>
          ${dS == null ? '' : `<span class="delta ${better ? 'up' : worse ? 'down' : 'flat'}">${better ? icon('up', 13) : worse ? icon('down', 13) : icon('eq', 13)}${esc(better || worse ? fmtDelta(lp, ex) : 'same')}</span>`}
        </div>
        <div class="setpills">${lp.sets.map((s, i) => `<span class="setpill ${s.id === b.id ? 'best' : ''}">${esc(setLabel(s, ex))}</span>`).join('')}</div>
        <div class="lastcard-meta">
          ${lp.prevDate ? `<span>Before that: <b>${esc(setLabel(lp.prevBest, ex))}</b> (${esc(UI.timeAgo(lp.prevDate))})</span>` : ''}
          ${lp.allTimeBest ? `<span>All-time best: <b>${esc(setLabel(lp.allTimeBest, ex))}</b></span>` : ''}
          <span>${lp.totalDays} session${lp.totalDays === 1 ? '' : 's'} logged</span>
        </div>
      </div>`;
    } else {
      lastCard = `<div class="lastcard"><div class="lastcard-k">First time on this machine</div>
        <div class="sub" style="margin-top:8px">Log the weight you used. From now on this card shows exactly what you did last time, and whether you improved.</div></div>`;
    }

    host.innerHTML = `
      <div class="xhero">
        ${UI.artHtml(ex)}
        <div class="xhero-grad"></div>
        <button class="xhero-back" id="xBack" aria-label="Back">${icon('back', 20)}</button>
        <button class="xhero-cam" id="xCam">${icon('cam', 17)} ${photo ? 'Change photo' : ex.photo ? 'Use my own photo' : 'Add real photo'}</button>
        ${meta.num ? `<span class="mcard-num xhero-num">#${esc(meta.num)}</span>` : ''}
        <input type="file" id="xFile" accept="image/*" capture="environment" hidden>
      </div>

      <div class="xtitle">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <h1 class="h1 grow">${esc(ex.name)}</h1>
          <button class="icon-btn" id="xFav" aria-label="Favourite" style="color:${fav ? 'var(--warn)' : 'var(--muted)'}">${icon(fav ? 'star' : 'starO', 22)}</button>
          <button class="icon-btn" id="xMore" aria-label="Options">${icon('note', 21)}</button>
        </div>
        <div class="xtags">
          <span class="xtag">${esc(groupName)}</span>
          <span class="xtag">${esc(ex.equip)}</span>
          ${ex.unilateral ? '<span class="xtag">per side</span>' : ''}
          ${ex.inverse ? '<span class="xtag">less = stronger</span>' : ''}
        </div>
        ${meta.note ? `<p class="dim" style="margin-top:10px">${esc(meta.note)}</p>` : ex.tip ? `<p class="dim" style="margin-top:10px">${esc(ex.tip)}</p>` : ''}
      </div>

      <div style="margin-top:14px">${lastCard}</div>

      <div class="logform" id="logForm"></div>

      <div id="todayWrap"></div>
      <div id="chartWrap"></div>
      <div id="histWrap"></div>`;

    $('#xBack', host).onclick = () => history.length > 1 ? history.back() : UI.go('/machines');
    $('#xFav', host).onclick = e => { const on = Store.toggleFav(ex.id); haptic(12); e.currentTarget.style.color = on ? 'var(--warn)' : 'var(--muted)'; e.currentTarget.innerHTML = icon(on ? 'star' : 'starO', 22); };
    $('#xMore', host).onclick = () => machineOptions(ex);
    $('#xCam', host).onclick = () => $('#xFile', host).click();
    $('#xFile', host).onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      toast('Saving photo…');
      try { const url = await Store.fileToDataUrl(f); await Store.setPhoto(ex.id, url); toast('Photo saved', 'good'); UI.render(); Sync.nudge(4000); }
      catch (err) { toast('Could not read that image', 'bad'); }
    };

    renderLogForm(host, ex, lp);
    renderToday(host, ex, todaySets);
    renderChart(host, ex);
    renderHistory(host, ex);
  });

  function fmtDelta(lp, ex) {
    if (ex.metric === 'time' || ex.metric === 'cardio') {
      const d = (lp.best.s || 0) - (lp.prevBest.s || 0);
      return (d > 0 ? '+' : '') + Math.round(d) + 's';
    }
    if (lp.deltaW) return (lp.deltaW > 0 ? '+' : '') + Store.fmtW(Math.abs(lp.deltaW) * (lp.deltaW < 0 ? -1 : 1), false) + ' ' + Store.unit();
    const dr = lp.best.r - lp.prevBest.r;
    if (dr) return (dr > 0 ? '+' : '') + dr + ' reps';
    return (lp.deltaScore > 0 ? '+' : '') + Store.round(lp.deltaScore, 1);
  }

  /* ---- the log form ---- */
  function renderLogForm(host, ex, lp) {
    const wrap = $('#logForm', host);
    const step = Store.stepFor(ex);
    const b = lp ? lp.best : null;
    const u = Store.unit();

    if (ex.metric === 'cardio') {
      wrap.innerHTML = `<div class="stepgrid">
          ${UI.stepper('inMin', 'Minutes', b ? Math.round((b.s || 0) / 60) : 20, 1, 'min')}
          ${UI.stepper('inLvl', 'Level / speed', b ? b.w || 8 : 8, 1, '')}
        </div>
        <button class="btn btn-primary btn-lg btn-wide" id="logBtn" style="margin-top:12px">${icon('plus', 20)} Log</button>`;
    } else if (ex.metric === 'time') {
      wrap.innerHTML = `<div class="stepgrid">
          ${UI.stepper('inSec', 'Seconds', b ? b.s || 45 : 45, 5, 'sec')}
          ${UI.stepper('inW', 'Added weight', b ? Store.toDisplay(b.w) : 0, step, u)}
        </div>
        <button class="btn btn-primary btn-lg btn-wide" id="logBtn" style="margin-top:12px">${icon('plus', 20)} Log</button>`;
    } else {
      const startW = b ? Store.toDisplay(b.w) : 0;
      const startR = b ? b.r : 10;
      wrap.innerHTML = `
        <div class="stepgrid">
          ${UI.stepper('inW', ex.metric === 'reps' ? 'Added weight' : 'Weight', startW, step, u + (ex.unilateral ? ' / side' : ''))}
          ${UI.stepper('inR', 'Reps', startR, 1, 'reps')}
        </div>
        <div class="quickw" id="quickW"></div>
        <div style="display:flex;gap:9px;margin-top:12px">
          <button class="btn btn-primary btn-lg grow" id="logBtn">${icon('plus', 20)} Log set</button>
          <button class="btn btn-lg" id="restBtn" aria-label="Rest timer">${icon('timer', 20)}</button>
        </div>
        <div id="plateWrap"></div>`;
    }

    /* quick weight suggestions */
    const qw = $('#quickW', wrap);
    if (qw) {
      const cands = [];
      if (b) { cands.push(Store.toDisplay(b.w)); cands.push(Store.round(Store.toDisplay(b.w) + step, 2)); cands.push(Store.round(Store.toDisplay(b.w) + step * 2, 2)); }
      const at = lp && lp.allTimeBest ? Store.toDisplay(lp.allTimeBest.w) : null;
      if (at != null) cands.push(at);
      const seen = new Set(); const uniq = cands.filter(v => v > 0 && !seen.has(v) && seen.add(v)).slice(0, 5);
      qw.innerHTML = uniq.map((v, i) => `<button class="qw" data-w="${v}">${esc(v)} ${esc(Store.unit())}${i === 0 && b ? ' <span style="opacity:.6">last</span>' : ''}</button>`).join('');
      $$('.qw', qw).forEach(btn => btn.onclick = () => {
        $('#inW', wrap).value = btn.dataset.w;
        $$('.qw', qw).forEach(x => x.classList.remove('on')); btn.classList.add('on');
        haptic(9); plates();
      });
    }

    function plates() {
      const pw = $('#plateWrap', wrap);
      if (!pw) return;
      if (ex.equip !== 'barbell') { pw.innerHTML = ''; return; }
      const totalKg = Store.toKg(parseFloat($('#inW', wrap).value) || 0);
      const bar = Store.settings().barWeight || 20;
      const perSide = (totalKg - bar) / 2;
      if (perSide <= 0) { pw.innerHTML = `<p class="dim" style="margin-top:10px">Bar only (${bar} kg).</p>`; return; }
      let left = perSide; const used = [];
      PLATES.forEach(p => { while (left >= p - 0.01) { used.push(p); left -= p; } });
      pw.innerHTML = `<p class="dim" style="margin-top:10px">Per side: ${used.length ? used.map(p => `<b style="color:var(--text-2)">${p}</b>`).join(' + ') : '—'}${left > 0.02 ? ` <span style="color:var(--warn)">(+${Store.round(left, 2)} short)</span>` : ''}</p>`;
    }
    UI.bindSteppers(wrap, plates);
    plates();

    const rb = $('#restBtn', wrap);
    if (rb) rb.onclick = () => UI.rest.start(Store.settings().restSec || 90, ex.name);

    $('#logBtn', wrap).onclick = () => doLog(ex, wrap);
  }

  function doLog(ex, wrap) {
    let data = { x: ex.id };
    if (ex.metric === 'cardio') {
      const mins = parseFloat($('#inMin', wrap).value) || 0;
      if (mins <= 0) { toast('Enter the minutes', 'bad'); return; }
      data.s = Math.round(mins * 60); data.w = parseFloat($('#inLvl', wrap).value) || 0; data.r = 0;
    } else if (ex.metric === 'time') {
      const secs = parseFloat($('#inSec', wrap).value) || 0;
      if (secs <= 0) { toast('Enter the seconds', 'bad'); return; }
      data.s = Math.round(secs); data.w = Store.toKg(parseFloat($('#inW', wrap).value) || 0); data.r = 0;
    } else {
      const reps = parseInt($('#inR', wrap).value, 10) || 0;
      const w = Store.toKg(parseFloat($('#inW', wrap).value) || 0);
      if (reps <= 0) { toast('How many reps?', 'bad'); return; }
      if (w <= 0 && ex.metric !== 'reps') { toast('Enter the weight', 'bad'); return; }
      data.r = reps; data.w = w;
    }

    /* attach to a live session, opening one automatically on the first set */
    let live = Store.liveSession();
    if (!live) live = Store.startSession();
    data.sid = live.id;

    const s = Store.addSet(data);
    const pr = Store.isPR(s);
    haptic(pr ? [26, 50, 26] : 16);
    if (pr) UI.prBurst(setLabel(s, ex) + (ex.metric === 'weight' ? ' ' + Store.unit() : ''));
    else { UI.beep(660, 90, .12); toast('Set logged'); }

    Sync.nudge();
    if (Store.settings().autoRest !== false && (Store.settings().restSec || 0) > 0) {
      setTimeout(() => UI.rest.start(Store.settings().restSec, ex.name), pr ? 1700 : 260);
    }
    UI.render();
  }

  /* ---- today's sets ---- */
  function renderToday(host, ex, todaySets) {
    const el = $('#todayWrap', host);
    if (!todaySets.length) { el.innerHTML = ''; return; }
    const vol = todaySets.reduce((a, s) => a + s.w * s.r, 0);
    const best = Store.bestSet(todaySets, ex);
    el.innerHTML = section('Today · ' + todaySets.length + ' sets' + (vol ? ' · ' + Store.fmtVol(vol) : '')) +
      '<div class="setlist">' + todaySets.map((s, i) => `
        <div class="setrow">
          <span class="setrow-n ${s.id === best.id ? 'pr' : ''}">${i + 1}</span>
          <span class="setrow-v">${esc(setLabel(s, ex))} ${ex.metric === 'weight' ? `<small>${esc(Store.unit())}</small>` : ''}</span>
          ${ex.metric === 'weight' ? `<span class="setrow-e">${esc(Store.fmtW(Store.e1rm(s.w, s.r), false))} e1RM</span>` : ''}
          <button class="setrow-x" data-del="${esc(s.id)}" aria-label="Delete set">${icon('trash', 17)}</button>
        </div>`).join('') + '</div>';
    $$('[data-del]', el).forEach(b => b.onclick = async () => {
      if (await UI.confirmSheet('Delete this set?', 'It will be removed from your history.', 'Delete', true)) {
        Store.removeSet(b.dataset.del); haptic(14); Sync.nudge(); UI.render();
      }
    });
  }

  /* ---- progress chart ---- */
  let chartMode = 'top';
  function renderChart(host, ex) {
    const el = $('#chartWrap', host);
    const series = Store.exerciseSeries(ex.id);
    if (series.length < 2) { el.innerHTML = ''; return; }
    const modes = ex.metric === 'weight'
      ? [['top', 'Top set'], ['e1rm', 'Est. 1RM'], ['volume', 'Volume']]
      : [['top', ex.metric === 'time' ? 'Seconds' : 'Best'], ['volume', 'Volume']];
    if (!modes.some(m => m[0] === chartMode)) chartMode = 'top';

    el.innerHTML = section('Progress') + `<div class="chartcard">
      <div class="chart-h"><span class="chart-t">${esc((modes.find(m => m[0] === chartMode) || modes[0])[1])}</span>
      <span class="seg" id="cMode">${modes.map(m => `<button data-m="${m[0]}" class="${chartMode === m[0] ? 'on' : ''}">${esc(m[1])}</button>`).join('')}</span></div>
      <div id="cPlot"></div></div>`;

    const pick = d => chartMode === 'e1rm' ? d.e1rm : chartMode === 'volume' ? d.volume : (ex.metric === 'time' ? d.top : d.top);
    const pts = series.map(d => ({
      t: d.ts,
      y: ex.metric === 'time' ? (chartMode === 'volume' ? d.volume : d.top) : Store.unit() === 'lb' ? Store.round(pick(d) / 0.45359237, 1) : Store.round(pick(d), 1),
      meta: d.sets + ' sets · best ' + d.top + '×' + d.reps
    }));
    Charts.line($('#cPlot', el), {
      series: [{ name: ex.name, color: 'var(--accent)', points: pts }],
      yFmt: v => chartMode === 'volume' ? (v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v))) : String(Store.round(v, 1)),
      zeroBase: chartMode === 'volume',
      aria: ex.name + ' progress'
    });
    $$('#cMode button', el).forEach(b => b.onclick = () => { chartMode = b.dataset.m; renderChart(host, ex); });
  }

  /* ---- full history ---- */
  function renderHistory(host, ex) {
    const el = $('#histWrap', host);
    const all = Store.sets({ x: ex.id, p: Store.activeId() });
    if (!all.length) { el.innerHTML = ''; return; }
    const days = Store.groupByDay(all);
    const keys = Object.keys(days).sort().reverse();
    const shown = keys.slice(0, 12);
    el.innerHTML = section('History · ' + keys.length + ' sessions') + '<div class="hist">' + shown.map(k => {
      const list = days[k];
      const best = Store.bestSet(list, ex);
      const vol = list.reduce((a, s) => a + s.w * s.r, 0);
      return `<div class="histday">
        <div class="histday-h"><span class="histday-d">${esc(UI.dateFull(list[0].t))}</span>
          <span class="histday-m">${list.length} sets${vol ? ' · ' + esc(Store.fmtVol(vol)) : ''}</span></div>
        <div class="setpills">${list.map(s => `<span class="setpill ${s.id === best.id ? 'best' : ''}">${esc(setLabel(s, ex))}</span>`).join('')}</div>
      </div>`;
    }).join('') + '</div>' + (keys.length > shown.length ? `<p class="dim" style="text-align:center;margin-top:12px">+ ${keys.length - shown.length} older sessions</p>` : '');
  }

  /* ---- machine options sheet ---- */
  function machineOptions(ex) {
    const meta = Store.metaFor(ex.id);
    UI.sheet(ex.name, `
      <div class="row2">
        <div class="field"><label>Machine number</label><input id="moNum" inputmode="numeric" value="${esc(meta.num || '')}" placeholder="e.g. 14">
          <div class="hint">Shown on the card so you find it fast in the gym.</div></div>
        <div class="field"><label>Rest for this machine</label><input id="moRest" inputmode="numeric" value="${esc(meta.rest || '')}" placeholder="${Store.settings().restSec}s"></div>
      </div>
      <div class="field"><label>Your notes</label><textarea id="moNote" placeholder="Seat height 4, handles wide…">${esc(meta.note || '')}</textarea></div>
      <button class="btn btn-primary btn-wide" id="moSave">Save</button>
      ${Store.photoCached(ex.id) ? `<button class="btn btn-ghost btn-wide" style="margin-top:9px" id="moRmPhoto">Remove photo</button>` : ''}
      ${ex.custom ? `<button class="btn btn-danger btn-wide" style="margin-top:9px" id="moDel">Delete this machine</button>` : ''}`,
      b => {
        $('#moSave', b).onclick = () => {
          Store.setMeta(ex.id, { num: $('#moNum', b).value.trim(), note: $('#moNote', b).value.trim(), rest: parseInt($('#moRest', b).value, 10) || null });
          UI.closeSheet(); toast('Saved', 'good'); Sync.nudge(); UI.render();
        };
        const rp = $('#moRmPhoto', b);
        if (rp) rp.onclick = async () => { await Store.clearPhoto(ex.id); UI.closeSheet(); UI.render(); toast('Photo removed'); };
        const dl = $('#moDel', b);
        if (dl) dl.onclick = async () => {
          UI.closeSheet();
          if (await UI.confirmSheet('Delete ' + ex.name + '?', 'Your logged sets stay in history but the machine disappears from the list.', 'Delete', true)) {
            Store.removeCustom(ex.id); UI.go('/machines');
          }
        };
      });
  }

  /* =========================================================
     WORKOUT MODE
  ========================================================= */
  UI.register('workout', function (host) {
    const live = Store.liveSession();
    if (!live) {
      const last = Store.sessions().filter(s => s.end)[0];
      host.innerHTML = `<h1 class="h1">Workout</h1>
        <p class="sub" style="margin-top:8px">Start a session to group today's sets together and get the rest timer between them.</p>
        <button class="btn btn-primary btn-lg btn-wide" id="woStart" style="margin-top:18px">${icon('play', 20)} Start workout</button>
        <button class="btn btn-wide" style="margin-top:10px" data-href="#/machines">${icon('grid', 19)} Just log a machine</button>
        ${last ? section('Last workout') + sessionCard(last) : ''}
        ${Store.sessions().filter(s => s.end).length > 1 ? section('Earlier') + Store.sessions().filter(s => s.end).slice(1, 8).map(sessionCard).join('') : ''}`;
      $('#woStart', host).onclick = () => { Store.startSession(); haptic(20); UI.render(); };
      return;
    }

    const stats = Store.sessionStats(live.id);
    const sets = Store.sets({ sid: live.id });
    const byEx = {};
    sets.forEach(s => (byEx[s.x] || (byEx[s.x] = [])).push(s));
    const order = Object.keys(byEx).sort((a, b) => byEx[b][byEx[b].length - 1].t - byEx[a][byEx[a].length - 1].t);

    host.innerHTML = `
      <div class="card" style="border-color:var(--accent)">
        <div class="wo-head">
          <div class="grow">
            <div class="tile-l">Elapsed</div>
            <div class="wo-timer" id="woClock">${esc(UI.dur(Date.now() - live.start))}</div>
          </div>
          <button class="btn btn-sm" id="woRest">${icon('timer', 17)} Rest</button>
          <button class="btn btn-sm btn-good" id="woFinish">${icon('check', 17)} Finish</button>
        </div>
        <div class="sub" style="margin-top:10px">${stats.setCount} sets · ${order.length} machines · ${esc(Store.fmtVol(stats.volume))} total${stats.reps ? ' · ' + stats.reps + ' reps' : ''}</div>
      </div>

      ${section('Machines in this workout', { label: '+ Add', href: '#/machines' })}
      <div id="woList"></div>`;

    const listEl = $('#woList', host);
    listEl.innerHTML = order.length ? order.map(xid => {
      const ex = Store.exercise(xid); if (!ex) return '';
      const list = byEx[xid];
      const best = Store.bestSet(list, ex);
      return `<div class="wo-ex">
        <button class="wo-ex-h" data-x="${esc(xid)}">
          <span class="wo-ex-art">${UI.artHtml(ex)}</span>
          <span class="wo-ex-n">${esc(ex.name)}<span>best ${esc(setLabel(best, ex))}${ex.metric === 'weight' ? ' ' + esc(Store.unit()) : ''}</span></span>
          <span class="wo-ex-c">${list.length} set${list.length === 1 ? '' : 's'}</span>
        </button>
        <div class="wo-ex-sets">${list.map(s => `<span class="setpill ${s.id === best.id ? 'best' : ''}">${esc(setLabel(s, ex))}</span>`).join('')}</div>
      </div>`;
    }).join('') : `<div class="card">${empty('Nothing logged yet', 'Pick a machine and log your first set.', 'dumb')}<button class="btn btn-primary btn-wide" data-href="#/machines">Choose a machine</button></div>`;

    const clock = $('#woClock', host);
    const tick = setInterval(() => {
      if (!document.body.contains(clock)) return clearInterval(tick);
      clock.textContent = UI.dur(Date.now() - live.start);
    }, 10000);

    $('#woRest', host).onclick = () => UI.rest.start(Store.settings().restSec || 90, '');
    $('#woFinish', host).onclick = () => finishSheet(live);
  });

  function sessionCard(s) {
    const st = Store.sessionStats(s.id);
    const names = st.exercises.map(x => (Store.exercise(x) || {}).name).filter(Boolean);
    return `<button class="mrow card-tap" data-href="#/session/${esc(s.id)}">
      <span class="mrow-art" style="background:var(--accent-w);color:var(--accent)">${icon('dumb', 24)}</span>
      <span class="mrow-b"><span class="mrow-n">${esc(UI.dateFull(s.start))}${s.title ? ' · ' + esc(s.title) : ''}</span>
        <span class="mrow-s">${st.setCount} sets · ${esc(names.slice(0, 2).join(', '))}${names.length > 2 ? ' +' + (names.length - 2) : ''}</span></span>
      <span class="mrow-r"><span class="mrow-w">${esc(Store.volParts(st.volume).value)}<small> ${esc(Store.volParts(st.volume).unit)}</small></span></span>
    </button>`;
  }

  function finishSheet(live) {
    const st = Store.sessionStats(live.id);
    const prs = Store.sets({ sid: live.id }).filter(s => Store.isPR(s));
    UI.sheet('Finish workout', `
      <div class="tiles" style="margin-bottom:14px">
        <div class="tile"><div class="tile-l">Duration</div><div class="tile-v">${esc(UI.dur(Date.now() - live.start))}</div></div>
        <div class="tile"><div class="tile-l">Sets</div><div class="tile-v">${st.setCount}</div></div>
        <div class="tile"><div class="tile-l">Volume</div><div class="tile-v">${esc(Store.volParts(st.volume).value)}<small>${esc(Store.volParts(st.volume).unit)}</small></div></div>
        <div class="tile"><div class="tile-l">New PRs</div><div class="tile-v" style="color:${prs.length ? 'var(--good)' : 'inherit'}">${prs.length}</div></div>
      </div>
      ${prs.length ? `<p class="sub" style="margin-bottom:14px">${prs.map(s => esc((Store.exercise(s.x) || {}).name) + ' — ' + esc(setLabel(s, Store.exercise(s.x) || {}))).join('<br>')}</p>` : ''}
      <div class="field"><label>Note (optional)</label><input id="fsNote" placeholder="Felt strong, low back tight…" value="${esc(live.note || '')}"></div>
      <button class="btn btn-good btn-wide btn-lg" id="fsDone">${icon('check', 20)} Finish &amp; save</button>
      <button class="btn btn-ghost btn-wide" style="margin-top:9px" data-close="1">Keep going</button>
      <button class="btn btn-danger btn-wide" style="margin-top:9px" id="fsDitch">Discard this workout</button>`,
      b => {
        $('#fsDone', b).onclick = () => {
          Store.endSession(live.id, $('#fsNote', b).value.trim());
          UI.closeSheet(); haptic([20, 60, 20]); toast('Workout saved', 'good'); Sync.nudge(1500); UI.go('/home');
        };
        $('#fsDitch', b).onclick = async () => {
          UI.closeSheet();
          if (await UI.confirmSheet('Discard workout?', 'Every set logged in this session will be deleted.', 'Discard', true)) {
            Store.removeSession(live.id); Sync.nudge(1500); toast('Workout discarded'); UI.go('/home');
          }
        };
      });
  }

  /* ---- past session detail ---- */
  UI.register('session', function (host, params) {
    const s = Store.sessions().find(x => x.id === params.id) || Store.getDoc().sessions.find(x => x.id === params.id);
    if (!s) { host.innerHTML = empty('Workout not found'); return; }
    const sets = Store.sets({ sid: s.id });
    const byEx = {};
    sets.forEach(x => (byEx[x.x] || (byEx[x.x] = [])).push(x));
    const st = Store.sessionStats(s.id);
    host.innerHTML = `<button class="btn btn-sm" id="sBack" style="margin-bottom:12px">${icon('back', 16)} Back</button>
      <h1 class="h1">${esc(UI.dateFull(s.start))}</h1>
      <p class="dim">${esc(UI.clock(s.start))}${s.end ? ' – ' + esc(UI.clock(s.end)) + ' · ' + esc(UI.dur(s.end - s.start)) : ' · still open'}</p>
      ${s.note ? `<p class="sub" style="margin-top:10px">“${esc(s.note)}”</p>` : ''}
      <div style="margin-top:14px">${tiles([
      { label: 'Sets', value: String(st.setCount) },
      { label: 'Volume', value: Store.volParts(st.volume).value, unit: Store.volParts(st.volume).unit },
      { label: 'Machines', value: String(st.exercises.length) }
    ])}</div>
      ${section('What you did')}
      ${Object.keys(byEx).map(xid => {
      const ex = Store.exercise(xid); if (!ex) return '';
      const best = Store.bestSet(byEx[xid], ex);
      return `<div class="wo-ex"><button class="wo-ex-h" data-x="${esc(xid)}">
          <span class="wo-ex-art">${UI.artHtml(ex)}</span>
          <span class="wo-ex-n">${esc(ex.name)}<span>${byEx[xid].length} sets</span></span>${icon('chev', 18)}</button>
          <div class="wo-ex-sets">${byEx[xid].map(x => `<span class="setpill ${x.id === best.id ? 'best' : ''}">${esc(setLabel(x, ex))}</span>`).join('')}</div></div>`;
    }).join('')}
      <button class="btn btn-danger btn-wide" style="margin-top:20px" id="sDel">${icon('trash', 18)} Delete this workout</button>`;
    $('#sBack', host).onclick = () => history.length > 1 ? history.back() : UI.go('/workout');
    $('#sDel', host).onclick = async () => {
      if (await UI.confirmSheet('Delete workout?', 'All sets from this session will be removed.', 'Delete', true)) {
        Store.removeSession(s.id); Sync.nudge(1500); UI.go('/workout');
      }
    };
  });

  /* =========================================================
     PROGRESS
  ========================================================= */
  UI.register('progress', function (host) {
    const t = Store.totals();
    if (!t.sets) {
      host.innerHTML = `<h1 class="h1">Progress</h1>` + `<div class="card" style="margin-top:14px">${empty('No data yet', 'Log a few sets and your charts, records and training calendar appear here.', 'dumb')}</div>`;
      return;
    }
    const wv = Store.weekVolume(null, 10);
    const bal = Store.groupBalance(null, 30);
    const maxBal = Math.max(...bal.map(b => b.value), 1);
    const prs = Store.prList();
    const bw = Store.bwSeries();

    host.innerHTML = `<h1 class="h1">Progress</h1>
      <div style="margin-top:14px">${tiles([
      { label: 'Workouts', value: String(t.workouts) },
      { label: 'Total sets', value: String(t.sets) },
      { label: 'Total lifted', value: Store.volParts(t.volume).value, unit: Store.volParts(t.volume).unit },
      { label: 'Training days', value: String(t.days) }
    ])}</div>

      ${section('Weekly volume')}
      <div class="chartcard"><div class="chart-h"><span class="chart-t">Weight moved per week</span><span class="chart-s">${esc(Store.unit())}</span></div><div id="pVol"></div></div>

      ${section('Training calendar')}
      <div class="chartcard"><div class="chart-h"><span class="chart-t">Last 17 weeks</span><span class="chart-s">${t.days} days trained</span></div><div id="pHeat"></div></div>

      ${section('Muscle balance · last 30 days')}
      <div class="chartcard"><div class="bal">${bal.map(b => `
        <div class="bal-r"><span class="bal-n">${esc(b.group.name)}</span>
        <span class="bal-t"><span class="bal-f" style="width:${Math.round(b.value / maxBal * 100)}%"></span></span>
        <span class="bal-v">${esc(Store.fmtVolShort(b.value))}</span></div>`).join('')}</div></div>

      ${section('Bodyweight', { label: '+ Log', id: 'bwAdd' })}
      <div class="chartcard">${bw.length > 1 ? '<div id="pBw"></div>' : `<p class="dim" style="padding:6px 4px">${bw.length ? 'Latest: ' + esc(Store.fmtW(bw[bw.length - 1].kg)) : 'Track your bodyweight to see it against your lifts.'}</p>`}</div>

      ${section('Personal records · ' + prs.length + ' machines')}
      <div id="pPrs"></div>`;

    Charts.columns($('#pVol', host), {
      data: wv.map(w => ({ label: w.label, value: Math.round(Store.unit() === 'lb' ? w.volume / 0.45359237 : w.volume), sub: w.label + ' · ' + w.sets + ' sets · ' + w.days + ' days' })),
      yFmt: v => v >= 1000 ? Math.round(v / 1000) + 'k' : String(v), height: 140
    });
    Charts.heatmap($('#pHeat', host), Store.heatmapData(null, 118));
    if (bw.length > 1) {
      Charts.line($('#pBw', host), {
        series: [{ name: 'Bodyweight', color: 'var(--accent)', points: bw.map(b => ({ t: b.t, y: Store.toDisplay(b.kg) })) }],
        yFmt: v => String(Store.round(v, 1)), height: 120
      });
    }
    $('#pPrs', host).innerHTML = prs.map(r => `
      <button class="mrow card-tap" data-x="${esc(r.ex.id)}">
        <span class="mrow-art">${UI.artHtml(r.ex)}</span>
        <span class="mrow-b"><span class="mrow-n">${esc(r.ex.name)}</span><span class="mrow-s">${r.days} session${r.days === 1 ? '' : 's'} · ${esc(UI.timeAgo(r.last))}</span></span>
        <span class="mrow-r"><span class="mrow-w">${esc(setLabel(r.set, r.ex))}</span></span>
      </button>`).join('');

    $('#bwAdd', host).onclick = () => {
      const last = bw.length ? Store.toDisplay(bw[bw.length - 1].kg) : 80;
      UI.sheet('Log bodyweight', `<div class="stepgrid" style="grid-template-columns:1fr">${UI.stepper('bwV', 'Bodyweight', last, 0.1, Store.unit())}</div>
        <button class="btn btn-primary btn-wide btn-lg" style="margin-top:14px" id="bwSave">Save</button>`,
        b => {
          UI.bindSteppers(b);
          $('#bwSave', b).onclick = () => {
            const v = parseFloat($('#bwV', b).value) || 0;
            if (v <= 0) { toast('Enter a weight', 'bad'); return; }
            Store.addBw(Store.toKg(v)); UI.closeSheet(); toast('Logged', 'good'); Sync.nudge(); UI.render();
          };
        });
    };
  });

  /* =========================================================
     VERSUS — you against your friend
  ========================================================= */
  UI.register('versus', function (host) {
    const ps = Store.profiles();
    if (ps.length < 2) {
      host.innerHTML = `<h1 class="h1">Versus</h1>
        <div class="card" style="margin-top:14px">${empty('Add your friend', 'Two profiles share this app. Add the second person and you can compare every machine, side by side.', 'dumb')}
        <button class="btn btn-primary btn-wide" id="vsAdd">Add second person</button></div>`;
      $('#vsAdd', host).onclick = () => profileSheet(null);
      return;
    }
    const A = Store.activeProfile(), B = Store.otherProfile();
    const rowsA = Store.prList(A.id), rowsB = Store.prList(B.id);
    const mapB = {}; rowsB.forEach(r => mapB[r.ex.id] = r);
    const shared = rowsA.filter(r => mapB[r.ex.id]);
    let winA = 0, winB = 0;
    shared.forEach(r => {
      const o = mapB[r.ex.id];
      if (Store.isBetter(r.score, o.score, r.ex)) winA++; else if (Store.isBetter(o.score, r.score, r.ex)) winB++;
    });
    const tA = Store.totals(A.id), tB = Store.totals(B.id);

    /* A 0–0 scoreboard against someone with no data reads as "broken".
       Say what is actually missing, and how to fix it. */
    if (!tB.sets || !tA.sets) {
      const who = !tB.sets ? B : A, other = !tB.sets ? A : B;
      const sy = Sync.status();
      host.innerHTML = `<h1 class="h1">Versus</h1>
        <div class="vs-head" style="margin-top:14px">
          <div class="vs-p">${UI.avatar(A, 56)}<span class="vs-n">${esc(A.name)}</span><span class="vs-sc">${tA.sets ? '–' : '0'}</span><span class="crown"></span></div>
          <div class="vs-mid">LEADS</div>
          <div class="vs-p">${UI.avatar(B, 56)}<span class="vs-n">${esc(B.name)}</span><span class="vs-sc">${tB.sets ? '–' : '0'}</span><span class="crown"></span></div>
        </div>
        <div class="card" style="margin-top:12px">
          ${empty('Waiting for ' + who.name,
        who.name + ' has no sets on this phone yet, so there is nothing to compare. As soon as ' +
        (sy.on ? 'their phone syncs, both of your histories appear here automatically.'
          : 'you connect the two phones with sync, both histories appear here automatically.'), 'dumb')}
          ${sy.on
          ? `<button class="btn btn-primary btn-wide" id="vsSync">Check for ${esc(who.name)}'s data now</button>
               <p class="dim" style="margin-top:10px;text-align:center">${sy.last ? 'Last synced ' + esc(UI.timeAgo(sy.last)) : 'Not synced yet'}</p>`
          : `<button class="btn btn-primary btn-wide" id="vsSetup">Set up sync between phones</button>
               <p class="dim" style="margin-top:10px;text-align:center">Without sync each phone keeps its own history and they can never be compared.</p>`}
        </div>
        ${tA.sets ? section('Meanwhile — your own numbers') + tiles([
          { label: 'Workouts', value: String(tA.workouts) },
          { label: 'Sets', value: String(tA.sets) },
          { label: 'Lifted', value: Store.volParts(tA.volume).value, unit: Store.volParts(tA.volume).unit },
          { label: 'Machines', value: String(tA.machines) }
        ]) : ''}`;
      const sb = $('#vsSync', host);
      if (sb) sb.onclick = async () => {
        sb.disabled = true; sb.textContent = 'Checking…';
        const r = await Sync.sync();
        toast(r.error || 'Up to date', r.error ? 'bad' : 'good');
        UI.render();
      };
      const su = $('#vsSetup', host);
      if (su) su.onclick = syncSheet;
      return;
    }

    host.innerHTML = `<h1 class="h1">Versus</h1>
      <div class="vs-head" style="margin-top:14px">
        <div class="vs-p">${UI.avatar(A, 56)}<span class="vs-n">${esc(A.name)}</span><span class="vs-sc">${winA}</span><span class="crown">${winA > winB ? icon('crown', 18) : ''}</span></div>
        <div class="vs-mid">LEADS</div>
        <div class="vs-p">${UI.avatar(B, 56)}<span class="vs-n">${esc(B.name)}</span><span class="vs-sc">${winB}</span><span class="crown">${winB > winA ? icon('crown', 18) : ''}</span></div>
      </div>
      <div class="legend" style="justify-content:center">
        <span class="legend-i"><i class="legend-k" style="background:${UI.colorOf(A)}"></i>${esc(A.name)}</span>
        <span class="legend-i"><i class="legend-k" style="background:${UI.colorOf(B)}"></i>${esc(B.name)}</span>
      </div>

      ${section('Totals')}
      <div class="vs-row"><div class="vs-row-n"><span>Total weight lifted</span></div>
        ${Charts.vsBar({ value: tA.volume }, { value: tB.volume }, v => Store.fmtVol(v))}</div>
      <div class="vs-row"><div class="vs-row-n"><span>Workouts finished</span></div>
        ${Charts.vsBar({ value: tA.workouts }, { value: tB.workouts }, v => String(v))}</div>
      <div class="vs-row"><div class="vs-row-n"><span>Sets logged</span></div>
        ${Charts.vsBar({ value: tA.sets }, { value: tB.sets }, v => String(v))}</div>

      ${section(shared.length ? 'Machine by machine · ' + shared.length : 'Machine by machine')}
      <div id="vsList"></div>`;

    $('#vsList', host).innerHTML = shared.length ? shared.map(r => {
      const o = mapB[r.ex.id];
      const aWins = Store.isBetter(r.score, o.score, r.ex);
      const bWins = Store.isBetter(o.score, r.score, r.ex);
      return `<div class="vs-row">
        <div class="vs-row-n"><span>${esc(r.ex.name)}</span><em>${aWins ? esc(A.name) + ' ahead' : bWins ? esc(B.name) + ' ahead' : 'tied'}</em></div>
        ${Charts.vsBar(
        { value: r.ex.metric === 'time' ? (r.set.s || 0) : Store.toDisplay(r.set.w), sub: r.ex.metric === 'weight' ? '×' + r.set.r : '' },
        { value: o.ex.metric === 'time' ? (o.set.s || 0) : Store.toDisplay(o.set.w), sub: o.ex.metric === 'weight' ? '×' + o.set.r : '' },
        v => String(Store.round(v, 1)))}
      </div>`;
    }).join('') : `<div class="card">${empty('No shared machines yet', 'Once you both log the same machine it shows up here.', 'dumb')}</div>`;
  });

  /* =========================================================
     SETTINGS
  ========================================================= */
  UI.register('settings', function (host) {
    const s = Store.settings(), d = Store.device();
    const ps = Store.profiles();
    const sy = Sync.status();

    host.innerHTML = `<h1 class="h1">Settings</h1>

      ${section('People', { label: ps.length < 2 ? '+ Add person' : '', id: 'stAddP' })}
      <div class="card">${ps.map(p => `
        <button class="pickrow" data-p="${esc(p.id)}">
          ${UI.avatar(p, 38)}
          <span class="pickrow-t">${esc(p.name)}<span>${Store.totals(p.id).workouts} workouts · ${Store.totals(p.id).sets} sets</span></span>
          ${p.id === Store.activeId() ? `<span class="check">${icon('check', 22)}</span>` : ''}
        </button>`).join('')}</div>
      <p class="dim" style="margin-top:8px">Tap a person to edit them. Use the avatar at the top of the app to switch quickly.</p>

      ${section('Units & training')}
      <div class="card">
        <div class="switch"><span class="switch-t">Weight unit<span>All history converts automatically</span></span>
          <span class="seg" id="stUnit"><button data-u="kg" class="${s.unit === 'kg' ? 'on' : ''}">kg</button><button data-u="lb" class="${s.unit === 'lb' ? 'on' : ''}">lb</button></span></div>
        <div class="switch"><span class="switch-t">Rest timer<span>Seconds between sets</span></span>
          <span class="seg" id="stRest">${[60, 90, 120, 180].map(v => `<button data-r="${v}" class="${s.restSec === v ? 'on' : ''}">${v}</button>`).join('')}</span></div>
        <div class="switch"><span class="switch-t">Auto-start rest<span>Timer opens after every set</span></span>
          <button class="tgl ${s.autoRest !== false ? 'on' : ''}" id="stAuto" role="switch"></button></div>
        <div class="switch"><span class="switch-t">Vibration</span><button class="tgl ${s.vibrate ? 'on' : ''}" id="stVib" role="switch"></button></div>
        <div class="switch"><span class="switch-t">Sounds</span><button class="tgl ${s.sound ? 'on' : ''}" id="stSnd" role="switch"></button></div>
        <div class="switch"><span class="switch-t">Barbell weight<span>Used by the plate calculator</span></span>
          <span class="seg" id="stBar">${[15, 20, 25].map(v => `<button data-b="${v}" class="${(s.barWeight || 20) === v ? 'on' : ''}">${v}</button>`).join('')}</span></div>
        <div class="switch"><span class="switch-t">Theme</span>
          <span class="seg" id="stTheme"><button data-t="dark" class="${d.theme !== 'light' ? 'on' : ''}">Dark</button><button data-t="light" class="${d.theme === 'light' ? 'on' : ''}">Light</button></span></div>
      </div>

      ${section('Sync between phones')}
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:var(--text-2)">${icon('github', 26)}</span>
          <span class="switch-t grow">GitHub sync<span>${sy.on ? esc((Sync.cfg().owner || '') + '/' + (Sync.cfg().repo || '')) + (sy.last ? ' · synced ' + esc(UI.timeAgo(sy.last)) : '') : 'Off — data stays on this phone only'}</span></span>
        </div>
        <div style="display:flex;gap:9px;margin-top:14px">
          <button class="btn grow" id="stSync">${sy.on ? 'Change' : 'Set up'}</button>
          ${sy.on ? `<button class="btn btn-primary grow" id="stSyncNow">Sync now</button>` : `<button class="btn grow" id="stJoin">Join with code</button>`}
        </div>
        ${sy.on ? `<button class="btn btn-ghost btn-wide" style="margin-top:9px" id="stPair">${icon('share', 18)} Add another device / invite your friend</button>` : ''}
        ${sy.msg ? `<p class="dim" style="margin-top:10px">${esc(sy.msg)}</p>` : ''}
      </div>

      ${section('Storage')}
      <div class="card">
        ${(() => {
        const si = Store.storageInfo();
        const kb = si.bytes < 1048576 ? Math.round(si.bytes / 1024) + ' KB' : (si.bytes / 1048576).toFixed(2) + ' MB';
        const tone = si.pct > 85 ? 'var(--bad)' : si.pct > 60 ? 'var(--warn)' : 'var(--good)';
        return `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px">
            <span class="switch-t" style="flex:none">${esc(kb)} of 5 MB used</span>
            <span class="dim tnum">${si.pct < 1 ? '<1' : Math.round(si.pct)}%</span>
          </div>
          <div class="bal-t" style="display:block"><span class="bal-f" style="display:block;width:${Math.max(1.5, si.pct)}%;background:${tone}"></span></div>
          <p class="dim" style="margin-top:10px">
            ${si.setCount.toLocaleString()} sets stored, about ${Math.round(si.perSet)} bytes each.
            ${si.yearsLeft != null
            ? `At your current pace (${si.perYear.toLocaleString()} sets a year) there is room for roughly <b style="color:var(--text-2)">${si.yearsLeft > 20 ? '20+' : si.yearsLeft.toFixed(1)} more years</b>.`
            : 'Keep logging for a few weeks and this will estimate how many years of room you have left.'}
            ${Sync.isOn() ? ' Your GitHub repo holds the same data with far more room.' : ''}
          </p>
          ${si.full ? `<p style="color:var(--bad);margin-top:8px;font-size:13px"><b>Storage is full.</b> Download a backup now, then erase and restore to compact it.</p>` : ''}`;
      })()}
      </div>

      ${section('Backup')}
      <div class="card">
        <button class="btn btn-wide" id="stExport">Download backup file</button>
        <button class="btn btn-wide" style="margin-top:9px" id="stImport">Restore / merge from file</button>
        <input type="file" id="stFile" accept="application/json,.json" hidden>
        <p class="dim" style="margin-top:10px">A backup holds every set, machine note and setting. Photos live on the phone and in GitHub sync.</p>
      </div>

      ${section('Danger zone')}
      <div class="card">
        <button class="btn btn-danger btn-wide" id="stWipe">Erase all data on this phone</button>
      </div>
      <p class="dim" style="text-align:center;margin-top:22px">${Store.allExercises().length} exercises · works offline · your data, your repo</p>
      <p class="dim" style="text-align:center;margin-top:6px;font-size:11.5px">Reference photos &amp; exercise data from <b>wger.de</b> (CC-BY-SA). See ATTRIBUTION.md.</p>`;

    /* people */
    const addP = $('#stAddP', host); if (addP) addP.onclick = () => profileSheet(null);
    $$('[data-p]', host).forEach(b => b.onclick = () => profileSheet(b.dataset.p));

    /* toggles */
    $$('#stUnit button', host).forEach(b => b.onclick = () => { Store.setSetting('unit', b.dataset.u); Sync.nudge(); UI.render(); });
    $$('#stRest button', host).forEach(b => b.onclick = () => { Store.setSetting('restSec', +b.dataset.r); UI.render(); });
    $$('#stBar button', host).forEach(b => b.onclick = () => { Store.setSetting('barWeight', +b.dataset.b); UI.render(); });
    $$('#stTheme button', host).forEach(b => b.onclick = () => {
      Store.setDevice('theme', b.dataset.t);
      document.documentElement.setAttribute('data-theme', b.dataset.t);
      document.querySelector('meta[name=theme-color]').setAttribute('content', b.dataset.t === 'light' ? '#f9f9f7' : '#0d0d0d');
      UI.render();
    });
    const tgl = (id, key) => { const el = $('#' + id, host); el.onclick = () => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); Store.setSetting(key, v); haptic(10); }; };
    tgl('stVib', 'vibrate'); tgl('stSnd', 'sound');
    const auto = $('#stAuto', host); auto.onclick = () => { const v = !auto.classList.contains('on'); auto.classList.toggle('on', v); Store.setSetting('autoRest', v); };

    /* sync */
    $('#stSync', host).onclick = syncSheet;
    const jn = $('#stJoin', host); if (jn) jn.onclick = joinSheet;
    const now = $('#stSyncNow', host);
    if (now) now.onclick = async () => { now.textContent = 'Syncing…'; const r = await Sync.sync(); now.textContent = 'Sync now'; toast(r.error || (r.pushed ? 'Pushed to GitHub' : 'Up to date'), r.error ? 'bad' : 'good'); UI.render(); };
    const pair = $('#stPair', host); if (pair) pair.onclick = pairSheet;

    /* backup */
    $('#stExport', host).onclick = () => {
      const blob = new Blob([Store.exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ironlog-backup-' + Store.dayKey(Date.now()) + '.json';
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Backup downloaded', 'good');
    };
    $('#stImport', host).onclick = () => $('#stFile', host).click();
    $('#stFile', host).onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const text = await f.text();
      UI.sheet('Restore backup', `<p class="sub" style="margin-bottom:16px">Merge keeps everything from both sides — safest. Replace throws away what is on this phone.</p>
        <button class="btn btn-primary btn-wide" id="imMerge">Merge with my data</button>
        <button class="btn btn-danger btn-wide" style="margin-top:9px" id="imRep">Replace my data</button>`,
        b => {
          const run = mode => { try { Store.importJson(text, mode); UI.closeSheet(); toast('Restored', 'good'); Sync.nudge(2000); UI.render(); } catch (err) { toast(err.message, 'bad'); } };
          $('#imMerge', b).onclick = () => run('merge');
          $('#imRep', b).onclick = () => run('replace');
        });
    };

    $('#stWipe', host).onclick = async () => {
      if (await UI.confirmSheet('Erase everything?', 'Every set, machine note and photo on this phone is deleted. If GitHub sync is on, the data stays in your repo.', 'Erase', true)) {
        localStorage.clear();
        try { indexedDB.deleteDatabase('ironlog'); } catch (e) { }
        location.replace(location.pathname);
      }
    };
  });

  /* ---- profile editor ---- */
  function profileSheet(id) {
    const p = id ? Store.profile(id) : null;
    const EMOJI = ['💪', '🔥', '🦍', '🐺', '🦅', '⚡', '🏆', '🥇', '😤', '🧊'];
    const existingPhoto = p ? Store.profilePhoto(p.id) : null;
    UI.sheet(p ? 'Edit ' + p.name : 'Add person', `
      <div class="field" style="text-align:center">
        <div class="pf-av" id="pfAv"></div>
        <div class="pf-btns">
          <button class="btn btn-sm" id="pfPick">${icon('cam', 16)} ${existingPhoto ? 'Change picture' : 'Add picture'}</button>
          <button class="btn btn-sm btn-ghost" id="pfRm" ${existingPhoto ? '' : 'hidden'}>Remove</button>
        </div>
        <input type="file" id="pfFile" accept="image/*" hidden>
        <div class="hint" style="text-align:center">A picture syncs to your friend's phone too.</div>
      </div>
      <div class="field"><label>Name</label><input id="pfName" value="${esc(p ? p.name : '')}" placeholder="Your name" autocomplete="off"></div>
      <div class="field"><label>Colour</label><div class="swatches" id="pfCol">${UI.COLOR_KEYS.map(k =>
      `<button class="sw ${(p ? p.color : 'blue') === k ? 'on' : ''}" data-c="${k}" style="background:${UI.COLORS[k]}" aria-label="${k}"></button>`).join('')}</div></div>
      <div class="field"><label>Badge <span style="text-transform:none;letter-spacing:0;color:var(--muted)">(used when there is no picture)</span></label><div class="emojis" id="pfEm">${EMOJI.map(e =>
        `<button class="em ${(p ? p.emoji : '💪') === e ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <button class="btn btn-primary btn-wide btn-lg" id="pfSave">${p ? 'Save' : 'Add person'}</button>
      ${p && Store.profiles().length > 1 ? `<button class="btn btn-danger btn-wide" style="margin-top:9px" id="pfDel">Delete ${esc(p.name)} and their history</button>` : ''}`,
      b => {
        let color = p ? p.color : 'blue', emoji = p ? p.emoji : '💪';
        let newPhoto = null, dropPhoto = false;

        function paintAv() {
          const av = $('#pfAv', b);
          const src = newPhoto || (dropPhoto ? null : existingPhoto);
          av.style.background = UI.COLORS[color] || 'var(--accent)';
          av.innerHTML = src ? `<img src="${src}" alt="">` : esc(emoji);
          $('#pfRm', b).hidden = !src;
        }
        paintAv();

        $$('#pfCol .sw', b).forEach(x => x.onclick = () => { color = x.dataset.c; $$('#pfCol .sw', b).forEach(y => y.classList.toggle('on', y === x)); haptic(8); paintAv(); });
        $$('#pfEm .em', b).forEach(x => x.onclick = () => { emoji = x.dataset.e; $$('#pfEm .em', b).forEach(y => y.classList.toggle('on', y === x)); haptic(8); paintAv(); });

        $('#pfPick', b).onclick = () => $('#pfFile', b).click();
        $('#pfFile', b).onchange = async e => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          try {
            newPhoto = await Store.fileToDataUrl(f, 480, 0.82);
            dropPhoto = false; paintAv(); haptic(10);
          } catch (err) { toast('Could not read that image', 'bad'); }
        };
        $('#pfRm', b).onclick = () => { newPhoto = null; dropPhoto = true; paintAv(); haptic(8); };

        $('#pfSave', b).onclick = async () => {
          const name = $('#pfName', b).value.trim();
          if (!name) { toast('Name required', 'bad'); return; }
          const btn = $('#pfSave', b); btn.disabled = true;
          let id;
          if (p) { Store.updateProfile(p.id, { name, color, emoji }); id = p.id; }
          else { const np = Store.addProfile(name, color, emoji); Store.setActive(np.id); id = np.id; }
          if (newPhoto) await Store.setProfilePhoto(id, newPhoto);
          else if (dropPhoto) await Store.clearProfilePhoto(id);
          UI.closeSheet(); Sync.nudge(); App.paintHeader(); UI.render(); toast('Saved', 'good');
        };
        const del = $('#pfDel', b);
        if (del) del.onclick = async () => {
          UI.closeSheet();
          if (await UI.confirmSheet('Delete ' + p.name + '?', 'Their sets and workouts are deleted too. This cannot be undone.', 'Delete', true)) {
            Store.updateProfile(p.id, { d: true });
            Store.getDoc().sets.filter(x => x.p === p.id).forEach(x => { x.d = true; x.u = Store.now(); });
            Store.getDoc().sessions.filter(x => x.p === p.id).forEach(x => { x.d = true; x.u = Store.now(); });
            Store.save();
            const rest = Store.profiles()[0];
            if (rest) Store.setActive(rest.id);
            Sync.nudge(); App.paintHeader(); UI.go('/settings');
          }
        };
      });
  }

  /* ---- sync setup ---- */
  function syncSheet() {
    const c = Sync.cfg() || {};
    UI.sheet('GitHub sync', `
      <p class="sub" style="margin-bottom:16px">Your log lives in one JSON file in a <b>private</b> GitHub repo. Both phones read and write it, so you and your friend always see the same history. Free, and nobody else can read it.</p>
      <div class="card" style="background:var(--surface-2);margin-bottom:16px">
        <b style="font-size:14px">One-time setup</b>
        <ol class="dim" style="margin:8px 0 0;padding-left:18px;line-height:1.7">
          <li>Create a <b>private</b> repo, e.g. <code>ironlog-data</code></li>
          <li>GitHub → Settings → Developer settings → <b>Fine-grained tokens</b></li>
          <li>Give it access to that one repo, permission <b>Contents: Read and write</b></li>
          <li>Paste the token below</li>
        </ol>
      </div>
      <div class="row2">
        <div class="field"><label>GitHub user</label><input id="syOwner" value="${esc(c.owner || '')}" placeholder="your-username" autocomplete="off" autocapitalize="none"></div>
        <div class="field"><label>Repo name</label><input id="syRepo" value="${esc(c.repo || '')}" placeholder="ironlog-data" autocomplete="off" autocapitalize="none"></div>
      </div>
      <div class="field"><label>Token</label><input id="syTok" type="password" value="${esc(c.token || '')}" placeholder="github_pat_…" autocomplete="off">
        <div class="hint">Stored only on this phone. Never written into the synced file.</div></div>
      <div class="row2">
        <div class="field"><label>Branch</label><input id="syBranch" value="${esc(c.branch || 'main')}" autocomplete="off"></div>
        <div class="field"><label>File path</label><input id="syPath" value="${esc(c.path || 'ironlog-data.json')}" autocomplete="off"></div>
      </div>
      <button class="btn btn-primary btn-wide btn-lg" id="syTest">Connect &amp; sync</button>
      ${Sync.isOn() ? `<button class="btn btn-danger btn-wide" style="margin-top:9px" id="syOff">Turn sync off</button>` : ''}
      <div id="syMsg" class="dim" style="margin-top:12px"></div>`,
      b => {
        $('#syTest', b).onclick = async () => {
          const cand = {
            owner: $('#syOwner', b).value.trim(), repo: $('#syRepo', b).value.trim(),
            token: $('#syTok', b).value.trim(), branch: $('#syBranch', b).value.trim() || 'main',
            path: $('#syPath', b).value.trim() || 'ironlog-data.json'
          };
          if (!cand.owner || !cand.repo || !cand.token) { $('#syMsg', b).textContent = 'Fill user, repo and token.'; return; }
          const btn = $('#syTest', b); btn.disabled = true; btn.textContent = 'Checking…';
          try {
            const info = await Sync.testConnection(cand);
            $('#syMsg', b).innerHTML = 'Connected to <b>' + esc(info.full) + '</b>' + (info.private ? ' (private)' : ' <span style="color:var(--warn)">— this repo is PUBLIC, anyone can read your log</span>');
            btn.textContent = 'Syncing…';
            const r = await Sync.sync({ message: 'IronLog: first sync' });
            UI.closeSheet();
            toast(r.error || 'Sync is on', r.error ? 'bad' : 'good');
            App.paintHeader(); UI.render();
          } catch (e) {
            $('#syMsg', b).innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>';
            btn.disabled = false; btn.textContent = 'Connect & sync';
          }
        };
        const off = $('#syOff', b);
        if (off) off.onclick = () => { Sync.setCfg(null); UI.closeSheet(); toast('Sync off'); App.paintHeader(); UI.render(); };
      });
  }

  function pairSheet() {
    let code = '';
    try { code = Sync.makePairCode(); } catch (e) { toast(e.message, 'bad'); return; }
    UI.sheet('Add another device', `
      <p class="sub" style="margin-bottom:14px">This code connects any device to the same history — <b>your own phone as well as your friend's</b>.
      On the other device, paste it into the box on the welcome screen, or into <b>Settings → Join with code</b> if it is already set up.</p>
      <div class="field"><label>Pair code</label><textarea id="prCode" readonly style="font-family:ui-monospace,monospace;font-size:12px;min-height:110px">${esc(code)}</textarea></div>
      <button class="btn btn-primary btn-wide" id="prCopy">Copy code</button>
      <button class="btn btn-wide" style="margin-top:9px" id="prShare">${icon('share', 18)} Share…</button>
      <p class="dim" style="margin-top:12px">The code contains your GitHub token, so only send it to your training partner.</p>`,
      b => {
        $('#prCopy', b).onclick = async () => {
          try { await navigator.clipboard.writeText(code); toast('Copied', 'good'); }
          catch (e) { $('#prCode', b).select(); document.execCommand('copy'); toast('Copied', 'good'); }
        };
        $('#prShare', b).onclick = async () => {
          if (navigator.share) { try { await navigator.share({ title: 'IronLog pair code', text: code }); } catch (e) { } }
          else toast('Sharing not supported — copy it instead');
        };
      });
  }

  function joinSheet() {
    UI.sheet('Join with code', `
      <p class="sub" style="margin-bottom:14px">Paste the pair code your friend sent you. Your existing sets are kept and merged.</p>
      <div class="field"><label>Pair code</label><textarea id="jnCode" placeholder="paste here" style="font-family:ui-monospace,monospace;font-size:12px;min-height:110px"></textarea></div>
      <button class="btn btn-primary btn-wide btn-lg" id="jnGo">Join</button>
      <div id="jnMsg" class="dim" style="margin-top:12px"></div>`,
      b => {
        $('#jnGo', b).onclick = async () => {
          const btn = $('#jnGo', b);
          try {
            const cfg = Sync.readPairCode($('#jnCode', b).value);
            btn.disabled = true; btn.textContent = 'Connecting…';
            await Sync.testConnection(cfg);
            const r = await Sync.sync({ message: 'IronLog: joined from a second phone' });
            if (r.error) throw new Error(r.error);
            UI.closeSheet(); toast('Joined — data merged', 'good'); App.paintHeader(); UI.render();
          } catch (e) {
            $('#jnMsg', b).innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>';
            btn.disabled = false; btn.textContent = 'Join';
          }
        };
      });
  }

  global.Screens = { profileSheet, syncSheet, joinSheet, pairSheet, setLabel, customMachineSheet };
})(window);
