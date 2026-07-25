/* Logic smoke test for IronLog's data layer, run in Node with a tiny shim. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const ROOT = process.cwd().replace(/\\\\/g, '/') + '/';

const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};
const win = { localStorage, indexedDB: undefined, console };
win.window = win;
const ctx = vm.createContext(win);
ctx.localStorage = localStorage;
ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
ctx.TextEncoder = TextEncoder; ctx.TextDecoder = TextDecoder;
ctx.Math = Math; ctx.Date = Date; ctx.JSON = JSON;

for (const f of ['js/machines.js', 'js/wger.js', 'js/store.js']) {
  vm.runInContext(fs.readFileSync(ROOT + f, 'utf8'), ctx, { filename: f });
}
const { Store, Machines } = ctx;

let pass = 0, fail = 0;
const T = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
};

console.log('\n1. catalog');
T('exercise count >= 200', Machines.EXERCISES.length >= 200, Machines.EXERCISES.length);
const noPhoto = Machines.EXERCISES.filter(e => e.photo && !/^img\/ex\/[\w.-]+$/.test(e.photo)).map(e => e.id);
T('photo paths well formed', noPhoto.length === 0, noPhoto);
const withPhoto = Machines.EXERCISES.filter(e => e.photo).length;
T('at least 200 exercises have a photo', withPhoto >= 200, withPhoto);
const badMetric = Machines.EXERCISES.filter(e => !['weight', 'reps', 'time', 'cardio'].includes(e.metric)).map(e => e.id);
T('every metric valid', badMetric.length === 0, badMetric);
const badStep = Machines.EXERCISES.filter(e => !(e.step > 0)).map(e => e.id);
T('every step positive', badStep.length === 0, badStep);
const badEquip = Machines.EXERCISES.filter(e => !['machine', 'cable', 'barbell', 'dumbbell', 'bodyweight', 'cardio'].includes(e.equip)).map(e => e.id + ':' + e.equip);
T('every equip valid', badEquip.length === 0, badEquip.slice(0, 8));
const dupes = Machines.EXERCISES.map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i);
T('no duplicate ids', dupes.length === 0, dupes);
const badArt = Machines.EXERCISES.filter(e => !Machines.ART[e.art]).map(e => e.id);
T('every art key exists', badArt.length === 0, badArt);
const badGroup = Machines.EXERCISES.filter(e => !Machines.GROUPS.some(g => g.id === e.group)).map(e => e.id);
T('every group valid', badGroup.length === 0, badGroup);
let svgOk = true, svgErr = null;
for (const k of Machines.ART_KEYS) {
  const s = Machines.ART[k]();
  if (!/^<svg /.test(s) || s.indexOf('NaN') > -1 || s.indexOf('undefined') > -1) { svgOk = false; svgErr = k + ': ' + s.slice(0, 120); break; }
}
T('all ' + Machines.ART_KEYS.length + ' illustrations render clean', svgOk, svgErr);

console.log('\n2. profiles + logging');
await Store.load();
const A = Store.addProfile('Me', 'blue', '💪');
const B = Store.addProfile('Friend', 'orange', '🔥');
Store.setActive(A.id);
T('two profiles', Store.profiles().length === 2);
T('active is A', Store.activeId() === A.id);
T('other is B', Store.otherProfile().id === B.id);

const DAY = 864e5;
const mk = (x, w, r, tOffsetDays, pid) => {
  const s = Store.addSet({ x, w, r, p: pid || A.id });
  s.t = Date.now() - tOffsetDays * DAY; s.u = s.t;
  return s;
};
/* leg press: 3 sessions, improving */
mk('leg-press', 100, 10, 14); mk('leg-press', 100, 10, 14);
mk('leg-press', 110, 10, 7); mk('leg-press', 110, 9, 7);
mk('leg-press', 120, 10, 0); mk('leg-press', 120, 8, 0);

const lp = Store.lastPerformance('leg-press');
T('last performance found', !!lp);
T('last best weight = 120', lp.best.w === 120, lp.best.w);
T('last session has 2 sets', lp.sets.length === 2, lp.sets.length);
T('previous best = 110', lp.prevBest.w === 110, lp.prevBest.w);
T('delta weight = +10', lp.deltaW === 10, lp.deltaW);
T('delta score positive', lp.deltaScore > 0, lp.deltaScore);
T('3 sessions counted', lp.totalDays === 3, lp.totalDays);
T('all-time best is 120x10', lp.allTimeBest.w === 120 && lp.allTimeBest.r === 10, lp.allTimeBest);

console.log('\n3. PR detection');
const prSet = Store.sets({ x: 'leg-press' }).find(s => s.w === 120 && s.r === 10);
T('120x10 is a PR', Store.isPR(prSet) === true);
const notPr = Store.sets({ x: 'leg-press' }).find(s => s.w === 120 && s.r === 8);
T('120x8 after 120x10 is not a PR', Store.isPR(notPr) === false);

console.log('\n4. inverse machines (assisted pull-up: less assist = better)');
mk('assisted-pullup', 40, 8, 10); mk('assisted-pullup', 30, 8, 3);
const ap = Store.lastPerformance('assisted-pullup');
const apEx = Store.exercise('assisted-pullup');
T('exercise flagged inverse', apEx.inverse === true);
T('30kg assist beats 40kg', Store.bestSet(Store.sets({ x: 'assisted-pullup' }), apEx).w === 30);
T('improvement detected as better', Store.isBetter(Store.score(ap.best, apEx), Store.score(ap.prevBest, apEx), apEx) === true);

