/* Dev helper: builds a realistic training history and writes _preview.html,
   a copy of the app with that history pre-loaded. For taking screenshots and
   eyeballing screens that need data. Never deployed — _preview.html is gitignored.

   Usage:  node tools/dev-seed.mjs   then open http://localhost:8080/_preview.html
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const mem = new Map();
const localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear()
};
const win = { localStorage, console }; win.window = win;
const ctx = vm.createContext(win);
Object.assign(ctx, { localStorage, setTimeout, clearTimeout, TextEncoder, TextDecoder });
for (const f of ['js/machines.js', 'js/wger.js', 'js/store.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const { Store } = ctx;
await Store.load();

const A = Store.addProfile('Jamal', 'blue', '💪');
const B = Store.addProfile('Omar', 'orange', '🔥');
Store.setActive(A.id);
const DAY = 864e5;

let seed = 20260725;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* a proper 3-day split so each day card shows distinct muscle groups */
const SPLIT = [
  { name: 'push', work: [['chest-press-machine', 45], ['incline-press-machine', 35], ['pec-deck', 40], ['shoulder-press-machine', 30], ['triceps-pushdown', 25]] },
  { name: 'pull', work: [['lat-pulldown', 45], ['seated-cable-row', 40], ['rear-delt-machine', 25], ['biceps-curl-machine', 25], ['hammer-curl', 12]] },
  { name: 'legs', work: [['leg-press', 90], ['leg-extension', 40], ['leg-curl-seated', 35], ['calf-seated', 45], ['hip-thrust-machine', 60]] }
];

function build(pid, weeks, strength) {
  Store.setActive(pid);
  let i = 0;
  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < 3; d++) {
      const day = SPLIT[i++ % 3];
      const daysAgo = w * 7 + (2 - d) * 2;
      const when = Date.now() - daysAgo * DAY - Math.floor(rnd() * 5 + 2) * 36e5;
      const ses = { id: Store.uid(), p: pid, start: when, end: when + (50 + Math.floor(rnd() * 20)) * 60000, title: '', u: when };
      Store.getDoc().sessions.push(ses);
      day.work.forEach(([xid, base]) => {
        const ex = Store.exercise(xid);
        const step = ex.step || 2.5;
        const target = Math.round((base * strength + (weeks - 1 - w) * step * 0.5) / step) * step;
        const n = 3 + (rnd() > 0.7 ? 1 : 0);
        for (let s = 0; s < n; s++) {
          const reps = s === 0 ? 12 : s === n - 1 ? 8 + Math.floor(rnd() * 2) : 10;
          const drop = s === 0 ? 0 : step * (rnd() > 0.6 ? 1 : 0);
          const st = Store.addSet({ x: xid, w: Math.max(step, target - drop), r: reps, sid: ses.id, p: pid });
          st.t = when + s * 3 * 60000 + Math.floor(rnd() * 30000);
          st.u = st.t;
        }
      });
    }
  }
  for (let w = weeks - 1; w >= 0; w--) {
    Store.getDoc().bw.push({
      id: Store.uid(), p: pid, u: Date.now(), t: Date.now() - w * 7 * DAY,
      kg: Math.round((strength === 1 ? 82 - (weeks - 1 - w) * 0.2 : 74 + (weeks - 1 - w) * 0.1) * 10) / 10
    });
  }
}

build(A.id, 9, 1);
build(B.id, 9, 0.86);
Store.setActive(A.id);

[['leg-press', '12'], ['chest-press-machine', '3'], ['lat-pulldown', '7'], ['pec-deck', '5'],
['leg-extension', '14'], ['seated-cable-row', '9'], ['shoulder-press-machine', '2']]
  .forEach(([id, num]) => Store.setMeta(id, { num }));
Store.setMeta('leg-press', { num: '12', note: 'Seat position 3, feet high on the plate.' });
['leg-press', 'chest-press-machine', 'lat-pulldown', 'hip-thrust-machine'].forEach(id => Store.toggleFav(id));
Store.setSetting('restSec', 90);
Store.save();
Store.flush();                     /* writes are debounced — force it out before reading */

const device = JSON.stringify({
  activeProfile: A.id, theme: 'dark', view: 'grid', lastRoute: '#/home',
  onboarded: true, sync: null, seenTips: {}, installDismissed: true
});
const inject = `<script>
localStorage.setItem('il.doc', ${JSON.stringify(localStorage.getItem('il.doc'))});
localStorage.setItem('il.device', ${JSON.stringify(device)});
</script>
`;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="js/machines.js"></script>', inject + '<script src="js/machines.js"></script>');
fs.writeFileSync(path.join(ROOT, '_preview.html'), html);

const t = Store.totals(A.id);
console.log('seeded ' + Store.getDoc().sets.length + ' sets across 2 people');
console.log('  ' + A.name + ': ' + t.sets + ' sets, ' + t.workouts + ' workouts, ' + Store.dayCount(A.id) + ' training days');
console.log('wrote _preview.html — open http://localhost:8080/_preview.html');
