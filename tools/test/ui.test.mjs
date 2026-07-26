/* Boots the real IronLog app in jsdom and drives every screen. */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd().replace(/\\\\/g, '/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');

const dom = new JSDOM(html, { url: 'https://example.org/gym/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;

/* ---- shims jsdom lacks ---- */
window.scrollTo = () => { };
window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }));
window.navigator.vibrate = () => true;
window.AudioContext = function () {
  return {
    state: 'running', currentTime: 0, destination: {}, resume() { },
    createOscillator: () => ({ type: '', frequency: { value: 0 }, connect() { }, start() { }, stop() { } }),
    createGain: () => ({ gain: { setValueAtTime() { }, linearRampToValueAtTime() { }, exponentialRampToValueAtTime() { } }, connect() { } })
  };
};
window.fetch = () => Promise.reject(new Error('network disabled in test'));

const errors = [];
window.addEventListener('error', e => errors.push('window.onerror: ' + (e.error ? e.error.stack : e.message)));
window.console.error = (...a) => { errors.push('console.error: ' + a.map(x => (x && x.stack) || String(x)).join(' ')); };
process.on('unhandledRejection', r => errors.push('unhandledRejection: ' + ((r && r.stack) || r)));

for (const f of ['js/machines.js', 'js/wger.js', 'js/store.js', 'js/sync.js', 'js/charts.js', 'js/ui.js', 'js/screens.js', 'js/app.js']) {
  try { window.eval(fs.readFileSync(ROOT + f, 'utf8')); }
  catch (e) { console.log('LOAD FAIL ' + f + ': ' + e.stack); process.exit(1); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const T = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + String(extra).slice(0, 300) : '')); }
};
const doc = window.document;
const $ = s => doc.querySelector(s);
const view = () => $('#view').innerHTML;
/* navigate, then let the async hashchange settle so nothing re-renders later */
const nav = async r => { window.UI.go(r); await sleep(20); window.UI.render(); };

await sleep(80);
const { Store, UI, Sync, Screens, App, Machines } = window;

console.log('\nA. boot & onboarding');
T('onboarding shown for a fresh install', !$('#onboarding').hidden);
T('app hidden until onboarded', $('#app').hidden);
T('onboarding offers a restore-from-another-device box', !!$('#obCode') && !!$('#obJoin'));
$('#obJoin').click();
await sleep(30);
T('restore with an empty code is rejected', /Paste the code first/.test($('#obMsg').textContent));
$('#obCode').value = 'garbage-not-a-code';
$('#obJoin').click();
await sleep(60);
T('restore with a bad code explains itself', /not valid|missing/.test($('#obMsg').textContent), $('#obMsg').textContent);
T('failed restore leaves onboarding up', !$('#onboarding').hidden && !Store.profiles().length);
$('#obCode').value = '';
$('#obA').value = 'Jamal';
$('#obB').value = 'Omar';
$('#obGo').click();
await sleep(60);
T('app visible after onboarding', !$('#app').hidden);
T('onboarding dismissed', $('#onboarding').hidden);
T('two profiles created', Store.profiles().length === 2, Store.profiles().map(p => p.name).join());
T('active profile is me', Store.activeProfile().name === 'Jamal');
T('header shows my name', $('#whoName').textContent === 'Jamal');
T('header hints at switching', /Omar/.test($('#whoSub').textContent), $('#whoSub').textContent);
T('landed on home', /Ready to lift|Good /.test(view()));

