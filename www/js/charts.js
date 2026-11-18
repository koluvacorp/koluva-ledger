'use strict';
/* Gráficos SVG sin librerías. Colores desde variables CSS (claro/oscuro). */
(function () {
  const V = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
  const col = i => `var(${V[i % V.length]})`;
  const n1 = v => Math.round(v * 10) / 10;

  function donut(items, label) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return '';
    let a = -Math.PI / 2, out = '';
    const R = 54, r = 34, cx = 70, cy = 70;
    if (items.length === 1) out = `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${col(0)}" stroke-width="${R - r}"/>`;
    else items.forEach((it, i) => {
      const da = it.value / total * Math.PI * 2, b = a + da, large = da > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${n1(cx + rad * Math.cos(ang))} ${n1(cy + rad * Math.sin(ang))}`;
      out += `<path d="M${p(R, a)}A${R} ${R} 0 ${large} 1 ${p(R, b - .012)}L${p(r, b - .012)}A${r} ${r} 0 ${large} 0 ${p(r, a)}Z" fill="${col(i)}"/>`;
      a = b;
    });
    return `<svg class="chart" viewBox="0 0 140 140" role="img" aria-label="${label || ''}" style="max-width:180px">${out}</svg>`;
  }

  function bars(rows, label) {
    const max = Math.max(1, ...rows.flatMap(r => [r.a, r.b])), W = 560, H = 190, base = 160, bw = Math.min(26, (W / rows.length - 14) / 2);
    let out = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
    rows.forEach((r, i) => {
      const x = (i + .5) * (W / rows.length), ha = r.a / max * 135, hb = r.b / max * 135;
      out += `<rect x="${n1(x - bw - 1)}" y="${n1(base - ha)}" width="${n1(bw)}" height="${n1(ha)}" rx="4" fill="var(--c3)"/><rect x="${n1(x + 1)}" y="${n1(base - hb)}" width="${n1(bw)}" height="${n1(hb)}" rx="4" fill="var(--c1)"/><text x="${n1(x)}" y="${base + 20}" text-anchor="middle">${r.label}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label || ''}">${out}</svg>`;
  }

  function line(series, o = {}) {
    if (series.length < 2) return '';
    const W = 600, H = 200, pl = 8, pr = 8, pt = 14, pb = 24, vals = series.map(s => s.y);
    let lo = Math.min(...vals, o.zero ? 0 : Infinity), hi = Math.max(...vals, o.zero ? 0 : -Infinity);
    if (hi === lo) { hi += 1; lo -= 1; }
    const x = i => pl + i / (series.length - 1) * (W - pl - pr), y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const pts = series.map((s, i) => `${n1(x(i))},${n1(y(s.y))}`);
    let out = '';
    if (lo < 0 && hi > 0) out += `<line x1="${pl}" x2="${W - pr}" y1="${n1(y(0))}" y2="${n1(y(0))}" stroke="var(--c2)" stroke-dasharray="4 4"/>`;
    out += `<path d="M${pts.join('L')}L${n1(x(series.length - 1))},${H - pb}L${pl},${H - pb}Z" fill="var(--c1)" opacity=".14"/><path d="M${pts.join('L')}" fill="none" stroke="var(--c1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (o.mark != null) out += `<circle cx="${n1(x(o.mark))}" cy="${n1(y(series[o.mark].y))}" r="5" fill="var(--bg)" stroke="var(--c2)" stroke-width="3"/>`;
    const step = Math.max(1, Math.floor(series.length / 5));
    series.forEach((s, i) => { if (s.label && i % step === 0) out += `<text x="${n1(x(i))}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${s.label}</text>`; });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || ''}">${out}</svg>`;
  }

  function spark(values, label) {
    if (values.length < 2) return '';
    const W = 120, H = 32, lo = Math.min(...values), hi = Math.max(...values), d = hi - lo || 1;
    const pts = values.map((v, i) => `${n1(i / (values.length - 1) * W)},${n1(H - 3 - (v - lo) / d * (H - 6))}`).join('L');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="width:120px" role="img" aria-label="${label || ''}"><path d="M${pts}" fill="none" stroke="var(--c1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  window.LedgerCharts = { donut, bars, line, spark, col };
})();
