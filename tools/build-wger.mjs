/* =========================================================
   Builds js/wger.js + img/ex/* from the wger.de open exercise database.
   Run:  node tools/build-wger.mjs
   Needs network. Re-run to refresh; output is committed to the repo so the
   app never depends on wger being online.

   Two separate jobs:
     1. MAP  — hand-verified: give an existing IronLog machine a real photo.
               Only pairs that mean the SAME exercise are listed. A wrong
               photo is worse than a drawing, so nothing here is guessed.
     2. ADD  — everything else with an image becomes a new exercise using
               wger's own name, so name and picture always agree.
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const IMGDIR = path.join(ROOT, 'img', 'ex');
const BASE = 'https://wger.de/api/v2';

/* ---------- 1. hand-verified mapping: wger id -> IronLog machine id ---------- */
const MAP = {
  /* chest */
  129: 'chest-press-machine', 539: 'incline-press-machine', 926: 'pec-deck',
  323: 'cable-crossover', 73: 'bench-press', 537: 'incline-db-press',
  238: 'db-fly', 925: 'smith-bench', 194: 'dips-chest', 1551: 'push-up',
  /* back */
  158: 'lat-pulldown', 1127: 'lat-pulldown-close', 1117: 'seated-cable-row',
  513: 't-bar-row', 1283: 'chest-supported-row', 83: 'barbell-row',
  184: 'deadlift', 1726: 'straight-arm-pulldown', 475: 'pull-up',
  571: 'shrug-barbell', 572: 'shrug-db',
  /* shoulders */
  543: 'shoulder-press-machine', 567: 'db-shoulder-press', 1893: 'overhead-press',
  348: 'lateral-raise-db', 1378: 'lateral-raise-cable', 256: 'front-raise',
  691: 'upright-row',
  /* arms */
  91: 'barbell-curl', 465: 'preacher-curl', 92: 'db-curl', 272: 'hammer-curl',
  95: 'cable-curl', 1185: 'triceps-pushdown', 659: 'overhead-triceps-cable',
  246: 'skullcrusher', 197: 'dips-triceps',
  /* legs */
  371: 'leg-press', 375: 'hack-squat', 1801: 'squat', 1747: 'smith-squat',
  369: 'leg-extension', 366: 'leg-curl-seated', 365: 'leg-curl-lying',
  1652: 'romanian-deadlift', 1706: 'bulgarian-split', 203: 'goblet-squat',
  206: 'walking-lunge',
  /* glutes + calves */
  1748: 'hip-abduction', 12: 'hip-adduction', 1131: 'cable-kickback',
  1348: 'back-extension', 1620: 'calf-seated', 622: 'calf-standing',
  146: 'calf-leg-press',
  /* core + cardio */
  979: 'hanging-leg-raise', 978: 'captains-chair', 458: 'plank',
  1615: 'treadmill', 1618: 'bike'
};

/* ---------- 2. things that are not gym exercises ---------- */
const SKIP = /stretch|foam roller|blackroll|mobility|hip circles|hip crossover|ankle roll|dorsiflexion|banded ankle|head (turns|tilts)|child'?s pose|arabesque|sloper|claps over|bus drivers|talons|suspended crossess|remo maquina|mu.eca|extensi.n|hand grip|tuck planche|knee to chest|figure four|pigeon|runners lunge|it band|plantarflexion|blackroll/i;

/* ---------- helpers ---------- */
const getJson = async p => {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(BASE + p, { headers: { Accept: 'application/json' } });
      if (r.ok) return r.json();
      if (r.status === 429) { await sleep(3000); continue; }
      throw new Error(r.status + ' on ' + p);
    } catch (e) { if (a === 4) throw e; await sleep(1500); }
  }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function all(p) {
  const out = []; let url = p;
  while (url) { const j = await getJson(url); out.push(...j.results); url = j.next ? j.next.replace(BASE, '') : null; }
  return out;
}

/* wger category -> IronLog group */
const GROUP = { Abs: 'core', Arms: 'arms', Back: 'back', Calves: 'calves', Cardio: 'cardio', Chest: 'chest', Legs: 'legs', Shoulders: 'shoulders' };
const GLUTE = /glute|hip thrust|kickback|donkey|abduction|adduction|bridge/i;

