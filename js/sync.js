/* =========================================================
   IRONLOG — GitHub sync
   Uses a PRIVATE GitHub repo as the database. One JSON file holds the
   log; machine photos are stored beside it as .jpg files.
   No server, no monthly cost, and you own the data.

   The token lives only on the device (never in the synced document).
   Conflicts are resolved by merging both sides, so two phones can log
   at the same time without losing sets.
   ========================================================= */
(function (global) {
  'use strict';

  const API = 'https://api.github.com';
  let state = { phase: 'idle', at: 0, msg: '', pushing: false };
  let inflight = null;
  let dirtyTimer = null;

  /* ---------- base64 helpers (UTF-8 safe) ---------- */
  function b64enc(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  function b64dec(b64) {
    const clean = String(b64).replace(/\s/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- config ---------- */
  function cfg() { return Store.device().sync || null; }
  function isOn() { const c = cfg(); return !!(c && c.token && c.owner && c.repo); }
  function setCfg(next) {
    Store.setDevice('sync', next ? Object.assign({ branch: 'main', path: 'ironlog-data.json', photos: true }, next) : null);
    report(next ? 'idle' : 'off', next ? 'Ready' : 'Sync off');
  }
  function report(phase, msg) {
    state = { phase, at: Date.now(), msg: msg || '', pushing: state.pushing };
    Store.emit('sync', state);
  }
  function status() { return Object.assign({}, state, { on: isOn(), last: (cfg() || {}).lastSync || 0 }); }

  /* ---------- raw request ---------- */
  async function req(path, opts) {
    const c = cfg();
    if (!c) throw new Error('Sync is not configured');
    const res = await fetch(API + path, Object.assign({}, opts, {
      headers: Object.assign({
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }, (opts && opts.headers) || {})
    }));
    if (res.status === 404) return { notFound: true, status: 404 };
    if (res.status === 409) return { conflict: true, status: 409 };
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { }
      const err = new Error(friendlyError(res.status, detail));
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return {};
    return res.json();
  }
  function friendlyError(status, detail) {
    if (status === 401) return 'Token rejected — check it was copied fully and has not expired.';
    if (status === 403) return detail.indexOf('rate limit') > -1 ? 'GitHub rate limit hit — try again in a minute.' : 'Token lacks permission. It needs Contents: Read and write on this repo.';
    if (status === 422) return 'GitHub rejected the write (' + (detail || 'unprocessable') + ').';
    return 'GitHub error ' + status + (detail ? ': ' + detail : '');
  }
  const filePath = () => { const c = cfg(); return `/repos/${c.owner}/${c.repo}/contents/${encodeURI(c.path || 'ironlog-data.json')}`; };
  const refQ = () => { const c = cfg(); return `?ref=${encodeURIComponent(c.branch || 'main')}`; };

  /* ---------- setup check ---------- */
  async function testConnection(candidate) {
    const prev = Store.device().sync;
    Store.setDevice('sync', Object.assign({ branch: 'main', path: 'ironlog-data.json', photos: true }, candidate));
    try {
      const c = cfg();
      const repo = await req(`/repos/${c.owner}/${c.repo}`, { method: 'GET' });
      if (repo.notFound) throw new Error('Repo not found. Check owner/name, and that the token can see it.');
      if (!repo.permissions || !repo.permissions.push) throw new Error('This token cannot write to the repo. Give it Contents: Read and write.');
      return { ok: true, private: repo.private, full: repo.full_name, branch: repo.default_branch };
    } catch (e) {
      Store.setDevice('sync', prev);
      throw e;
    }
  }

  /* ---------- the document ---------- */
  async function pullRemote() {
    /* The contents API only inlines `content` for files up to 1 MB — past that
       the default media type errors outright. The "object" media type keeps
       working to 100 MB: it returns the metadata (including the sha we need to
       write back) with an empty content field and a download_url to fetch from. */
    const r = await req(filePath() + refQ(), {
      method: 'GET', headers: { Accept: 'application/vnd.github.object+json' }
    });
    if (r.notFound) return { doc: null, sha: null };
    let text;
    if (r.content && r.encoding !== 'none') text = b64dec(r.content);
    else if (r.download_url) text = await (await fetch(r.download_url)).text();
    else return { doc: null, sha: r.sha || null };
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('The data file in the repo is not valid JSON.'); }
    return { doc: parsed.doc || parsed, sha: r.sha };
  }

  async function pushRemote(docToPush, sha, message) {
    const c = cfg();
    const body = {
      message: message || ('IronLog sync — ' + new Date().toISOString()),
      /* compact, not indented: pretty-printing a log this size wastes 27% of
         every upload and download for whitespace nobody reads */
      content: b64enc(JSON.stringify({ app: 'ironlog', updated: new Date().toISOString(), doc: docToPush })),
      branch: c.branch || 'main'
    };
    if (sha) body.sha = sha;
    const r = await req(filePath(), { method: 'PUT', body: JSON.stringify(body) });
    if (r.conflict) return { conflict: true };
    return { sha: r.content && r.content.sha };
  }

  /* ---------- photos ---------- */
  const photoPath = exId => { const c = cfg(); const dir = (c.path || '').indexOf('/') > -1 ? c.path.split('/').slice(0, -1).join('/') + '/' : ''; return `${dir}photos/${exId}.jpg`; };

  async function pushPhoto(exId) {
    const c = cfg();
    const data = await Store.getPhoto(exId);
    if (!data) return null;
    const b64 = data.split(',')[1];
    const p = `/repos/${c.owner}/${c.repo}/contents/${encodeURI(photoPath(exId))}`;
    let sha = null;
    const head = await req(p + refQ(), { method: 'GET' });
    if (!head.notFound) sha = head.sha;
    const body = { message: 'IronLog photo: ' + exId, content: b64, branch: c.branch || 'main' };
    if (sha) body.sha = sha;
    const r = await req(p, { method: 'PUT', body: JSON.stringify(body) });
    return (r.content && r.content.sha) || sha;
  }
  async function pullPhoto(exId, ver) {
    const c = cfg();
    const p = `/repos/${c.owner}/${c.repo}/contents/${encodeURI(photoPath(exId))}`;
    const r = await req(p + refQ(), { method: 'GET' });
    if (r.notFound) return false;
    let b64 = r.content;
    if (!b64 && r.download_url) {
      const blob = await (await fetch(r.download_url)).blob();
      b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    }
    if (!b64) return false;
    await Store.setPhotoQuiet(exId, 'data:image/jpeg;base64,' + String(b64).replace(/\s/g, ''), ver);
    return true;
  }

  async function syncPhotos() {
    const c = cfg();
    if (!c || c.photos === false) return { up: 0, down: 0 };
    const doc = Store.getDoc();
    let up = 0, down = 0;

    /* machine photos live on doc.meta[exerciseId], profile pictures on the
       profile record — same shape, so one loop handles both */
    const targets = [];
    Object.keys(doc.meta || {}).forEach(k => { if (doc.meta[k] && doc.meta[k].photo) targets.push({ key: k, rec: doc.meta[k] }); });
    (doc.profiles || []).forEach(p => { if (p.photo) targets.push({ key: Store.profileKey(p.id), rec: p }); });

    for (const { key, rec } of targets) {
      try {
        if (rec.photo.local) {                                /* taken on this phone -> upload */
          const sha = await pushPhoto(key);
          if (sha) { rec.photo = { u: rec.photo.u, sha }; rec.u = Store.now(); up++; }
        } else {
          /* Compare versions, not mere presence: the other phone may have
             REPLACED a photo we already hold. */
          await Store.getPhoto(key);                          /* warms cache + version from disk */
          if (Store.photoVersion(key) !== rec.photo.u && await pullPhoto(key, rec.photo.u)) down++;
        }
      } catch (e) { console.warn('photo sync skipped', key, e.message); }
    }
    if (up) Store.save({ sync: false });
    return { up, down };
  }

  /* ---------- the main routine ---------- */
  async function sync(opts) {
    opts = opts || {};
    if (!isOn()) { report('off', 'Sync off'); return { skipped: true }; }
    if (inflight) return inflight;
    if (!navigator.onLine) { report('error', 'Offline — will sync later'); return { offline: true }; }

    inflight = (async () => {
      report('busy', 'Syncing…');
      try {
        let attempt = 0, pushed = false, sha = null, merged = null;
        while (attempt++ < 3) {
          const remote = await pullRemote();
          const local = Store.getDoc();
          merged = remote.doc ? Store.mergeDocs(local, remote.doc) : local;
          sha = remote.sha;

          const localStr = JSON.stringify(stripVolatile(local));
          const mergedStr = JSON.stringify(stripVolatile(merged));
          const remoteStr = remote.doc ? JSON.stringify(stripVolatile(remote.doc)) : null;

          if (mergedStr !== localStr) Store.replaceDoc(merged, { sync: false });

          if (mergedStr !== remoteStr) {
            const res = await pushRemote(Store.getDoc(), sha, opts.message);
            if (res.conflict) continue;                        /* someone pushed first — merge again */
            sha = res.sha; pushed = true;
          }
          break;
        }

        const ph = await syncPhotos().catch(() => ({ up: 0, down: 0 }));
        const c = Object.assign({}, cfg(), { lastSync: Date.now(), sha });
        Store.setDevice('sync', c);
        report('ok', pushed ? 'Saved to GitHub' : 'Up to date');
        Store.emit('synced', { pushed, photos: ph });
        return { ok: true, pushed, photos: ph };
      } catch (e) {
        console.error('sync', e);
        report('error', e.message || 'Sync failed');
        return { error: e.message };
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  /* fields that shouldn't trigger a pointless push */
  function stripVolatile(d) {
    const c = Store.clone(d); delete c.u;
    return c;
  }

  /* debounced auto-sync after local edits */
  function nudge(delay) {
    if (!isOn()) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(() => sync(), delay == null ? 12000 : delay);
  }

  /* ---------- pair code: share the setup with your friend ---------- */
  function makePairCode() {
    const c = cfg();
    if (!c) throw new Error('Set up sync first');
    return b64enc(JSON.stringify({ v: 1, o: c.owner, r: c.repo, b: c.branch || 'main', p: c.path, t: c.token }));
  }
  function readPairCode(code) {
    let o;
    try { o = JSON.parse(b64dec(code.trim())); } catch (e) { throw new Error('That code is not valid — copy the whole thing.'); }
    if (!o || !o.t || !o.o || !o.r) throw new Error('That code is missing some parts.');
    return { token: o.t, owner: o.o, repo: o.r, branch: o.b || 'main', path: o.p || 'ironlog-data.json', photos: true };
  }

  global.Sync = { sync, nudge, status, isOn, cfg, setCfg, testConnection, makePairCode, readPairCode, pullRemote, b64enc, b64dec };
})(window);
