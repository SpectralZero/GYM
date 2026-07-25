/* =========================================================
   IRONLOG — charts (no libraries, pure SVG)
   Mark specs: 2px lines, >=8px markers with a 2px surface ring,
   <=24px bars with 4px rounded data-ends on a zero baseline,
   hairline solid gridlines, text in text tokens (never series color).
   Every plot gets a touch tooltip.
   ========================================================= */
(function (global) {
  'use strict';

  const W = 320;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = (n, p = 1) => Math.round(n * Math.pow(10, p)) / Math.pow(10, p);

  function niceTicks(min, max, count) {
    count = count || 4;
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { min = min - 1; max = max + 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0 || 1)));
    const norm = step0 / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(R(v, 6));
    return { ticks, lo, hi };
  }

  const shortDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  /* ---------------------------------------------------------
     Colour helpers. An SVG `fill` has no fallback mechanism, so
     color-mix() would silently drop the mark on Safari below 16.2.
     Resolve CSS variables and blend numerically instead — works
     in every browser and costs nothing.
  --------------------------------------------------------- */
  let varCache = {}, varTheme = null;
  function cssVar(name, fallback) {
    const theme = document.documentElement.getAttribute('data-theme') || '';
    if (theme !== varTheme) { varCache = {}; varTheme = theme; }
    if (varCache[name] != null) return varCache[name];
    let v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) { }
    return (varCache[name] = v || fallback);
  }
  function parseColor(c) {
    c = String(c || '').trim();
    if (c.charAt(0) === '#') {
      if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
      if (c.length >= 7) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[,\s/]+/).map(Number); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
    return null;
  }
  /* resolve a colour that may be a var(--x) reference into concrete rgb */
  function resolve(c, fallback) {
    const m = String(c || '').match(/var\(\s*(--[\w-]+)\s*\)/);
    const raw = m ? cssVar(m[1], fallback) : c;
    return parseColor(raw) || parseColor(fallback) || [57, 135, 229];
  }
  const rgb = a => 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')';
  const blend = (a, b, t) => rgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  const SURFACE = () => resolve('var(--surface)', '#1a1a19');
  const ACCENT = () => resolve('var(--accent)', '#3987e5');

  /* ---------------------------------------------------------
     LINE — progress over time. One series = no legend box.
     opts: {series:[{name,color,points:[{t,y,meta}]}], height, yFmt, zeroBase, xFmt}
  --------------------------------------------------------- */
  function line(host, opts) {
    const H = opts.height || 150;
    const padL = 34, padR = 12, padT = 12, padB = 22;
    const series = (opts.series || []).filter(s => s.points && s.points.length);
    if (!series.length) { host.innerHTML = ''; return; }

    const all = series.flatMap(s => s.points);
    const xs = all.map(p => p.t), ys = all.map(p => p.y);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    if (opts.zeroBase) minY = 0;
    else { const sp = (maxY - minY) || Math.max(1, maxY * 0.1); minY -= sp * 0.18; maxY += sp * 0.18; if (minY < 0 && Math.min(...ys) >= 0) minY = 0; }
    const { ticks, lo, hi } = niceTicks(minY, maxY, 3);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const spanX = (maxX - minX) || 1;

    const px = t => padL + (t - minX) / spanX * (W - padL - padR);
    const py = v => padT + (1 - (v - lo) / ((hi - lo) || 1)) * (H - padT - padB);

    let g = '';
    ticks.forEach(v => {
      g += `<line x1="${padL}" y1="${R(py(v))}" x2="${W - padR}" y2="${R(py(v))}" stroke="var(--grid)" stroke-width="1"/>`;
      g += `<text x="${padL - 6}" y="${R(py(v) + 3.5)}" text-anchor="end" font-size="9.5" fill="var(--muted)" style="font-variant-numeric:tabular-nums">${esc(opts.yFmt ? opts.yFmt(v) : v)}</text>`;
    });

    let marks = '', dots = '';
    series.forEach((s, si) => {
      const pts = s.points.slice().sort((a, b) => a.t - b.t);
      const color = s.color || 'var(--accent)';
      const d = pts.map((p, i) => (i ? 'L' : 'M') + R(px(p.t)) + ' ' + R(py(p.y))).join('');
      if (opts.area !== false && series.length === 1) {
        marks += `<path d="${d}L${R(px(pts[pts.length - 1].t))} ${R(py(lo))}L${R(px(pts[0].t))} ${R(py(lo))}Z" fill="${color}" fill-opacity=".10"/>`;
      }
      marks += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((p, i) => {
        const last = i === pts.length - 1;
        if (pts.length <= 14 || last) {
          const r = last ? 4.5 : 3.2;
          dots += `<circle cx="${R(px(p.t))}" cy="${R(py(p.y))}" r="${r}" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
        }
      });
      /* direct end-label on the single-series case */
      if (series.length === 1 && opts.endLabel !== false) {
        const lp = pts[pts.length - 1];
        const lx = px(lp.t), ly = py(lp.y);
        const txt = opts.yFmt ? opts.yFmt(lp.y) : String(lp.y);
        const anchor = lx > W - padR - 34 ? 'end' : 'start';
        dots += `<text x="${R(anchor === 'end' ? lx - 8 : lx + 8)}" y="${R(ly - 8)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="var(--text)" style="font-variant-numeric:tabular-nums">${esc(txt)}</text>`;
      }
    });

    const xlab = (t, anchor) => `<text x="${R(Math.min(Math.max(px(t), padL), W - padR))}" y="${H - 5}" text-anchor="${anchor}" font-size="9.5" fill="var(--muted)">${esc((opts.xFmt || shortDate)(t))}</text>`;
    let axis = `<line x1="${padL}" y1="${R(py(lo))}" x2="${W - padR}" y2="${R(py(lo))}" stroke="var(--axis)" stroke-width="1"/>`;
    axis += xlab(minX, 'start');
    if (spanX > 864e5) axis += xlab(maxX, 'end');

    host.innerHTML =
      `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'progress chart')}">` +
      g + axis + marks + `<g id="cross"></g>` + dots + `</svg><div class="tip" hidden></div></div>`;

    attachTip(host, series, px, py, W, H, opts);
    if (series.length > 1) host.insertAdjacentHTML('beforeend', legend(series));
  }

  function legend(series) {
    return '<div class="legend">' + series.map(s =>
      `<span class="legend-i"><i class="legend-k" style="background:${s.color || 'var(--accent)'}"></i>${esc(s.name || '')}</span>`).join('') + '</div>';
  }

  function attachTip(host, series, px, py, W, H, opts) {
    const wrap = host.querySelector('.chart-wrap');
    const svg = wrap.querySelector('svg');
    const tip = wrap.querySelector('.tip');
    const cross = svg.querySelector('#cross');
    const flat = series[0].points.slice().sort((a, b) => a.t - b.t);

    function move(clientX) {
      const rect = svg.getBoundingClientRect();
      const vx = (clientX - rect.left) / rect.width * W;
      let best = null, bd = Infinity;
      flat.forEach(p => { const d = Math.abs(px(p.t) - vx); if (d < bd) { bd = d; best = p; } });
      if (!best) return;
      const bx = px(best.t);
      cross.innerHTML = `<line x1="${R(bx)}" y1="8" x2="${R(bx)}" y2="${H - 22}" stroke="var(--axis)" stroke-width="1"/>`;
      const rows = series.map(s => {
        const m = s.points.find(p => p.t === best.t);
        return m ? (series.length > 1 ? (s.name + ': ') : '') + (opts.yFmt ? opts.yFmt(m.y) : m.y) + (m.meta ? '' : '') : null;
      }).filter(Boolean);
      const meta = best.meta ? `<i>${esc(best.meta)}</i>` : '';
      tip.innerHTML = `<b>${esc(rows.join('  ·  '))}</b><i>${esc((opts.xFmt || shortDate)(best.t))}</i>${meta}`;
      tip.hidden = false;
      const leftPct = Math.min(88, Math.max(12, bx / W * 100));
      tip.style.left = leftPct + '%';
      tip.style.top = Math.max(26, py(best.y) / H * rect.height - 8) + 'px';
    }
    const end = () => { tip.hidden = true; cross.innerHTML = ''; };
    wrap.addEventListener('pointerdown', e => { move(e.clientX); });
    wrap.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') move(e.clientX); });
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointerleave', end);
    wrap.addEventListener('pointercancel', end);
  }

  /* ---------------------------------------------------------
     COLUMNS — weekly volume. Zero baseline, 4px rounded caps.
  --------------------------------------------------------- */
  function columns(host, opts) {
    const data = opts.data || [];
    if (!data.length) { host.innerHTML = ''; return; }
    const H = opts.height || 132;
    const padL = 30, padR = 8, padT = 14, padB = 20;
    const maxV = Math.max(...data.map(d => d.value), 1);
    const { ticks, hi } = niceTicks(0, maxV, 2);
    const band = (W - padL - padR) / data.length;
    const bw = Math.min(24, band - 8);
    const py = v => padT + (1 - v / (hi || 1)) * (H - padT - padB);
    const colorRgb = resolve(opts.color || 'var(--accent)', '#3987e5');
    const color = rgb(colorRgb);
    const dim = blend(colorRgb, SURFACE(), 0.54);   /* earlier weeks recede */

    let g = '';
    ticks.forEach(v => {
      g += `<line x1="${padL}" y1="${R(py(v))}" x2="${W - padR}" y2="${R(py(v))}" stroke="var(--grid)" stroke-width="1"/>`;
      g += `<text x="${padL - 6}" y="${R(py(v) + 3.5)}" text-anchor="end" font-size="9.5" fill="var(--muted)" style="font-variant-numeric:tabular-nums">${esc(opts.yFmt ? opts.yFmt(v) : v)}</text>`;
    });
    let bars = '';
    data.forEach((d, i) => {
      const x = padL + band * i + (band - bw) / 2;
      const top = py(d.value), h = Math.max(d.value > 0 ? 3 : 0, py(0) - top);
      const isLast = i === data.length - 1;
      const fill = isLast ? color : dim;
      if (h > 0) bars += `<rect x="${R(x)}" y="${R(py(0) - h)}" width="${R(bw)}" height="${R(h)}" rx="4" fill="${fill}" data-i="${i}"/>`;
      if (data.length <= 10 && (isLast || i % 2 === 0)) {
        bars += `<text x="${R(x + bw / 2)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="var(--muted)">${esc(d.label)}</text>`;
      }
    });
    let lbl = '';
    const last = data[data.length - 1];
    if (last && last.value > 0) {
      const x = padL + band * (data.length - 1) + band / 2;
      lbl = `<text x="${R(x)}" y="${R(py(last.value) - 6)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--text)" style="font-variant-numeric:tabular-nums">${esc(opts.yFmt ? opts.yFmt(last.value) : last.value)}</text>`;
    }
    host.innerHTML = `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'weekly volume')}">` +
      g + `<line x1="${padL}" y1="${R(py(0))}" x2="${W - padR}" y2="${R(py(0))}" stroke="var(--axis)" stroke-width="1"/>` +
      bars + lbl + `</svg><div class="tip" hidden></div></div>`;

    const wrap = host.querySelector('.chart-wrap'), tip = wrap.querySelector('.tip');
    wrap.addEventListener('pointerdown', e => {
      const t = e.target.closest('rect[data-i]'); if (!t) return;
      const d = data[+t.dataset.i];
      tip.innerHTML = `<b>${esc(opts.yFmt ? opts.yFmt(d.value) : d.value)}</b><i>${esc(d.sub || d.label)}</i>`;
      tip.hidden = false;
      tip.style.left = Math.min(88, Math.max(12, (+t.getAttribute('x') + +t.getAttribute('width') / 2) / W * 100)) + '%';
      tip.style.top = (+t.getAttribute('y') / H * wrap.getBoundingClientRect().height - 6) + 'px';
      setTimeout(() => { tip.hidden = true; }, 2200);
    });
  }

  /* ---------------------------------------------------------
     HEATMAP — training calendar. Sequential single hue.
  --------------------------------------------------------- */
  function heatmap(host, data) {
    const max = Math.max(...data.map(d => d.value), 1);
    const a = ACCENT(), s = SURFACE();
    const steps = [rgb(resolve('var(--surface-2)', '#232322')),
      blend(s, a, 0.28), blend(s, a, 0.52), blend(s, a, 0.76), rgb(a)];
    const bucket = v => v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));
    /* pad so the first column starts on a Monday */
    const firstDow = (new Date(data[0].ts).getDay() + 6) % 7;
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<i style="visibility:hidden"></i>';
    data.forEach(d => {
      cells += `<i style="background:${steps[bucket(d.value)]}" title="${esc(new Date(d.ts).toLocaleDateString())}${d.value ? ' — ' + d.value + ' reps' : ''}"></i>`;
    });
    host.innerHTML = `<div class="heat">${cells}</div><div class="heat-l">less ${steps.map(s => `<i style="background:${s}"></i>`).join('')} more</div>`;
  }

  /* ---------------------------------------------------------
     VS BARS — two people, one exercise. Legend + direct values.
  --------------------------------------------------------- */
  function vsBar(a, b, fmt) {
    const max = Math.max(a.value, b.value, 1);
    const row = (d, cls) => `<div class="vs-bar"><div class="vs-bt${cls}" style="width:${Math.max(2, d.value / max * 100)}%"></div>` +
      `<div class="vs-bv">${esc(fmt(d.value))}${d.sub ? `<small> ${esc(d.sub)}</small>` : ''}</div></div>`;
    return `<div class="vs-bars">${row(a, '')}${row(b, ' b')}</div>`;
  }

  global.Charts = { line, columns, heatmap, vsBar, niceTicks, shortDate };
})(window);
