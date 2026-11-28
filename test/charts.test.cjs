'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../www/js/charts.js'), 'utf8'), { window });
const charts = window.LedgerCharts;

test('donut, barras, línea y minigráfico exponen sus movimientos de entrada', () => {
  assert.match(charts.donut([{ value: 2 }, { value: 3 }], 'Categorías'), /chart-motion chart-donut/);
  assert.match(charts.donut([{ value: 2 }], 'Categoría'), /chart-wedge/);
  assert.equal((charts.bars([{ a: 2, b: 3, label: 'Lun' }], 'Balance').match(/class="chart-bar/g) || []).length, 2);
  assert.match(charts.line([{ y: 1, label: 'Inicio' }, { y: 3, label: 'Fin' }], { label: 'Patrimonio' }), /chart-line-chart[\s\S]*class="chart-line" pathLength="1"/);
  assert.match(charts.spark([1, 2, 1], 'Tendencia'), /chart-spark[\s\S]*class="chart-line" pathLength="1"/);
});

test('etiquetas SVG se escapan y no pueden inyectar atributos ni marcado', () => {
  const malicious = '" onload="alert(1)&<script>';
  const outputs = [
    charts.donut([{ value: 1 }], malicious),
    charts.bars([{ a: 1, b: 2, label: malicious }], malicious),
    charts.line([{ y: 1, label: malicious }, { y: 2 }], { label: malicious }),
    charts.spark([1, 2], malicious)
  ];
  for (const markup of outputs) {
    assert.doesNotMatch(markup, /<script>|onload="alert/);
    assert.match(markup, /&quot; onload=&quot;alert\(1\)&amp;&lt;script&gt;/);
  }
});

test('animación de gráficos se apaga con la preferencia local o movimiento reducido del sistema', () => {
  const css = fs.readFileSync(path.join(__dirname, '../www/css/app.css'), 'utf8');
  assert.match(css, /:root\[data-motion=off\] \.chart-motion \*\{animation:none!important/);
  assert.match(css, /prefers-reduced-motion:reduce\)[\s\S]*:root\[data-motion=system\] \.chart-motion \*\{animation:none!important/);
  const daily = fs.readFileSync(path.join(__dirname, '../www/js/plus.js'), 'utf8');
  assert.match(daily, /class="chart-bar \$\{d === today/);
  assert.match(daily, /class="chart chart-motion pl-bars"/);
});
