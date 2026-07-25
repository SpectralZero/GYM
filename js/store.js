/* =========================================================
   IRONLOG — data layer
   Offline-first. Everything lives on the phone; sync is optional.
   Weights are ALWAYS stored in kg and converted for display, so
   switching units never corrupts history.
   Records are append-only with tombstones + per-record timestamps,
   which is what makes two-device merging safe.
   ========================================================= */
(function (global) {
  'use strict';

  const DOC_KEY = 'il.doc';
  const DEV_KEY = 'il.device';
  const LB = 0.45359237;

  /* ---------- tiny helpers ---------- */
  const now = () => Date.now();
  const uid = () => 'x' + now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const round = (n, p = 2) => Math.round(n * Math.pow(10, p)) / Math.pow(10, p);
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- default document ---------- */
  function blankDoc() {
    return {
      v: 1, u: now(),
      profiles: [],
      settings: { unit: 'kg', restSec: 90, vibrate: true, sound: true, barWeight: 20, u: now() },
      meta: {},        /* exerciseId -> { num, note, fav:{profileId:true}, photo:{sha,u}, u } */
      custom: [],      /* user-added machines */
      sets: [],
      sessions: [],
      bw: []           /* bodyweight log */
    };
  }
  function blankDevice() {
    return { activeProfile: null, theme: 'dark', lastRoute: 'home', view: 'grid', onboarded: false, sync: null, seenTips: {} };
  }

  /* ---------- state ---------- */
  let doc = blankDoc();
  let dev = blankDevice();
  const listeners = {};

  function on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); return () => off(evt, fn); }
  function off(evt, fn) { const a = listeners[evt]; if (a) { const i = a.indexOf(fn); if (i > -1) a.splice(i, 1); } }
  function emit(evt, payload) { (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); (listeners['*'] || []).forEach(fn => fn(evt, payload)); }

  /* ---------- persistence ---------- */
  let saveTimer = null, idbTimer = null, pendingWrite = false;
  let storageFull = false, lastBytes = 0;

  /* Serialising the whole log costs ~45ms once a few years of history exist,
     and save() runs on every logged set. Coalesce writes into a trailing
     250ms window so logging stays instant, and flush before the page goes
     away so nothing is lost. */
  function writeNow() {
    clearTimeout(saveTimer); saveTimer = null; pendingWrite = false;
    let json;
    try { json = JSON.stringify(doc); } catch (e) { console.error('serialise failed', e); return; }
    lastBytes = json.length;
    try {
      localStorage.setItem(DOC_KEY, json);
      if (storageFull) { storageFull = false; emit('storage-ok'); }
    } catch (e) {
      /* Out of localStorage room. IndexedDB has far more, and the doc is
         mirrored there, so keep going rather than losing the session — but
         say so, because a silent failure here would look like data loss. */
      storageFull = true;
      console.error('localStorage full', e);
      emit('storage-error', e);
      idbPut('kv', 'doc', doc).catch(() => { });
    }
  }
  function flush() { if (pendingWrite) writeNow(); }

  function save(opts) {
    doc.u = now();
    pendingWrite = true;
    if (!saveTimer) saveTimer = setTimeout(writeNow, 250);
    clearTimeout(idbTimer);
    idbTimer = setTimeout(() => { idbPut('kv', 'doc', doc).catch(() => { }); }, 900);
    emit('change', doc);
    if (!opts || opts.sync !== false) emit('dirty');
  }

  /* how much room is left */
  function storageInfo() {
    let bytes = lastBytes;
    if (!bytes) { try { bytes = (localStorage.getItem(DOC_KEY) || '').length; } catch (e) { } }
    const setCount = doc.sets.filter(s => !s.d).length;
    const perSet = setCount > 50 ? bytes / setCount : 156;      /* measured average */
    const LIMIT = 5 * 1024 * 1024;
    /* sets per year, from the last 90 days of real usage */
    const since = now() - 90 * 864e5;
    const recent = doc.sets.filter(s => !s.d && s.t >= since).length;
    const perYear = recent > 20 ? recent * (365 / 90) : 0;
    return {
      bytes, setCount, perSet, limit: LIMIT, full: storageFull,
      pct: Math.min(100, bytes / LIMIT * 100),
      setsLeft: Math.max(0, Math.floor((LIMIT - bytes) / perSet)),
      yearsLeft: perYear ? (LIMIT - bytes) / perSet / perYear : null,
      perYear: Math.round(perYear)
    };
  }
  function saveDevice() { try { localStorage.setItem(DEV_KEY, JSON.stringify(dev)); } catch (e) { } }

  async function load() {
    /* Read BOTH copies and keep the newer one. If localStorage ever filled up,
       its copy is frozen at that moment while IndexedDB kept receiving updates —
       blindly preferring localStorage would then silently roll history back. */
    let fromLs = null, fromIdb = null;
    try { const raw = localStorage.getItem(DOC_KEY); if (raw) fromLs = JSON.parse(raw); }
    catch (e) { console.error('localStorage copy unreadable', e); }
    try { fromIdb = await idbGet('kv', 'doc'); } catch (e) { }
    try {
      const best = (fromLs && fromIdb) ? ((fromIdb.u || 0) > (fromLs.u || 0) ? fromIdb : fromLs) : (fromLs || fromIdb);
      if (best) doc = migrate(best);
    } catch (e) { console.error('load failed, starting clean', e); }
    try { const rawD = localStorage.getItem(DEV_KEY); if (rawD) dev = Object.assign(blankDevice(), JSON.parse(rawD)); } catch (e) { }
    if (!doc.profiles) doc = blankDoc();
    if (dev.activeProfile && !doc.profiles.some(p => p.id === dev.activeProfile)) dev.activeProfile = (doc.profiles[0] || {}).id || null;
    if (!dev.activeProfile && doc.profiles.length) dev.activeProfile = doc.profiles[0].id;
    return doc;
  }

  function migrate(d) {
    d = Object.assign(blankDoc(), d);
    d.settings = Object.assign(blankDoc().settings, d.settings || {});
    d.meta = d.meta || {}; d.sets = d.sets || []; d.sessions = d.sessions || []; d.bw = d.bw || []; d.custom = d.custom || [];
    return d;
  }

  /* ---------- IndexedDB (photos + backup) ---------- */
  let dbp = null;
  /* IndexedDB can hang indefinitely (blocked upgrade, private browsing,
     storage pressure). Everything here is a nice-to-have on top of
     localStorage, so it always gives up rather than stalling the app. */
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!global.indexedDB) return rej(new Error('no indexedDB'));
      let settled = false;
      const done = fn => v => { if (!settled) { settled = true; fn(v); } };
      const fail = done(rej), ok = done(res);
      const timer = setTimeout(() => fail(new Error('indexedDB timed out')), 4000);
      let req;
      try { req = indexedDB.open('ironlog', 1); } catch (e) { clearTimeout(timer); return fail(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => { clearTimeout(timer); ok(req.result); };
      req.onerror = () => { clearTimeout(timer); fail(req.error); };
      req.onblocked = () => { clearTimeout(timer); fail(new Error('indexedDB blocked')); };
    });
    dbp.catch(() => { });   /* never an unhandled rejection */
    return dbp;
  }
  async function idbPut(store, key, val) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  async function idbGet(store, key) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction(store, 'readonly'); const r = tx.objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  async function idbDel(store, key) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  async function idbKeys(store) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction(store, 'readonly'); const r = tx.objectStore(store).getAllKeys(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
  }

  /* ---------- photos ----------
     photoVer remembers WHICH version of a photo this device holds, taken from
     the owning record's `u` timestamp. Without it, a photo that gets replaced
     on the other phone would never be re-downloaded here, because "do I have
     one?" would already be true. */
  const photoCache = new Map();
  const photoVer = new Map();
  async function getPhoto(exId) {
    if (photoCache.has(exId)) return photoCache.get(exId);
    let v = null;
    try { v = await idbGet('photos', exId); } catch (e) { }
    const url = v && v.data ? v.data : null;
    photoCache.set(exId, url);
    if (v && v.ver != null) photoVer.set(exId, v.ver);
    return url;
  }
  function photoCached(exId) { return photoCache.get(exId) || null; }
  function photoVersion(key) { return photoVer.has(key) ? photoVer.get(key) : null; }
  async function setPhoto(exId, dataUrl) {
    const t = now();
    try { await idbPut('photos', exId, { data: dataUrl, u: t, ver: t }); }
    catch (e) { console.warn('photo not persisted', e); }
    photoCache.set(exId, dataUrl); photoVer.set(exId, t);
    const m = metaFor(exId, true); m.photo = { u: t, local: true }; m.u = t;
    save(); emit('photo', exId);
  }
  /* ---------- profile pictures ----------
     Kept in the same photo store under a prefixed key, so they are preloaded,
     synced and backed up by exactly the same machinery as machine photos. */
  const PKEY = id => 'prof-' + id;
  function profilePhoto(id) { return photoCached(PKEY(id)); }
  async function setProfilePhoto(id, dataUrl) {
    /* the in-memory cache and the profile record matter more than persistence:
       a blocked IndexedDB must not stop the rest of the save */
    const t = now();
    try { await idbPut('photos', PKEY(id), { data: dataUrl, u: t, ver: t }); }
    catch (e) { console.warn('profile photo not persisted', e); }
    photoCache.set(PKEY(id), dataUrl); photoVer.set(PKEY(id), t);
    const p = profile(id);
    if (p) { p.photo = { u: t, local: true }; p.u = t; }
    save(); emit('photo', PKEY(id));
  }
  async function clearProfilePhoto(id) {
    try { await idbDel('photos', PKEY(id)); } catch (e) { }
    photoCache.delete(PKEY(id));
    const p = profile(id);
    if (p) { delete p.photo; p.u = now(); }
    save(); emit('photo', PKEY(id));
  }

  /* store a photo that came FROM sync — must not be re-flagged for upload.
     `ver` is the owning record's timestamp, so we know when it goes stale. */
  async function setPhotoQuiet(exId, dataUrl, ver) {
    try { await idbPut('photos', exId, { data: dataUrl, u: now(), ver: ver == null ? now() : ver }); }
    catch (e) { console.warn('synced photo not persisted', e); }
    photoCache.set(exId, dataUrl);
    photoVer.set(exId, ver == null ? now() : ver);
    emit('photo', exId);
  }
  async function clearPhoto(exId) {
    try { await idbDel('photos', exId); } catch (e) { }
    photoCache.delete(exId);
    const m = metaFor(exId, true); delete m.photo; m.u = now();
    save(); emit('photo', exId);
  }
  async function preloadPhotos() {
    let keys = [];
    try { keys = await idbKeys('photos'); } catch (e) { return 0; }
    await Promise.all(keys.map(k => getPhoto(k).catch(() => null)));
    if (keys.length) emit('photos-ready', keys.length);
    return keys.length;
  }
  /* downscale + compress a File to a data URL */
  function fileToDataUrl(file, max = 720, quality = 0.72) {
    return new Promise((res, rej) => {
      const img = new Image();
      const fr = new FileReader();
      fr.onload = () => { img.src = fr.result; };
      fr.onerror = () => rej(fr.error);
      img.onload = () => {
        let { width: w, height: h } = img;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => rej(new Error('bad image'));
      fr.readAsDataURL(file);
    });
  }

  /* ---------- profiles ---------- */
  function profiles() { return doc.profiles.filter(p => !p.d); }
  function profile(id) { return doc.profiles.find(p => p.id === id) || null; }
  function activeProfile() { return profile(dev.activeProfile) || profiles()[0] || null; }
  function activeId() { const p = activeProfile(); return p ? p.id : null; }
  function otherProfile() { const a = activeId(); return profiles().find(p => p.id !== a) || null; }
  function addProfile(name, color, emoji) {
    const p = { id: uid(), name: name || 'Athlete', color: color || 'accent', emoji: emoji || '💪', created: now(), u: now() };
    doc.profiles.push(p);
    if (!dev.activeProfile) { dev.activeProfile = p.id; saveDevice(); }
    save(); return p;
  }
  function updateProfile(id, patch) { const p = profile(id); if (!p) return; Object.assign(p, patch, { u: now() }); save(); }
  function setActive(id) { if (!profile(id)) return; dev.activeProfile = id; saveDevice(); emit('profile', id); emit('change', doc); }

  /* ---------- exercises ---------- */
  function allExercises() { return Machines.EXERCISES.concat(doc.custom.filter(c => !c.d)); }
  function exercise(id) { return allExercises().find(e => e.id === id) || null; }
  function addCustom(ex) {
    const e = Object.assign({ id: 'c-' + uid(), metric: 'weight', equip: 'machine', step: 2.5, art: 'generic', custom: true, u: now() }, ex);
    doc.custom.push(e); save(); return e;
  }
  function updateCustom(id, patch) { const e = doc.custom.find(c => c.id === id); if (!e) return; Object.assign(e, patch, { u: now() }); save(); }
  function removeCustom(id) { const e = doc.custom.find(c => c.id === id); if (e) { e.d = true; e.u = now(); save(); } }

  function metaFor(exId, create) {
    let m = doc.meta[exId];
    if (!m && create) { m = doc.meta[exId] = { u: now() }; }
    return m || {};
  }
  function setMeta(exId, patch) { const m = metaFor(exId, true); Object.assign(m, patch, { u: now() }); save(); }
  function isFav(exId, pid) { const m = metaFor(exId); return !!(m.fav && m.fav[pid || activeId()]); }
  function toggleFav(exId, pid) {
    pid = pid || activeId();
    const m = metaFor(exId, true); m.fav = m.fav || {};
    if (m.fav[pid]) delete m.fav[pid]; else m.fav[pid] = true;
    m.u = now(); save(); return !!m.fav[pid];
  }

  /* ---------- sets ---------- */
  /* set = {id,p,x,w(kg),r,s(sec),k(km),rpe,t,sid,n,d,u} */
  function sets(filter) {
    let out = doc.sets.filter(s => !s.d);
    if (filter) {
      if (filter.p) out = out.filter(s => s.p === filter.p);
      if (filter.x) out = out.filter(s => s.x === filter.x);
      if (filter.since) out = out.filter(s => s.t >= filter.since);
      if (filter.sid) out = out.filter(s => s.sid === filter.sid);
    }
    return out.sort((a, b) => a.t - b.t);
  }
  function addSet(data) {
    const s = Object.assign({ id: uid(), p: activeId(), t: now(), u: now() }, data);
    s.w = +s.w || 0; s.r = +s.r || 0;
    doc.sets.push(s);
    save(); emit('set', s);
    return s;
  }
  function updateSet(id, patch) { const s = doc.sets.find(x => x.id === id); if (!s) return; Object.assign(s, patch, { u: now() }); save(); emit('set', s); }
  function removeSet(id) { const s = doc.sets.find(x => x.id === id); if (s) { s.d = true; s.u = now(); save(); emit('set', s); } }

  /* ---------- sessions ---------- */
  function sessions(pid) { return doc.sessions.filter(s => !s.d && (!pid || s.p === pid)).sort((a, b) => b.start - a.start); }
  function liveSession(pid) { return doc.sessions.find(s => !s.d && s.p === (pid || activeId()) && !s.end) || null; }
  function startSession(title) {
    const existing = liveSession();
    if (existing) return existing;
    const s = { id: uid(), p: activeId(), start: now(), end: null, title: title || '', u: now() };
    doc.sessions.push(s); save(); emit('session', s); return s;
  }
  function endSession(id, note) {
    const s = doc.sessions.find(x => x.id === id); if (!s) return null;
    s.end = now(); if (note) s.note = note; s.u = now();
    /* drop a session that never got a set */
    if (!sets({ sid: s.id }).length) { s.d = true; }
    save(); emit('session', s); return s;
  }
  function removeSession(id) {
    const s = doc.sessions.find(x => x.id === id); if (!s) return;
    s.d = true; s.u = now();
    doc.sets.filter(x => x.sid === id).forEach(x => { x.d = true; x.u = now(); });
    save();
  }
  function sessionStats(sid) {
    const ss = sets({ sid });
    const vol = ss.reduce((a, s) => a + s.w * s.r, 0);
    const exIds = [...new Set(ss.map(s => s.x))];
    return { setCount: ss.length, volume: vol, exercises: exIds, reps: ss.reduce((a, s) => a + s.r, 0) };
  }

  /* ---------- scoring / PRs ---------- */
  function e1rm(w, r) { return r > 0 ? w * (1 + r / 30) : w; }   /* Epley */
  /* one comparable number per set, direction-aware */
  function score(s, ex) {
    ex = ex || exercise(s.x) || {};
    if (ex.metric === 'time') return s.s || 0;
    if (ex.metric === 'reps') return (s.w > 0 ? e1rm(s.w, s.r) : s.r);
    if (ex.metric === 'cardio') return s.s || 0;
    return e1rm(s.w, s.r);
  }
  /* higher is better, except assisted machines where less assist = stronger */
  function isBetter(a, b, ex) { return (ex && ex.inverse) ? a < b : a > b; }
  function bestSet(list, ex) {
    if (!list.length) return null;
    return list.reduce((best, s) => (!best || isBetter(score(s, ex), score(best, ex), ex)) ? s : best, null);
  }

  /* the whole point of the app: what did I do last time on this machine */
  function lastPerformance(exId, pid) {
    pid = pid || activeId();
    const ex = exercise(exId);
    const all = sets({ x: exId, p: pid });
    if (!all.length) return null;
    const days = groupByDay(all);
    const keys = Object.keys(days).sort();
    const lastKey = keys[keys.length - 1];
    const prevKey = keys[keys.length - 2];
    const lastSets = days[lastKey];
    const prev = prevKey ? days[prevKey] : null;
    const lb = bestSet(lastSets, ex);
    const pb = prev ? bestSet(prev, ex) : null;
    return {
      ex, date: lastSets[0].t, sets: lastSets, best: lb,
      volume: lastSets.reduce((a, s) => a + s.w * s.r, 0),
      prevDate: prev ? prev[0].t : null, prevSets: prev, prevBest: pb,
      deltaW: pb ? round(lb.w - pb.w) : null,
      deltaScore: pb ? round(score(lb, ex) - score(pb, ex), 1) : null,
      allTimeBest: bestSet(all, ex),
      totalDays: keys.length, totalSets: all.length
    };
  }
  function groupByDay(list) {
    const out = {};
    list.forEach(s => { const k = dayKey(s.t); (out[k] || (out[k] = [])).push(s); });
    return out;
  }
  /* Was this set a personal record at the moment it was logged?
     Sets logged in the same millisecond are ordered by insertion, so the
     second set of a pair can never be judged against a future one. The very
     first set on a machine establishes the baseline rather than counting as
     a record — otherwise every new machine would fire a PR celebration. */
  function isPR(set) {
    const ex = exercise(set.x);
    const list = doc.sets.filter(s => !s.d && s.x === set.x && s.p === set.p);
    const idx = list.findIndex(s => s.id === set.id);
    const before = list.filter((s, i) => s.t < set.t || (s.t === set.t && i < idx));
    if (!before.length) return false;
    return isBetter(score(set, ex), score(bestSet(before, ex), ex), ex);
  }
  function prList(pid, limit) {
    pid = pid || activeId();
    const byEx = {};
    sets({ p: pid }).forEach(s => (byEx[s.x] || (byEx[s.x] = [])).push(s));
    const out = Object.keys(byEx).map(x => {
      const ex = exercise(x); if (!ex) return null;
      const b = bestSet(byEx[x], ex);
      return { ex, set: b, score: score(b, ex), days: Object.keys(groupByDay(byEx[x])).length, last: byEx[x][byEx[x].length - 1].t };
    }).filter(Boolean).sort((a, b) => b.last - a.last);
    return limit ? out.slice(0, limit) : out;
  }

  /* ---------- stats ---------- */
  function trainedDays(pid) { return Object.keys(groupByDay(sets({ p: pid || activeId() }))); }
  function streak(pid) {
    const days = new Set(trainedDays(pid));
    if (!days.size) return 0;
    let n = 0;
    let cur = startOfDay(now());
    /* today not required — streak survives until you miss a full day */
    if (!days.has(dayKey(cur))) cur -= 864e5;
    while (days.has(dayKey(cur))) { n++; cur -= 864e5; }
    return n;
  }
  function weekVolume(pid, weeks = 8) {
    pid = pid || activeId();
    const out = [];
    const monday = ts => { const d = new Date(startOfDay(ts)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); };
    const thisWeek = monday(now());
    for (let i = weeks - 1; i >= 0; i--) {
      const from = thisWeek - i * 7 * 864e5, to = from + 7 * 864e5;
      const ss = doc.sets.filter(s => !s.d && s.p === pid && s.t >= from && s.t < to);
      out.push({ from, label: new Date(from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), volume: ss.reduce((a, s) => a + s.w * s.r, 0), sets: ss.length, days: Object.keys(groupByDay(ss)).length });
    }
    return out;
  }
  function groupBalance(pid, days = 30) {
    pid = pid || activeId();
    const since = now() - days * 864e5;
    const map = {};
    sets({ p: pid, since }).forEach(s => {
      const ex = exercise(s.x); if (!ex) return;
      map[ex.group] = (map[ex.group] || 0) + (s.w * s.r || s.r || 0);
    });
    return Machines.GROUPS.filter(g => g.id !== 'cardio').map(g => ({ group: g, value: map[g.id] || 0 }))
      .sort((a, b) => b.value - a.value);
  }
  function heatmapData(pid, days = 119) {
    pid = pid || activeId();
    const per = {};
    sets({ p: pid, since: startOfDay(now() - days * 864e5) }).forEach(s => {
      const k = dayKey(s.t); per[k] = (per[k] || 0) + s.r;
    });
    const out = [];
    for (let i = days; i >= 0; i--) { const ts = startOfDay(now() - i * 864e5); out.push({ ts, key: dayKey(ts), value: per[dayKey(ts)] || 0 }); }
    return out;
  }
  function exerciseSeries(exId, pid) {
    pid = pid || activeId();
    const ex = exercise(exId);
    const days = groupByDay(sets({ x: exId, p: pid }));
    return Object.keys(days).sort().map(k => {
      const b = bestSet(days[k], ex);
      return { ts: days[k][0].t, key: k, top: b.w, e1rm: round(score(b, ex), 1), volume: days[k].reduce((a, s) => a + s.w * s.r, 0), sets: days[k].length, reps: b.r };
    });
  }
  function recentExercises(pid, limit = 6) {
    pid = pid || activeId();
    const seen = new Set(); const out = [];
    sets({ p: pid }).slice().reverse().forEach(s => {
      if (seen.has(s.x)) return; seen.add(s.x);
      const ex = exercise(s.x); if (ex) out.push({ ex, t: s.t });
    });
    return out.slice(0, limit);
  }
  function totals(pid) {
    pid = pid || activeId();
    const ss = sets({ p: pid });
    return {
      sets: ss.length, reps: ss.reduce((a, s) => a + s.r, 0),
      volume: ss.reduce((a, s) => a + s.w * s.r, 0),
      days: Object.keys(groupByDay(ss)).length,
      machines: new Set(ss.map(s => s.x)).size,
      workouts: sessions(pid).filter(s => s.end).length
    };
  }

  /* ---------- bodyweight ---------- */
  function addBw(kg, pid) { doc.bw.push({ id: uid(), p: pid || activeId(), kg: +kg, t: now(), u: now() }); save(); }
  function bwSeries(pid) { return doc.bw.filter(b => !b.d && b.p === (pid || activeId())).sort((a, b) => a.t - b.t); }

  /* ---------- units ---------- */
  function unit() { return doc.settings.unit || 'kg'; }
  function toDisplay(kg) { return unit() === 'lb' ? round(kg / LB, 1) : round(kg, 2); }
  function toKg(v) { return unit() === 'lb' ? +v * LB : +v; }
  function fmtW(kg, withUnit) {
    const v = toDisplay(kg);
    const s = (Math.abs(v - Math.round(v)) < 0.001) ? String(Math.round(v)) : String(round(v, 1));
    return withUnit === false ? s : s + ' ' + unit();
  }
  function fmtVol(kg) {
    const v = unit() === 'lb' ? kg / LB : kg;
    if (v >= 1000) return round(v / 1000, v >= 10000 ? 0 : 1) + 't';
    return Math.round(v) + '';
  }
  function stepFor(ex) {
    const base = ex && ex.step ? ex.step : 2.5;
    return unit() === 'lb' ? (base === 2.5 ? 5 : base === 2 ? 5 : base === 1 ? 2.5 : base === 5 ? 10 : base) : base;
  }
  function settings() { return doc.settings; }
  function setSetting(k, v) { doc.settings[k] = v; doc.settings.u = now(); save(); emit('settings', doc.settings); }
  function device() { return dev; }
  function setDevice(k, v) { dev[k] = v; saveDevice(); emit('device', dev); }

  /* ---------- merge (two-device sync) ---------- */
  function mergeDocs(mine, theirs) {
    if (!theirs || !theirs.profiles) return mine;
    const out = clone(mine);
    const byId = (arr) => { const m = {}; arr.forEach(o => m[o.id] = o); return m; };

    ['profiles', 'sets', 'sessions', 'bw', 'custom'].forEach(key => {
      const mineMap = byId(out[key] || []);
      (theirs[key] || []).forEach(r => {
        const ex = mineMap[r.id];
        if (!ex) { (out[key] = out[key] || []).push(r); mineMap[r.id] = r; }
        else if ((r.u || 0) > (ex.u || 0)) Object.assign(ex, r);
      });
    });

    out.meta = out.meta || {};
    Object.keys(theirs.meta || {}).forEach(k => {
      const t = theirs.meta[k], m = out.meta[k];
      if (!m || (t.u || 0) > (m.u || 0)) out.meta[k] = t;
    });

    if ((theirs.settings && theirs.settings.u || 0) > (out.settings.u || 0)) {
      out.settings = Object.assign({}, out.settings, theirs.settings);
    }
    out.v = Math.max(out.v || 1, theirs.v || 1);
    return out;
  }
  function replaceDoc(next, opts) {
    doc = migrate(next);
    if (dev.activeProfile && !doc.profiles.some(p => p.id === dev.activeProfile)) {
      dev.activeProfile = (profiles()[0] || {}).id || null; saveDevice();
    }
    if (!dev.activeProfile && profiles().length) { dev.activeProfile = profiles()[0].id; saveDevice(); }
    save(opts);
    emit('replaced', doc);
  }
  function getDoc() { return doc; }

  /* ---------- export / import ---------- */
  function exportJson() { return JSON.stringify({ app: 'ironlog', exported: new Date().toISOString(), doc }, null, 1); }
  function importJson(text, mode) {
    const parsed = JSON.parse(text);
    const incoming = parsed.doc || parsed;
    if (!incoming || !incoming.profiles) throw new Error('This file does not look like an IronLog backup.');
    replaceDoc(mode === 'replace' ? incoming : mergeDocs(doc, incoming));
    return true;
  }

  global.Store = {
    /* lifecycle */
    load, save, flush, saveDevice, getDoc, replaceDoc, mergeDocs, on, off, emit, storageInfo,
    /* profiles */
    profiles, profile, activeProfile, activeId, otherProfile, addProfile, updateProfile, setActive,
    /* exercises */
    allExercises, exercise, addCustom, updateCustom, removeCustom, metaFor, setMeta, isFav, toggleFav,
    /* sets & sessions */
    sets, addSet, updateSet, removeSet, sessions, liveSession, startSession, endSession, removeSession, sessionStats,
    /* analysis */
    e1rm, score, isBetter, bestSet, lastPerformance, groupByDay, isPR, prList,
    streak, trainedDays, weekVolume, groupBalance, heatmapData, exerciseSeries, recentExercises, totals,
    /* bodyweight */
    addBw, bwSeries,
    /* units + settings */
    unit, toDisplay, toKg, fmtW, fmtVol, stepFor, settings, setSetting, device, setDevice,
    /* photos */
    getPhoto, photoCached, photoVersion, setPhoto, setPhotoQuiet, clearPhoto, preloadPhotos, fileToDataUrl,
    profilePhoto, setProfilePhoto, clearProfilePhoto, profileKey: PKEY,
    /* io */
    exportJson, importJson,
    /* utils */
    uid, now, dayKey, startOfDay, round, clone
  };
})(window);
