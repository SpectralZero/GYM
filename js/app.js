/* =========================================================
   IRONLOG — bootstrap
   ========================================================= */
(function (global) {
  'use strict';
  const { $, $$, esc, icon, toast, haptic } = UI;
  let deferredInstall = null;

  /* ---------- header ---------- */
  function paintHeader() {
    const p = Store.activeProfile();
    const av = $('#whoAv');
    if (p) {
      const photo = Store.profilePhoto(p.id);
      if (photo) { av.innerHTML = `<img src="${photo}" alt="">`; av.classList.add('has-img'); }
      else { av.textContent = p.emoji || (p.name || '?').charAt(0).toUpperCase(); av.classList.remove('has-img'); }
      av.style.background = UI.colorOf(p);
      av.classList.toggle('p2', p.color === 'orange');
      $('#whoName').textContent = p.name;
      const other = Store.otherProfile();
      $('#whoSub').textContent = other ? 'tap to switch to ' + other.name : 'tap to edit';
    }
    paintSync(Sync.status());
    paintRibbon();
  }

  /* `st` may arrive from the sync event, which carries only the phase —
     whether sync is configured always comes from Sync itself. */
  function paintSync(st) {
    st = st || Sync.status();
    const dot = $('#syncDot');
    dot.className = 'sync-dot ' + (!Sync.isOn() ? 'off'
      : st.phase === 'busy' ? 'busy' : st.phase === 'error' ? 'err' : st.phase === 'ok' ? 'ok' : '');
  }

  function paintRibbon() {
    const live = Store.liveSession();
    const rib = $('#liveRibbon');
    const onWorkout = (location.hash || '').indexOf('workout') > -1;
    if (!live || onWorkout) { rib.hidden = true; $('#fab').classList.toggle('live', !!live); return; }
    const st = Store.sessionStats(live.id);
    $('#liveName').textContent = 'Workout running';
    $('#liveMeta').textContent = UI.dur(Date.now() - live.start) + ' · ' + st.setCount + ' sets';
    rib.hidden = false;
    $('#fab').classList.add('live');
  }

  /* ---------- profile switcher ---------- */
  function whoSheet() {
    const ps = Store.profiles();
    UI.sheet('Who is training?', ps.map(p => `
      <button class="pickrow" data-sw="${esc(p.id)}">
        ${UI.avatar(p, 42)}
        <span class="pickrow-t">${esc(p.name)}<span>${Store.streak(p.id)} day streak · ${Store.totals(p.id).sets} sets</span></span>
        ${p.id === Store.activeId() ? `<span class="check">${icon('check', 22)}</span>` : ''}
      </button>`).join('') +
      (ps.length < 2 ? `<button class="btn btn-wide" style="margin-top:14px" id="whoAdd">${icon('plus', 18)} Add your friend</button>` : '') +
      `<button class="btn btn-ghost btn-wide" style="margin-top:9px" id="whoEdit">Edit people &amp; settings</button>`,
      b => {
        $$('[data-sw]', b).forEach(btn => btn.onclick = () => {
          Store.setActive(btn.dataset.sw);
          haptic(16); UI.closeSheet(); paintHeader(); UI.render();
          toast('Now logging as ' + Store.activeProfile().name);
        });
        const add = $('#whoAdd', b); if (add) add.onclick = () => { UI.closeSheet(); Screens.profileSheet(null); };
        $('#whoEdit', b).onclick = () => { UI.closeSheet(); UI.go('/settings'); };
      });
  }

  /* ---------- onboarding ---------- */
  function onboarding() {
    const el = $('#onboarding');
    el.hidden = false;
    el.innerHTML = `<div class="ob-in">
      <div class="ob-mark"><svg viewBox="0 0 64 64" width="54" height="54"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M14 32h36"/><rect x="6" y="22" width="8" height="20" rx="3" fill="currentColor" stroke="none"/><rect x="50" y="22" width="8" height="20" rx="3" fill="currentColor" stroke="none"/><rect x="16" y="26" width="6" height="12" rx="2"/><rect x="42" y="26" width="6" height="12" rx="2"/></g></svg></div>
      <h1 class="ob-h">Never forget<br>a weight again.</h1>
      <p class="ob-p">Every machine remembers what you lifted last time — and tells you if you improved.</p>

      <div class="ob-card">
        <div class="ob-feat">${icon('dumb', 22)}<div><b>${Store.allExercises().length} exercises, ready to go</b><p>Most come with a reference picture. Replace any of them with a photo of the real machine in your gym.</p></div></div>
        <div class="ob-feat">${icon('up', 22)}<div><b>Last time vs today</b><p>Open a machine and the first thing you see is the weight and reps from your last session.</p></div></div>
        <div class="ob-feat">${icon('crown', 22)}<div><b>Two people, one app</b><p>Separate histories, plus a Versus screen to see who is ahead on every machine.</p></div></div>
      </div>

      <div class="ob-card">
        <h3><span class="ob-n">1</span> Who are you?</h3>
        <div class="field"><label>Your name</label><input id="obA" placeholder="e.g. Jamal" autocomplete="off" enterkeyhint="next"></div>
        <h3 style="margin-top:20px"><span class="ob-n p2">2</span> Your training partner</h3>
        <div class="field"><label>Friend's name <span style="text-transform:none;letter-spacing:0;color:var(--muted)">(you can add them later)</span></label><input id="obB" placeholder="e.g. Omar" autocomplete="off" enterkeyhint="done"></div>
        <button class="btn btn-primary btn-wide btn-lg" id="obGo" style="margin-top:6px">Start lifting</button>
      </div>

      <div class="ob-card">
        <h3><span class="ob-n" style="background:var(--surface-3)">${icon('share', 14)}</span> Already using IronLog somewhere else?</h3>
        <p class="dim" style="margin-bottom:12px">Set it up on your PC or another phone already? Don't start over — paste the
        pair code from that device (<b>Settings → Add another device</b>) and your whole history comes across.</p>
        <div class="field"><textarea id="obCode" placeholder="paste pair code here" autocapitalize="none" spellcheck="false"
          style="font-family:ui-monospace,monospace;font-size:12px;min-height:84px"></textarea></div>
        <button class="btn btn-wide" id="obJoin">Restore from pair code</button>
        <div id="obMsg" class="dim" style="margin-top:10px"></div>
      </div>

      <p class="dim" style="text-align:center;margin-top:18px">Everything is stored on this device. Each phone keeps its own copy
      until you connect them with GitHub sync.</p>
    </div>`;

    $('#obGo', el).onclick = () => {
      const a = $('#obA', el).value.trim() || 'Me';
      const b = $('#obB', el).value.trim();
      const pa = Store.addProfile(a, 'blue', '💪');
      if (b) Store.addProfile(b, 'orange', '🔥');
      Store.setActive(pa.id);
      Store.setDevice('onboarded', true);
      el.hidden = true;
      haptic([16, 40, 16]);
      start();
    };
    /* second device: pull everything down instead of creating a fresh profile,
       which is what caused duplicate people when joining after onboarding */
    $('#obJoin', el).onclick = async () => {
      const btn = $('#obJoin', el), msg = $('#obMsg', el);
      const code = ($('#obCode', el).value || '').trim();
      if (!code) { msg.textContent = 'Paste the code first.'; return; }
      btn.disabled = true; btn.textContent = 'Connecting…';
      msg.textContent = 'Reading the code…';
      try {
        const conf = Sync.readPairCode(code);
        await Sync.testConnection(conf);
        msg.textContent = 'Downloading your history…';
        const r = await Sync.sync({ message: 'IronLog: another device joined' });
        if (r.error) throw new Error(r.error);
        if (!Store.profiles().length) {
          throw new Error('Connected, but that repo has no data yet. Open the app on the first device, tap the sync icon, then try again.');
        }
        Store.setActive(Store.profiles()[0].id);
        Store.setDevice('onboarded', true);
        el.hidden = true;
        haptic([16, 40, 16]);
        start();
        toast('Restored ' + Store.profiles().length + ' ' + (Store.profiles().length === 1 ? 'person' : 'people') + ' and ' + Store.sets().length + ' sets', 'good');
      } catch (e) {
        msg.innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>';
        btn.disabled = false; btn.textContent = 'Restore from pair code';
      }
    };

    $('#obA', el).focus();
  }

  /* ---------- install prompt ---------- */
  function showInstallBar() {
    if (!deferredInstall || Store.device().installDismissed) return;
    if (global.matchMedia('(display-mode: standalone)').matches) return;
    if ($('#installBar')) return;
    const bar = document.createElement('div');
    bar.id = 'installBar';
    bar.className = 'live-ribbon install-bar';
    bar.innerHTML = `<span style="color:var(--accent);flex:none">${icon('dumb', 20)}</span>
      <span class="live-txt"><b>Install IronLog</b> · full screen, works offline</span>
      <button class="live-go" id="ibGo">Install</button>
      <button class="icon-btn" id="ibX" style="width:32px;height:32px;flex:none">${icon('x', 16)}</button>`;
    $('#app').appendChild(bar);
    $('#ibGo').onclick = async () => {
      bar.remove();
      try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { }
      deferredInstall = null;
    };
    $('#ibX').onclick = () => { bar.remove(); Store.setDevice('installDismissed', true); };
  }

  /* ---------- global events ---------- */
  function wireGlobal() {
    /* delegated navigation */
    document.addEventListener('click', e => {
      const close = e.target.closest('[data-close]');
      if (close) { UI.closeSheet(); return; }
      const href = e.target.closest('[data-href]');
      if (href) { UI.go(href.dataset.href.replace(/^#/, '')); return; }
      const x = e.target.closest('[data-x]');
      if (x) { haptic(9); UI.go('/x/' + x.dataset.x); return; }
    });

    $('#whoBtn').onclick = whoSheet;
    $('#settingsBtn').onclick = () => UI.go('/settings');
    $('#syncBtn').onclick = async () => {
      if (!Sync.isOn()) { Screens.syncSheet(); return; }
      paintSync({ phase: 'busy' });
      const r = await Sync.sync();
      toast(r.error || (r.pushed ? 'Saved to GitHub' : 'Up to date'), r.error ? 'bad' : 'good');
      UI.render();
    };
    $('#liveGo').onclick = () => UI.go('/workout');

    $$('.tab').forEach(t => t.onclick = () => { haptic(8); UI.go('/' + t.dataset.route); });

    /* rest timer controls */
    $('#restSkip').onclick = () => { UI.rest.stop(); haptic(10); };
    $('#restPlus').onclick = () => UI.rest.add(15);
    $('#restMinus').onclick = () => UI.rest.add(-15);

    /* routing */
    global.addEventListener('hashchange', () => { UI.render(); paintRibbon(); });

    /* back button closes overlays first */
    global.addEventListener('popstate', () => { UI.closeSheet(); });

    /* sync status + auto sync */
    Store.on('sync', paintSync);
    Store.on('dirty', () => Sync.nudge());
    Store.on('synced', () => { paintHeader(); });
    Store.on('replaced', () => { paintHeader(); UI.render(); });
    Store.on('photos-ready', () => { if ($('#sheet').hidden) UI.render(); });

    let lastAuto = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      paintRibbon();
      if (Sync.isOn() && Date.now() - lastAuto > 120000) { lastAuto = Date.now(); Sync.sync(); }
    });
    global.addEventListener('online', () => { if (Sync.isOn()) Sync.sync(); });

    /* keep the live ribbon fresh */
    setInterval(paintRibbon, 30000);

    /* install */
    global.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; setTimeout(showInstallBar, 2500); });

    /* stop double-tap zoom fighting the steppers */
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  }

  /* ---------- service worker ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const t = $('#toast');
            t.className = 'toast good';
            t.innerHTML = '<span>New version ready</span><button class="live-go" id="swR">Reload</button>';
            t.hidden = false;
            $('#swR').onclick = () => { nw.postMessage('skipWaiting'); location.reload(); };
          }
        });
      });
    }).catch(e => console.warn('sw', e));
  }

  /* ---------- start ---------- */
  function start() {
    $('#app').hidden = false;
    document.documentElement.setAttribute('data-theme', Store.device().theme === 'light' ? 'light' : 'dark');
    document.querySelector('meta[name=theme-color]').setAttribute('content', Store.device().theme === 'light' ? '#f9f9f7' : '#0d0d0d');
    paintHeader();

    /* an abandoned session shouldn't run forever */
    const live = Store.liveSession();
    if (live && Date.now() - live.start > 8 * 3600e3) Store.endSession(live.id);

    const target = location.hash && location.hash.length > 2 ? location.hash : (Store.device().lastRoute || '#/home');
    if (location.hash !== target) UI.go(target.replace(/^#/, ''), true);
    UI.render();

    if (Sync.isOn()) Sync.sync();
  }

  async function boot() {
    await Store.load();
    /* Photos are a bonus on top of the illustrations, so they load in the
       background — a slow or blocked IndexedDB must never hold the app on
       the splash screen. The screen repaints once they arrive. */
    Store.preloadPhotos().catch(() => { });
    wireGlobal();
    registerSW();

    setTimeout(() => { $('#splash').classList.add('gone'); setTimeout(() => { $('#splash').hidden = true; }, 340); }, 260);

    if (!Store.profiles().length || !Store.device().onboarded) onboarding();
    else start();
  }

  global.App = { paintHeader, paintRibbon, paintSync, whoSheet, showInstallBar, start };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
