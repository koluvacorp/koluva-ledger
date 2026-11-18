'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const I = require('../www/js/i18n.js');
const dir = path.join(__dirname, '../www/js');
const code = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !['i18n.js', 'brand.js', 'core.js'].includes(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

test('cada clave tiene es/en/pt/fr no vacías y mismos marcadores', () => {
  for (const [k, v] of Object.entries(I.D)) {
    assert.equal(v.length, 4, k);
    const ph = s => (s.match(/\{[a-z]+\}/g) || []).sort().join();
    v.forEach((s, i) => { assert.ok(typeof s === 'string' && s.trim(), `${k}[${i}]`); assert.equal(ph(s), ph(v[0]), `marcadores ${k}[${i}]`); });
  }
});
test('todas las claves usadas en el código existen', () => {
  const used = new Set([...code.matchAll(/\bt\('([a-zA-Z0-9_-]+)'/g)].map(m => m[1]));
  const dyn = { nav_: ['home', 'tx', 'budget', 'plan', 'goals', 'debts', 'shared', 'accounts', 'reports', 'settings'], kind_: ['exp', 'inc', 'xfer'], acc_: ['cash', 'bank', 'wallet', 'savings', 'card', 'invest'], ev_: ['day', 'week', 'month', 'year'], hs_: ['savings', 'emergency', 'debt', 'budget'], tab_: ['forecast', 'recurring', 'subs', 'sim'], m_: ['avalanche', 'snowball'], th_: ['light', 'dark', 'system'], mo_: ['on', 'system', 'off'], platform_: ['win', 'android', 'web'], err_: [] };
  const missing = [];
  for (const k of used) if (!dyn[k] && !I.D[k]) missing.push(k);
  for (const [p, l] of Object.entries(dyn)) for (const x of l) if (!I.D[p + x]) missing.push(p + x);
  for (let i = 1; i <= 5; i++) for (const s of ['_h', '_p']) if (!I.D['t' + i + s]) missing.push('t' + i + s);
  for (const m of ['amount', 'date', 'account', 'xfer', 'limit', 'name', 'cur', 'split', 'file', 'pass_short', 'pass_match', 'pin_fmt', 'pin_match', 'bad-pass', 'bad-file', 'bad-version', 'too-big', 'csv-too-big', 'save', 'generic']) if (!I.D['err_' + m]) missing.push('err_' + m);
  assert.deepEqual(missing, []);
});