console.log('\n5. units');
T('default kg', Store.unit() === 'kg');
T('fmt 100kg', Store.fmtW(100) === '100 kg', Store.fmtW(100));
Store.setSetting('unit', 'lb');
T('100kg shows as 220.5 lb', Store.fmtW(100) === '220.5 lb', Store.fmtW(100));
T('toKg(220.46) ~ 100', Math.abs(Store.toKg(220.46) - 100) < 0.01, Store.toKg(220.46));
Store.setSetting('unit', 'kg');
T('history unchanged after unit flip', Store.lastPerformance('leg-press').best.w === 120);

console.log('\n6. stats');
const t = Store.totals();
T('8 sets total', t.sets === 8, t.sets);
T('volume = 6540', t.volume === (100 * 10 * 2 + 110 * 10 + 110 * 9 + 120 * 10 + 120 * 8 + 40 * 8 + 30 * 8), t.volume);
T('weekVolume has 8 buckets', Store.weekVolume(null, 8).length === 8);
T('heatmap 120 days', Store.heatmapData(null, 119).length === 120);
T('series for leg-press = 3 points', Store.exerciseSeries('leg-press').length === 3);
T('streak >= 1 (trained today)', Store.streak() >= 1, Store.streak());
T('group balance returns groups', Store.groupBalance().length === Machines.GROUPS.length - 1);
T('recent exercises', Store.recentExercises().length === 2);
T('prList non-empty', Store.prList().length === 2);

console.log('\n7. favourites, meta, custom machines');
Store.toggleFav('leg-press');
T('fav set', Store.isFav('leg-press') === true);
T('fav is per person', Store.isFav('leg-press', B.id) === false);
Store.setMeta('leg-press', { num: '14', note: 'seat 3' });
T('machine number stored', Store.metaFor('leg-press').num === '14');
const cm = Store.addCustom({ name: 'Weird Machine', group: 'back' });
T('custom machine added', Store.allExercises().some(e => e.id === cm.id));
T('custom findable', Store.exercise(cm.id).name === 'Weird Machine');

console.log('\n8. sessions');
const ses = Store.startSession();
T('live session exists', !!Store.liveSession());
T('startSession is idempotent', Store.startSession().id === ses.id);
Store.addSet({ x: 'bench-press', w: 80, r: 5, sid: ses.id });
const st = Store.sessionStats(ses.id);
T('session stats: 1 set', st.setCount === 1);
T('session volume 400', st.volume === 400, st.volume);
Store.endSession(ses.id);
T('session closed', !Store.liveSession());
T('finished session listed', Store.sessions().filter(s => s.end).length === 1);
const empty = Store.startSession();
Store.endSession(empty.id);
T('empty session discarded', Store.sessions().every(s => s.id !== empty.id));

console.log('\n9. delete = tombstone (so deletes propagate on sync)');
const before = Store.sets().length;
Store.removeSet(prSet.id);
T('set hidden after delete', Store.sets().length === before - 1);
T('tombstone kept in raw doc', Store.getDoc().sets.some(s => s.id === prSet.id && s.d === true));

console.log('\n10. two-device merge');
const mine = Store.clone(Store.getDoc());
const theirs = Store.clone(Store.getDoc());
/* the friend logs on their phone */
theirs.sets.push({ id: 'remote1', p: B.id, x: 'lat-pulldown', w: 60, r: 12, t: Date.now(), u: Date.now() });
/* I log on mine */
mine.sets.push({ id: 'local1', p: A.id, x: 'pec-deck', w: 40, r: 15, t: Date.now(), u: Date.now() });
const merged = Store.mergeDocs(mine, theirs);
T('merge keeps my new set', merged.sets.some(s => s.id === 'local1'));
T('merge keeps their new set', merged.sets.some(s => s.id === 'remote1'));
T('merge does not duplicate', merged.sets.filter(s => s.id === 'remote1').length === 1);
T('merge is idempotent', JSON.stringify(Store.mergeDocs(merged, theirs).sets.length) === String(merged.sets.length));
/* conflicting edit: newer timestamp wins */
const older = Store.clone(merged); const newer = Store.clone(merged);
const target = newer.sets.find(s => s.id === 'local1');
target.w = 45; target.u = Date.now() + 5000;
const m2 = Store.mergeDocs(older, newer);
T('newer edit wins', m2.sets.find(s => s.id === 'local1').w === 45);
const m3 = Store.mergeDocs(newer, older);
T('older edit does not overwrite newer', m3.sets.find(s => s.id === 'local1').w === 45);
/* deletion propagates */
const delDoc = Store.clone(merged);
delDoc.sets.find(s => s.id === 'remote1').d = true;
delDoc.sets.find(s => s.id === 'remote1').u = Date.now() + 9000;
const m4 = Store.mergeDocs(merged, delDoc);
T('deletion propagates through merge', m4.sets.find(s => s.id === 'remote1').d === true);

console.log('\n11. export / import');
const json = Store.exportJson();
T('export is valid json', (() => { try { JSON.parse(json); return true; } catch (e) { return false; } })());
const setCount = Store.sets().length;
Store.importJson(json, 'merge');
T('re-import merge changes nothing', Store.sets().length === setCount, Store.sets().length);
let threw = false;
try { Store.importJson('{"nope":1}', 'replace'); } catch (e) { threw = true; }
T('bad backup rejected', threw);

console.log('\n12. persistence round trip');
const snapshot = Store.sets().length;
const raw = localStorage.getItem('il.doc');
T('doc written to localStorage', !!raw && raw.length > 100);
Store.replaceDoc(JSON.parse(raw));
T('reload keeps all sets', Store.sets().length === snapshot, Store.sets().length);

console.log('\n' + (fail === 0 ? 'ALL ' + pass + ' CHECKS PASSED' : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail ? 1 : 0);