/* wger equipment -> IronLog equip + weight step */
function equipOf(names, name) {
  const has = s => names.some(n => n.toLowerCase().includes(s));
  if (has('cable')) return 'cable';
  if (has('barbell') || has('sz-bar')) return 'barbell';
  if (has('dumbbell') || has('kettlebell')) return 'dumbbell';
  if (has('band') || has('pull-up bar') || has('gym mat') || has('swiss ball') || has('none')) return 'bodyweight';
  if (has('bench') || has('incline bench')) return /dumbbell/i.test(name) ? 'dumbbell' : 'barbell';
  return 'machine';                    /* empty equipment in wger almost always means a machine */
}

/* SVG fallback drawing, by keyword — used until the photo loads, and if it fails */
function artOf(name, group, equip) {
  const n = name.toLowerCase();
  const t = [
    [/hackenschmidt|hack|pendular/, 'hackSquat'], [/leg press/, 'legPress'],
    [/leg extension/, 'legExtension'],
    [/leg curl.*(lay|lying|prone)/, 'legCurlLying'], [/leg curl|hamstring curl/, 'legCurlSeated'],
    [/abduction/, 'abductor'], [/adduction/, 'adductor'],
    [/hip thrust|bridge/, 'hipThrustMachine'], [/kickback|donkey|glute extension/, 'gluteKickback'],
    [/calf press/, 'legPress'], [/calf.*(seat|sitting)/, 'calfSeated'], [/calf|heel raise/, 'calfStanding'],
    [/smith/, 'smithMachine'],
    [/pulldown|pull down|pullover/, 'latPulldown'],
    [/t-bar/, 'tBarRow'], [/chest.?supported/, 'chestSupportedRow'],
    [/(seated|long.?pulley|low).*row|row \(machine\)|rowing seated|cable row/, 'seatedRow'],
    [/bent over row|barbell row|inverted row|one arm bent/, 'barbellFloor'],
    [/straight.?arm/, 'straightArm'],
    [/chin|pull-?up|pullup|hang/, 'pullupBar'],
    [/machine chest fly|butterfly|pec deck/, 'pecDeck'],
    [/cross.?over|fly with cable|cable.*fly/, 'cableCrossover'],
    [/rear delt/, 'reversePecDeck'],
    [/chest press|hammerstrength/, 'pressMachine'],
    [/incline.*(press|bench)/, 'benchIncline'], [/bench press|floor press|hex press|decline press/, 'benchFlat'],
    [/dip/, 'dipStation'],
    [/shoulder press|military|push press|clean and press|overhead press|smith press|trap press/, 'shoulderPressMachine'],
    [/upright row/, 'barbellFloor'],
    [/shrug/, 'barbellFloor'],
    [/preacher/, 'preacherCurl'],
    [/curl.*cable|cable.*curl|hammercurls on cable/, 'cableTower'],
    [/wrist curl|forearm/, 'preacherCurl'],
    [/curl/, /dumbbell|kettlebell/.test(n) ? 'dumbbellSingle' : 'barbellFloor'],
    [/pushdown/, 'pushdown'], [/skullcrusher/, 'benchFlat'],
    [/triceps ext|tricep ext|overhead.*tricep/, /cable/.test(n) ? 'cableTower' : 'tricepsMachine'],
    [/lateral rais|side lateral|front rais|shoulder rais/, /cable/.test(n) ? 'cableTower' : 'dumbbellPair'],
    [/face pull/, 'cableTower'], [/pallof/, 'cableTower'],
    [/deadlift/, 'barbellFloor'],
    [/squat/, /dumbbell|kettlebell|goblet/.test(n) ? 'dumbbellPair' : /pistol|slow|box|isometric/.test(n) ? 'plank' : 'powerRack'],
    [/lunge|step-?up|split squat/, 'dumbbellPair'],
    [/good morning/, 'barbellFloor'],
    [/hyperextension|back extension/, 'hyperextension'],
    [/snatch|swing|clean/, 'kettlebell'],
    [/treadmill/, 'treadmill'], [/bike|cycling/, 'stationaryBike'], [/elliptical/, 'elliptical'],
    [/stair/, 'stairMaster'], [/row.*erg|erg/, 'rowErg'],
    [/torso twist|russian|twist|side bend/, 'torsoRotation'],
    [/crunch|sit ?up|hollow|ab wheel|rollout|knee tuck|leg raise|knee raise|bird dog|quadriped|plank/, /crunch/.test(n) ? 'abCrunchMachine' : 'plank'],
    [/press/, 'pressMachine'], [/fly/, 'pecDeck'], [/row/, 'seatedRow']
  ];
  for (const [re, art] of t) if (re.test(n)) return art;
  if (group === 'cardio') return 'treadmill';
  if (equip === 'dumbbell') return 'dumbbellPair';
  if (equip === 'barbell') return 'barbellFloor';
  if (equip === 'cable') return 'cableTower';
  if (equip === 'bodyweight') return 'plank';
  return 'generic';
}