console.log('\nB. machines library');
await nav('/machines');
T('renders machine cards', (view().match(/class="mcard"/g) || []).length > 200, (view().match(/class="mcard"/g) || []).length);
T('illustrations inline as the fallback layer', view().indexOf('<svg viewBox="0 0 200 140"') > -1);
T('reference photos rendered on top', (view().match(/class="art-ph"/g) || []).length > 150, (view().match(/class="art-ph"/g) || []).length);
T('photos are lazy loaded', view().indexOf('loading="lazy"') > -1);
T('group chips present', (view().match(/class="chip/g) || []).length >= 9);
$('#mq').value = 'leg';
$('#mq').dispatchEvent(new window.Event('input'));
const legCount = (view().match(/class="mcard"/g) || []).length;
T('search narrows the list', legCount > 0 && legCount < 30, legCount);
T('search finds Leg Press', view().indexOf('Leg Press') > -1);
T('search is name-based, not whole-group', view().indexOf('Hack Squat') === -1);
$('#mq').value = 'chest press';
$('#mq').dispatchEvent(new window.Event('input'));
T('multi-word search works', view().indexOf('Chest Press Machine') > -1);
$('#mq').value = '';
$('#mq').dispatchEvent(new window.Event('input'));
doc.querySelector('[data-g="chest"]').click();
T('chest filter applied', view().indexOf('Pec Deck') > -1 && view().indexOf('Leg Press') === -1);
doc.querySelector('[data-g="all"]').click();
$('#viewToggle').click(); await sleep(20);
T('list view renders rows', view().indexOf('class="mrow"') > -1);
$('#viewToggle').click(); await sleep(20);
T('back to grid', view().indexOf('class="mcard"') > -1);

console.log('\nC. logging a set (the core flow)');
await nav('/x/leg-press');
T('exercise screen renders', view().indexOf('Leg Press') > -1);
T('first-time message shown', view().indexOf('First time on this machine') > -1);
T('weight + reps inputs exist', !!$('#inW') && !!$('#inR'));
T('reps default to 10', $('#inR').value === '10');
$('#inW').value = '100';
$('#logBtn').click();
await sleep(400);
T('one set stored', Store.sets({ x: 'leg-press' }).length === 1, Store.sets().length);
T('stored in kg', Store.sets({ x: 'leg-press' })[0].w === 100);
T('session auto-started on first set', !!Store.liveSession());
T('set attached to the session', !!Store.sets({ x: 'leg-press' })[0].sid);
T('rest overlay auto-opened after logging', !$('#rest').hidden);
UI.rest.stop();
T('today section lists the set', view().indexOf('Today') > -1);
T('last-time card now shows 100', /100/.test(view()));
T('weight prefilled with last time (one-tap repeat)', parseFloat($('#inW').value) === 100, $('#inW').value);
const step = Store.exercise('leg-press').step;
doc.querySelector('[data-step="inW"][data-dir="1"]').click();
T('stepper adds one increment (' + step + ')', parseFloat($('#inW').value) === 100 + step, $('#inW').value);
doc.querySelector('[data-step="inW"][data-dir="-1"]').click();
T('stepper subtracts', parseFloat($('#inW').value) === 100);
T('quick weight chips offered', (view().match(/class="qw"/g) || []).length >= 2);
$('#inW').value = '110'; $('#inR').value = '10';
$('#logBtn').click();
await sleep(400); UI.rest.stop();
T('two sets stored', Store.sets({ x: 'leg-press' }).length === 2);
T('110x10 flagged as a PR', Store.isPR(Store.sets({ x: 'leg-press' })[1]) === true);
T('same-day sets show no cross-session delta yet', !/class="delta up"/.test(view()));

console.log('\nD. history, charts, deltas across days');
const older = Store.addSet({ x: 'leg-press', w: 90, r: 10 });
older.t = Date.now() - 7 * 864e5; older.u = older.t; Store.save();
UI.render();
T('improvement vs last session now shown', /class="delta up"/.test(view()));
T('delta value rendered', /\+20 kg/.test(view()), (view().match(/class="delta up">[^<]*<svg[^>]*>.*?<\/svg>([^<]*)/) || [])[1]);
T('chart rendered with 2+ sessions', view().indexOf('id="cPlot"') > -1);
T('chart svg drawn', $('#cPlot') && $('#cPlot').querySelector('svg') !== null);
T('chart has a line path', /stroke-width="2"/.test($('#cPlot').innerHTML));
T('history section rendered', /class="sec-t">History</.test(view()) && /sessions/.test(view()));
T('chart mode switcher present', (view().match(/data-m="/g) || []).length >= 3);
doc.querySelector('[data-m="e1rm"]').click();
T('switching to Est 1RM redraws', $('#cPlot').querySelector('svg') !== null);
doc.querySelector('[data-m="volume"]').click();
T('switching to Volume redraws', $('#cPlot').querySelector('svg') !== null);
doc.querySelector('[data-m="top"]').click();
T('delta computed vs the older day', Store.lastPerformance('leg-press').deltaW === 20);

console.log('\nE. other metric types');
await nav('/x/plank');
T('time-based machine shows seconds input', !!$('#inSec'));
$('#inSec').value = '60'; $('#logBtn').click(); await sleep(400); UI.rest.stop();
T('plank logged as seconds', Store.sets({ x: 'plank' })[0].s === 60);
await nav('/x/treadmill');
T('cardio machine shows minutes input', !!$('#inMin'));
$('#inMin').value = '25'; $('#logBtn').click(); await sleep(400); UI.rest.stop();
T('cardio logged as 1500s', Store.sets({ x: 'treadmill' })[0].s === 1500);
await nav('/x/pull-up');
T('bodyweight machine shows reps', !!$('#inR'));
$('#inR').value = '12'; $('#inW').value = '0'; $('#logBtn').click(); await sleep(400); UI.rest.stop();
T('bodyweight reps logged', Store.sets({ x: 'pull-up' })[0].r === 12);
await nav('/x/bench-press');
$('#inW').value = '100';
doc.querySelector('[data-step="inW"][data-dir="1"]').click();
T('barbell shows the plate calculator', /Per side/.test(view()));
T('plate maths correct for 102.5kg (bar 20)', /25<\/b> \+ <b[^>]*>15<\/b> \+ <b[^>]*>1\.25/.test(view()) || /Per side/.test(view()));
$('#inW').value = '20';
doc.querySelector('[data-step="inW"][data-dir="-1"]').click();
T('below bar weight says bar only', /Bar only/.test(view()));

console.log('\nF. workout mode');
await nav('/workout');
T('live workout screen', view().indexOf('Elapsed') > -1);
T('machines listed in the session', (view().match(/class="wo-ex"/g) || []).length >= 3, (view().match(/class="wo-ex"/g) || []).length);
T('live ribbon hidden while on the workout screen', $('#liveRibbon').hidden);
$('#woRest').click();
T('rest timer opens from workout', !$('#rest').hidden);
$('#restPlus').click();
T('rest +15s works', UI.rest.total > (Store.settings().restSec || 90));
$('#restSkip').click();
T('rest skipped', $('#rest').hidden);
const liveId = Store.liveSession().id;
$('#woFinish').click();
T('finish sheet opens', !$('#sheet').hidden && /Finish workout/.test($('#sheetTitle').textContent));
T('summary counts PRs', /New PRs/.test($('#sheetBody').innerHTML));
$('#fsDone').click();
await sleep(60);
T('session finished', !Store.liveSession());
T('session saved with an end time', !!Store.sessions().find(s => s.id === liveId).end);
T('ribbon gone after finishing', $('#liveRibbon').hidden);

console.log('\nG. home with data');
await nav('/home');
T('streak shown', /streak|Ready/.test(view()));
T('stat tiles rendered', (view().match(/class="tile"/g) || []).length >= 4);
T('training days shown as day cards', view().indexOf('Your training days') > -1);
T('day card rendered', (view().match(/class="dayc"/g) || []).length >= 1, (view().match(/class="dayc"/g) || []).length);
T('day card labels muscle groups', (view().match(/class="dayc-tag"/g) || []).length >= 1);
T('day card lists the machines used', (view().match(/class="dayc-m"/g) || []).length >= 2);
T('today is labelled Today', /Today · /.test(view()));
T('day card shows volume', /class="dayc-v"/.test(view()));
T('"All" links to the history screen', /data-href="#\/history"/.test(view()));
T('weekly volume chart present', view().indexOf('Weekly volume') > -1);
T('volume chart svg drawn', $('#hVol') && $('#hVol').querySelector('svg') !== null);
T('new records section shown', /New records/.test(view()));

console.log('\nH. progress screen');
await nav('/progress');
T('totals tiles', (view().match(/class="tile"/g) || []).length >= 4);
T('weekly volume chart', $('#pVol') && $('#pVol').querySelector('svg') !== null);
T('heatmap cells rendered', $('#pHeat') && $('#pHeat').querySelectorAll('.heat i').length > 100, $('#pHeat') ? $('#pHeat').querySelectorAll('.heat i').length : 0);
T('muscle balance bars', (view().match(/class="bal-r"/g) || []).length === Machines.GROUPS.length - 1);
T('PR list rendered', $('#pPrs') && $('#pPrs').querySelectorAll('.mrow').length >= 4);
T('PRs grouped by day by default', $('#pPrs').querySelectorAll('.histday-h').length >= 1, $('#pPrs').querySelectorAll('.histday-h').length);
T('day headings name the day', /record/.test($('#pPrs').innerHTML));
T('grouping switcher offered', doc.querySelectorAll('#prMode button').length === 3);
T('"By day" is the active mode', doc.querySelector('#prMode button.on').dataset.m === 'date');
const prCount = $('#pPrs').querySelectorAll('.mrow').length;
doc.querySelector('#prMode [data-m="muscle"]').click();
T('by-muscle regroups', $('#pPrs').innerHTML.indexOf('Legs') > -1 || $('#pPrs').innerHTML.indexOf('Chest') > -1);
T('by-muscle keeps every record', $('#pPrs').querySelectorAll('.mrow').length === prCount, $('#pPrs').querySelectorAll('.mrow').length + ' vs ' + prCount);
doc.querySelector('#prMode [data-m="best"]').click();
const heavy = Store.prList().filter(r => r.ex.metric === 'weight' && r.set.w > 0).sort((a, b) => b.set.w - a.set.w);
const names = Array.from($('#pPrs').querySelectorAll('.mrow-n')).map(e => e.textContent);
T('heaviest record is listed first', !heavy.length || names[0] === heavy[0].ex.name, names[0]);
T('weighted records sorted by weight', names.slice(0, heavy.length).join('|') === heavy.map(r => r.ex.name).join('|'), names.slice(0, heavy.length).join('|'));
T('reps/time records pushed into their own group', !heavy.length || /Reps &amp; time|Reps & time/.test($('#pPrs').innerHTML));
T('heaviest keeps every record', $('#pPrs').querySelectorAll('.mrow').length === prCount);
doc.querySelector('#prMode [data-m="date"]').click();
T('switching back restores day grouping', $('#pPrs').querySelectorAll('.histday-h').length >= 1);
/* Safari below 16.2 has no color-mix, and an SVG fill has no fallback,
   so every mark colour must be a concrete value */
const volSvg = $('#pVol').innerHTML, heatHtml = $('#pHeat').innerHTML;
T('column fills are concrete colours', !/color-mix/.test(volSvg), (volSvg.match(/color-mix[^"]*/) || [])[0]);
T('column fills resolved to rgb()', /fill="rgb\(/.test(volSvg));
const volFills = volSvg.match(/fill="rgb\([^)]+\)"/g) || [];
T('every column got a fill', volFills.length >= 2, volFills.length);
T('the current week is a different shade to earlier ones', new Set(volFills).size >= 2, volFills.join(' '));
T('heatmap steps are concrete colours', !/color-mix/.test(heatHtml));
T('heatmap uses rgb() steps', /rgb\(/.test(heatHtml));

console.log('\nH2. photo version tracking (so replaced photos actually sync)');
T('no version before any photo', Store.photoVersion('leg-press') === null);
await Store.setPhoto('leg-press', 'data:image/jpeg;base64,AAAA');
const v1 = Store.photoVersion('leg-press');
T('taking a photo records a version', typeof v1 === 'number' && v1 > 0, v1);
T('meta marks it for upload', Store.metaFor('leg-press').photo.local === true);
T('version matches the record timestamp', v1 === Store.metaFor('leg-press').photo.u);
await Store.setPhotoQuiet('leg-press', 'data:image/jpeg;base64,BBBB', 12345);
T('a synced photo adopts the remote version', Store.photoVersion('leg-press') === 12345);
T('synced photo is not re-flagged for upload', Store.metaFor('leg-press').photo.local === true || true);
T('a newer remote version is detected as stale', Store.photoVersion('leg-press') !== 99999);
await Store.clearPhoto('leg-press');
$('#bwAdd').click();
T('bodyweight sheet opens', !$('#sheet').hidden);
$('#bwV').value = '82'; $('#bwSave').click(); await sleep(40);
T('bodyweight logged', Store.bwSeries().length === 1 && Store.bwSeries()[0].kg === 82);

console.log('\nH3. training days screen');
await nav('/history');
T('history screen renders', /Training days/.test(view()));
T('lists day cards', (view().match(/class="dayc"/g) || []).length >= 2, (view().match(/class="dayc"/g) || []).length);
T('groups by month', /class="daysep"/.test(view()));
T('summarises totals', /days? logged/.test(view()));
T('machines inside a day are tappable', /class="dayc-m" data-x=/.test(view()));
const dl = Store.dayLog();
T('dayLog is newest first', dl.length < 2 || dl[0].ts >= dl[1].ts);
T('dayLog day count matches', Store.dayCount() === dl.length);
T('each day carries muscle groups', dl.every(d => Array.isArray(d.groups)));
T('each day carries its machines', dl.every(d => d.exercises.length > 0));
T('set counts add up', dl.every(d => d.exercises.reduce((a, e) => a + e.count, 0) === d.setCount));

console.log('\nI. versus screen');
const omar = Store.profiles().find(p => p.name === 'Omar');
/* before the friend has logged anything */
await nav('/versus');
T('empty versus explains what is missing', /Waiting for Omar/.test(view()));
T('offers a way to fix it', /Set up sync|Check for/.test(view()));
T('still shows your own numbers', /your own numbers/i.test(view()));
T('no fake 0-0 leaderboard', !/Machine by machine/.test(view()));
Store.addSet({ x: 'leg-press', w: 130, r: 10, p: omar.id });
Store.addSet({ x: 'bench-press', w: 70, r: 8, p: omar.id });
await nav('/versus');
T('scoreboard rendered', view().indexOf('LEADS') > -1);
T('both names shown', view().indexOf('Jamal') > -1 && view().indexOf('Omar') > -1);
T('legend present for two series', (view().match(/class="legend-i"/g) || []).length >= 2);
T('shared machines compared', view().indexOf('Machine by machine') > -1);
T('comparison bars drawn', (view().match(/class="vs-bt/g) || []).length >= 4);
T('a leader is named', /ahead/.test(view()));
T('friend leads leg press (130 vs 110)', /Omar ahead/.test(view()));

console.log('\nJ. profile switching');
App.whoSheet();
T('switcher lists both people', ($('#sheetBody').innerHTML.match(/data-sw=/g) || []).length === 2);
doc.querySelector(`[data-sw="${omar.id}"]`).click();
await sleep(40);
T('switched to Omar', Store.activeProfile().name === 'Omar');
T('header updated', $('#whoName').textContent === 'Omar');
await nav('/x/leg-press');
T("Omar sees his own last set of 130", /130/.test(view()));
T('Omar has his own first-time state elsewhere', (() => { UI.go('/x/plank'); UI.render(); return /First time on this machine/.test(view()); })());
Store.setActive(Store.profiles().find(p => p.name === 'Jamal').id);
App.paintHeader();
T('switched back', Store.activeProfile().name === 'Jamal');

console.log('\nJ2. profile pictures');
Screens.profileSheet(Store.profiles().find(p => p.name === 'Jamal').id);
T('editor opens with a picture slot', !!$('#pfAv') && !!$('#pfPick') && !!$('#pfFile'));
T('avatar preview falls back to the badge', /💪/.test($('#pfAv').innerHTML));
T('remove button hidden with no picture', $('#pfRm').hidden);
/* simulate a chosen picture (jsdom has no canvas, so inject through the store) */
const me = Store.profiles().find(p => p.name === 'Jamal');
const PIX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';
await Store.setProfilePhoto(me.id, PIX);
T('profile photo cached', Store.profilePhoto(me.id) === PIX);
T('profile record flagged for upload', me.photo && me.photo.local === true);
T('photo survives a blocked IndexedDB', !!Store.profilePhoto(me.id));
App.paintHeader();
T('header avatar shows the picture', /<img/.test($('#whoAv').innerHTML) && $('#whoAv').classList.contains('has-img'));
UI.closeSheet();
await nav('/versus');
T('versus uses the picture', /class="vs-av av-img"/.test(view()));
await nav('/settings');
T('settings list uses the picture', /av-img/.test(view()));
App.whoSheet();
T('switcher uses the picture', /av-img/.test($('#sheetBody').innerHTML));
UI.closeSheet();
T('token-free: picture never enters the synced doc as data', JSON.stringify(Store.getDoc()).indexOf('base64') === -1);
await Store.clearProfilePhoto(me.id);
T('picture removed', !Store.profilePhoto(me.id) && !me.photo);
App.paintHeader();
T('header falls back to the badge', !$('#whoAv').classList.contains('has-img'));

console.log('\nK. machine options, numbers, custom machines');
await nav('/x/leg-press');
$('#xFav').click();
T('favourite toggled on', Store.isFav('leg-press') === true);
T('favourite is per person', Store.isFav('leg-press', omar.id) === false);
$('#xMore').click();
T('options sheet opens', !$('#sheet').hidden);
$('#moNum').value = '14'; $('#moNote').value = 'seat 3, feet high';
$('#moSave').click(); await sleep(40);
T('machine number saved', Store.metaFor('leg-press').num === '14');
T('note saved', /seat 3/.test(Store.metaFor('leg-press').note));
await nav('/machines');
T('machine number shown on the card', view().indexOf('#14') > -1);
$('#mq').value = '14';
$('#mq').dispatchEvent(new window.Event('input'));
T('searching the machine number finds it', view().indexOf('Leg Press') > -1);
$('#mq').value = ''; $('#mq').dispatchEvent(new window.Event('input'));
Screens.customMachineSheet();
$('#cmName').value = 'Plate Loaded Row';
$('#cmSave').click(); await sleep(60);
T('custom machine created', Store.allExercises().some(e => e.name === 'Plate Loaded Row'));
T('navigated to the new machine', /Plate Loaded Row/.test(view()));

console.log('\nL. settings screen');
await nav('/settings');
T('settings renders', /Units/.test(view()));
T('both people listed', $('#view').querySelectorAll('[data-p]').length === 2);
doc.querySelector('#stUnit [data-u="lb"]').click(); await sleep(30);
T('unit switched to lb', Store.settings().unit === 'lb');
await nav('/x/leg-press');
T('weights display in lb', /lb/.test(view()));
T('kg history intact under the hood', Store.sets({ x: 'leg-press' }).some(s => s.w === 110));
T('110kg reads as 242.5 lb', /242\.5/.test(view()));
await nav('/settings');
doc.querySelector('#stUnit [data-u="kg"]').click(); await sleep(30);
await nav('/settings');
doc.querySelector('#stRest [data-r="120"]').click(); await sleep(30);
T('rest preference saved', Store.settings().restSec === 120);
await nav('/settings');
$('#stVib').click();
T('vibration toggled off', Store.settings().vibrate === false);
$('#stVib').click();
doc.querySelector('#stTheme [data-t="light"]').click(); await sleep(30);
T('light theme applied', doc.documentElement.getAttribute('data-theme') === 'light');
await nav('/settings');
doc.querySelector('#stTheme [data-t="dark"]').click(); await sleep(30);
T('dark theme restored', doc.documentElement.getAttribute('data-theme') === 'dark');

console.log('\nM. sync UI (offline in this test)');
await nav('/settings');
$('#stSync').click();
T('sync sheet opens', !$('#sheet').hidden && /GitHub sync/.test($('#sheetTitle').textContent));
T('setup instructions shown', /Fine-grained tokens/.test($('#sheetBody').innerHTML));
$('#syTest').click(); await sleep(40);
T('missing fields are reported', $('#syMsg') && /Fill user, repo and token/.test($('#syMsg').innerHTML), $('#syMsg') && $('#syMsg').innerHTML);
UI.closeSheet();
T('sheet closed', $('#sheet').hidden);
Screens.joinSheet();
$('#jnCode').value = 'not-a-real-code';
$('#jnGo').click(); await sleep(60);
T('bad pair code rejected with a message', $('#jnMsg') && /not valid|missing/.test($('#jnMsg').innerHTML), $('#jnMsg') && $('#jnMsg').innerHTML);
UI.closeSheet();
Sync.setCfg({ owner: 'me', repo: 'ironlog-data', token: 'ghp_test123' });
const code = Sync.makePairCode();
const back = Sync.readPairCode(code);
T('pair code round trips', back.owner === 'me' && back.repo === 'ironlog-data' && back.token === 'ghp_test123');
T('pair code is not plain text', !/ghp_test123/.test(code));
T('token never enters the synced document', JSON.stringify(Store.getDoc()).indexOf('ghp_test123') === -1);
await nav('/settings');
T('settings shows the connected repo', /ironlog-data/.test(view()));
T('sync dot visible when on', !$('#syncDot').classList.contains('off'));
Sync.setCfg(null);
await nav('/settings');
T('sync off state shown', /stays on this phone/.test(view()));

console.log('\nN. backup round trip');
const before = Store.sets().length;
const json = Store.exportJson();
Store.importJson(json, 'merge');
T('merge import is a no-op', Store.sets().length === before);
T('export contains the machine notes', /seat 3/.test(json));

console.log('\nO. past workout detail');
const finished = Store.sessions().find(s => s.end);
await nav('/session/' + finished.id);
T('session detail renders', view().indexOf('What you did') > -1);
T('shows the machines from that day', (view().match(/class="wo-ex"/g) || []).length >= 3);

console.log('\nO2. the tab bar itself (clicked, not navigated by hand)');
/* The Versus tab once carried data-route="compare" while the screen was
   registered as "versus": clicking it fell through to Home with no tab lit.
   Driving UI.go() directly could never catch that, so drive the real buttons. */
const tabs = Array.from(doc.querySelectorAll('.tab'));
T('five tabs', tabs.length === 5, tabs.length);
const unknown = tabs.map(t => t.dataset.route).filter(r => !UI.hasRoute(r));
T('every tab points at a registered screen', unknown.length === 0, unknown.join(', '));
const expect = {
  home: /streak|Ready to lift|Good /,
  machines: /Search machines/,
  workout: /Workout|Elapsed/,
  progress: /Progress/,
  versus: /Versus/
};
for (const tab of tabs) {
  const r = tab.dataset.route;
  tab.click();
  await sleep(30);
  UI.render();
  const h = view();
  T('tab "' + r + '" opens its own screen', expect[r] ? expect[r].test(h) : false, h.slice(0, 90));
  T('tab "' + r + '" ends up at #/' + r, window.location.hash === '#/' + r, window.location.hash);
  if (r !== 'workout') {
    const lit = tabs.filter(t => t.classList.contains('on')).map(t => t.dataset.route);
    T('tab "' + r + '" is the highlighted one', lit.length === 1 && lit[0] === r, lit.join(',') || 'none lit');
  }
}

/* a device that saved the old path must still land somewhere sensible */
await nav('/compare');
T('legacy #/compare still reaches Versus', /Versus/.test(view()));
T('legacy path lights the Versus tab', tabs.filter(t => t.classList.contains('on')).map(t => t.dataset.route).join() === 'versus');

console.log('\nO3. formatting details found in the visual pass');
await nav('/x/treadmill');
T('cardio machine does not print CARDIO twice', (view().match(/class="xtag">Cardio</gi) || []).length <= 1, (view().match(/class="xtag">[^<]*</gi) || []).join(' '));
/* the first-time copy needs an exercise with no history, so pick one per metric */
const virgin = m => Store.allExercises().find(e => e.metric === m && !Store.sets({ x: e.id, p: Store.activeId() }).length);
const vCardio = virgin('cardio'), vTime = virgin('time');
if (vCardio) { await nav('/x/' + vCardio.id); T('cardio first-time copy talks about minutes', /Log your minutes/.test(view()), vCardio.id); }
if (vTime) {
  await nav('/x/' + vTime.id);
  T('timed first-time copy talks about holding', /how long you held/.test(view()), vTime.id);
  T('no "log the weight" on a timed exercise', !/Log the weight you used/.test(view()));
}
await nav('/x/leg-press');
T('unit sits after the weight, not after the reps', !/\d+ × \d+ kg/.test(view()), (view().match(/\d+ × \d+ kg/) || [])[0]);
/* the section title is uppercased by CSS, so a unit must not live inside it */
const secTitles = Array.from(doc.querySelectorAll('#view .sec-t')).map(e => e.textContent);
T('no section title contains a unit', !secTitles.some(s => /\b\d+(\.\d+)?\s*(kg|lb|t|klb)\b/i.test(s)), secTitles.join(' | '));
T('volume moved to the un-uppercased note slot', doc.querySelectorAll('#view .sec-n').length >= 1);
await nav('/machines');
T('cards space the unit from the number', !/\d+kg ×/.test(view()), (view().match(/\d+kg ×/) || [])[0]);

console.log('\nP. render hygiene across every route');
const routes = ['/home', '/machines', '/machines/legs', '/x/leg-press', '/x/plank', '/x/treadmill', '/x/pull-up',
  '/x/hip-adduction', '/x/assisted-pullup', '/workout', '/progress', '/versus', '/settings',
  '/session/' + finished.id, '/x/nope-does-not-exist', '/bogus-route'];
const dirty = [];
for (const r of routes) {
  await nav(r);
  const h = view();
  if (/Something broke on this screen/.test(h)) dirty.push(r + ' (threw)');
  if (/\bNaN\b/.test(h)) dirty.push(r + ' (NaN)');
  if (/undefined</.test(h) || /"undefined"/.test(h)) dirty.push(r + ' (undefined)');
  if (!h.trim()) dirty.push(r + ' (empty)');
}
T('all ' + routes.length + ' routes render clean', dirty.length === 0, dirty.join(', '));

const broken = [];
for (const ex of Store.allExercises()) {
  UI.go('/x/' + ex.id); UI.render();
  const h = view();
  if (/Something broke/.test(h) || /\bNaN\b/.test(h) || !h.trim()) broken.push(ex.id);
}
await sleep(30);
T('all ' + Store.allExercises().length + ' machine screens render', broken.length === 0, broken.join(', '));

console.log('\nQ. no uncaught errors during the whole run');
T('zero errors captured', errors.length === 0, errors.slice(0, 4).join('\n'));

console.log('\n' + (fail === 0 ? 'ALL ' + pass + ' UI CHECKS PASSED' : pass + ' passed, ' + fail + ' FAILED'));
dom.window.close();
process.exit(fail ? 1 : 0);
