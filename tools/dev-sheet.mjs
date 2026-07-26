/* Dev helper: writes _sheet.html — several app screens side by side in one
   page, so a single screenshot covers a whole review pass.

   Usage: node tools/dev-sheet.mjs <height> <file#route> <file#route> ...
   e.g.   node tools/dev-sheet.mjs 900 _preview.html#/home _preview.html#/machines

   IMPORTANT: use ONE preview file per sheet. Every iframe shares the page's
   origin, so mixing _preview.html with _live.html or _empty.html means they
   overwrite each other's localStorage and whichever loads last wins.
*/
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const height = parseInt(args[0], 10) || 900;
const targets = args.slice(1);
if (!targets.length) { console.error('give me at least one file#route'); process.exit(1); }
const files = [...new Set(targets.map(t => t.split('#')[0]))];
if (files.length > 1) {
  console.error('refusing: ' + files.join(' + ') + ' share one origin and would clobber each ' +
    "other's localStorage. Use one preview file per sheet.");
  process.exit(1);
}

const cells = targets.map((t, i) => {
  const label = t.split('#')[1] || '/home';
  const file = t.split('#')[0];
  const kind = file.indexOf('empty') > -1 ? 'empty' : 'data';
  return `<figure>
    <figcaption>${label}  <em>${kind}</em></figcaption>
    <div class="win"><iframe src="${t}" scrolling="no"></iframe></div>
  </figure>`;
}).join('');

fs.writeFileSync(path.join(process.cwd(), '_sheet.html'), `<!DOCTYPE html>
<meta charset="utf-8"><title>review sheet</title>
<style>
  html,body{margin:0;background:#000;font:13px system-ui;color:#eee}
  body{display:flex;gap:10px;padding:10px;align-items:flex-start}
  figure{margin:0}
  figcaption{padding:0 0 6px 4px;font-weight:700;color:#8ab4f8}
  figcaption em{color:#777;font-style:normal;font-weight:500}
  .win{width:412px;height:${height}px;overflow:hidden;border:1px solid #222;border-radius:10px}
  iframe{width:412px;height:${height}px;border:0;display:block}
</style>
${cells}
`);
console.log('wrote _sheet.html with ' + targets.length + ' screens at ' + height + 'px tall');