function metricOf(name, group, equip) {
  const n = name.toLowerCase();
  if (group === 'cardio') return 'cardio';
  if (/plank|hold|hang|isometric|wall sit/.test(n)) return 'time';
  if (equip === 'bodyweight') return 'reps';
  return 'weight';
}
const stepOf = (equip, name) => {
  if (/leg press|squat|deadlift|hack|calf|hip thrust/i.test(name)) return 5;
  if (equip === 'dumbbell') return 2;
  if (/lateral rais|front rais|rear delt|face pull/i.test(name)) return 1.25;
  return 2.5;
};

/* keep an id stable and readable */
const slug = s => 'w-' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46);

/* ---------- go ---------- */
console.log('fetching wger…');
const [info, images] = await Promise.all([all('/exerciseinfo/?limit=100'), all('/exerciseimage/?limit=100')]);
console.log('  ' + info.length + ' exercises, ' + images.length + ' images');

const nameOf = {}, metaOf = {};
info.forEach(b => {
  const tr = (b.translations || []).filter(t => t.language === 2 && t.name);
  if (tr.length) nameOf[b.id] = tr[0].name.trim().replace(/\s+/g, ' ');
  metaOf[b.id] = {
    cat: b.category ? b.category.name : null,
    equip: (b.equipment || []).map(e => e.name),
    musc: (b.muscles || []).map(m => m.name_en || m.name).filter(Boolean)
  };
});

/* best image per exercise: prefer the main one, then a human-made one */
const best = {};
images.forEach(i => {
  const url = i.thumbnails && i.thumbnails.medium;
  if (!url) return;
  const s = (i.is_main ? 2 : 0) + (i.is_ai_generated ? 0 : 1);
  if (!best[i.exercise] || s > best[i.exercise].s) best[i.exercise] = { s, url, lic: i.license, author: (i.license_author || '').trim(), ai: i.is_ai_generated };
});

/* IronLog's own catalog, to know which ids exist */
const ctx = vm.createContext({ window: {}, console });
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'machines.js'), 'utf8'), ctx);
const MINE = new Set(ctx.Machines.EXERCISES.map(e => e.id));
const ART_KEYS = new Set(ctx.Machines.ART_KEYS);
Object.values(MAP).forEach(id => { if (!MINE.has(id)) console.warn('  ! MAP target not in catalog: ' + id); });

const LICENSES = { 1: 'CC-BY-SA 3.0', 2: 'CC-BY-SA 4.0', 3: 'CC0', 4: 'CC-BY 4.0', 5: 'ODbL' };

fs.mkdirSync(IMGDIR, { recursive: true });
const photos = {};        /* IronLog exercise id -> image file */
const added = [];
const credits = [];
let downloaded = 0, reused = 0, skipped = 0;

async function grab(wid, url) {
  const ext = (url.match(/\.(png|jpe?g|webp|gif)(?:$|\?)/i) || [, 'png'])[1].toLowerCase();
  const file = wid + '.' + ext;
  const dest = path.join(IMGDIR, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 500) { reused++; return file; }
  const r = await fetch(url);
  if (!r.ok) throw new Error('image ' + r.status);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  downloaded++;
  return file;
}

const ids = Object.keys(best).map(Number).sort((a, b) => a - b);
for (const wid of ids) {
  const name = nameOf[wid];
  const meta = metaOf[wid] || {};
  if (!name) { skipped++; continue; }
  const mapped = MAP[wid];
  if (!mapped && SKIP.test(name)) { skipped++; continue; }
  if (!/[a-z]/i.test(name.replace(/[^a-z]/gi, '')) || name.length < 3) { skipped++; continue; }

  let file;
  try { file = await grab(wid, best[wid].url); }
  catch (e) { console.warn('  image failed for ' + wid + ' ' + name + ': ' + e.message); continue; }

  credits.push({ wid, name, file, lic: LICENSES[best[wid].lic] || 'see wger.de', author: best[wid].author, ai: best[wid].ai });

  if (mapped) { photos[mapped] = file; continue; }

  /* a brand new exercise, named by wger so the picture always matches */
  const group0 = GROUP[meta.cat] || 'core';
  const group = (group0 === 'legs' && GLUTE.test(name)) ? 'glutes' : group0;
  const equip = equipOf(meta.equip || [], name);
  const art = artOf(name, group, equip);
  if (!ART_KEYS.has(art)) { console.warn('  ! unknown art key ' + art + ' for ' + name); }
  const id = slug(name);
  added.push({
    id, name, group, art, equip,
    metric: metricOf(name, group, equip),
    step: stepOf(equip, name),
    photo: file,
    muscles: (meta.musc || []).slice(0, 3),
    wger: wid
  });
}

/* de-duplicate ids and names */
const seenId = new Set(), seenName = new Set();
const clean = added.filter(e => {
  const nk = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seenId.has(e.id) || seenName.has(nk)) return false;
  seenId.add(e.id); seenName.add(nk); return true;
});

/* ---------- emit js/wger.js ---------- */
const out = `/* =========================================================
   GENERATED by tools/build-wger.mjs — do not edit by hand.

   Exercise names, photos and muscle data come from the wger.de open
   fitness database (https://wger.de), used under the licences recorded
   in ATTRIBUTION.md. Images live in img/ex/ so the app works offline.

   PHOTOS attaches a real photo to a hand-picked IronLog machine.
   EXTRA adds ${clean.length} further exercises that ship with their own picture.
   ========================================================= */
(function (global) {
  'use strict';
  var DIR = 'img/ex/';

  /* IronLog machine id -> photo file (hand-verified pairs only) */
  var PHOTOS = ${JSON.stringify(photos, null, 2).replace(/\n/g, '\n  ')};

  var EXTRA = ${JSON.stringify(clean.map(e => ({
  id: e.id, name: e.name, group: e.group, art: e.art, equip: e.equip,
  metric: e.metric, step: e.step, photo: e.photo, muscles: e.muscles, wger: e.wger
})), null, 1).replace(/\n/g, '\n  ')};

  if (!global.Machines) { console.error('wger.js loaded before machines.js'); return; }

  Object.keys(PHOTOS).forEach(function (id) {
    var ex = global.Machines.EXERCISES.filter(function (e) { return e.id === id; })[0];
    if (ex) ex.photo = DIR + PHOTOS[id];
  });

  EXTRA.forEach(function (e) {
    e.photo = DIR + e.photo;
    e.unilateral = false;
    global.Machines.EXERCISES.push(e);
  });

  global.Machines.PHOTO_DIR = DIR;
  global.Machines.WGER_COUNT = EXTRA.length + Object.keys(PHOTOS).length;
})(window);
`;
fs.writeFileSync(path.join(ROOT, 'js', 'wger.js'), out);

/* ---------- emit ATTRIBUTION.md ---------- */
const byLic = {};
credits.forEach(c => { (byLic[c.lic] || (byLic[c.lic] = [])).push(c); });
const attrib = `# Attribution

Exercise names, muscle data and images in \`img/ex/\` come from the
[**wger** open fitness database](https://wger.de) (wger.de/en/software/api),
a free/open-source workout manager. Exercise *data* is licensed
**CC-BY-SA 4.0**; each image carries its own licence, listed below.

Nothing here was modified apart from being resized to wger's own 400px
thumbnail, which their API serves directly.

The hand-drawn SVG machine illustrations in \`js/machines.js\` are original
to this project and are not from wger.

${Object.keys(byLic).sort().map(lic => `## ${lic}\n\n` +
  byLic[lic].map(c => `- **${c.name}** — \`img/ex/${c.file}\`${c.author ? ' — ' + c.author : ''}${c.ai ? ' _(AI generated)_' : ''} — [wger #${c.wid}](https://wger.de/en/exercise/${c.wid}/view/)`).join('\n')
).join('\n\n')}

---

Generated by \`tools/build-wger.mjs\`. ${credits.length} images in total.
`;
fs.writeFileSync(path.join(ROOT, 'ATTRIBUTION.md'), attrib);

const bytes = fs.readdirSync(IMGDIR).reduce((a, f) => a + fs.statSync(path.join(IMGDIR, f)).size, 0);
console.log('\nphotos attached to existing machines: ' + Object.keys(photos).length + ' / ' + Object.keys(MAP).length + ' mapped');
console.log('new exercises added:                 ' + clean.length);
console.log('skipped (stretching, mobility, junk):' + skipped);
console.log('images: ' + downloaded + ' downloaded, ' + reused + ' already local, ' +
  fs.readdirSync(IMGDIR).length + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB');
console.log('wrote js/wger.js and ATTRIBUTION.md');
