'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../www/js/core.js');

function base() {
  const s = C.emptyState('es', 'USD'); C.seedCats(s, 'es');
  s.accounts.push({ id: 'a1', name: 'Banco', type: 'bank', cur: 'USD', open: 1000 }, { id: 'a2', name: 'Efectivo', type: 'cash', cur: 'USD', open: 100 }, { id: 'a3', name: 'Tarjeta', type: 'card', cur: 'USD', open: 0 });
  return s;
}
const cat = (s, n) => s.cats.find(c => c.name === n).id;

test('saldos, transferencias y patrimonio', () => {
  const s = base();
  s.tx.push({ id: 't1', date: '2026-11-02', amt: 500, kind: 'inc', acc: 'a1', cat: cat(s, 'Sueldo'), note: '', tags: [] },
    { id: 't2', date: '2026-11-03', amt: 120.55, kind: 'exp', acc: 'a1', cat: cat(s, 'Comida'), note: '', tags: [] },
    { id: 't3', date: '2026-11-04', amt: 200, kind: 'xfer', acc: 'a1', to: 'a2', cat: '', note: '', tags: [] },
    { id: 't4', date: '2026-11-05', amt: 50, kind: 'exp', acc: 'a3', cat: cat(s, 'Ocio'), note: '', tags: [] });
  assert.equal(C.accountBalance(s, 'a1'), 1179.45);
  assert.equal(C.accountBalance(s, 'a2'), 300);
  assert.equal(C.accountBalance(s, 'a3'), -50);
  const t = C.totals(s); assert.equal(t.liquid, 1479.45); assert.equal(t.liabs, 50); assert.equal(t.net, 1429.45);
  s.settings.currency = 'USD'; s.accounts.push({ id: 'a4', name: 'Euros', type: 'bank', cur: 'EUR', open: 100 }); s.rates.EUR = 1.1;
  assert.equal(C.totals(s).liquid, 1589.45);
});

test('resumen mensual y presupuesto con arrastre', () => {
  const s = base(); const food = s.cats.find(c => c.name === 'Comida'); food.budget = 100; food.rollover = true;
  s.tx.push({ id: 'x', date: '2026-10-10', amt: 40, kind: 'exp', acc: 'a1', cat: food.id, note: '', tags: [] }, { id: 'y', date: '2026-11-10', amt: 70, kind: 'exp', acc: 'a1', cat: food.id, note: '', tags: [] });
  const b = C.budgetStatus(s, '2026-11')[0]; assert.equal(b.carry, 60); assert.equal(b.limit, 160); assert.equal(b.left, 90);
  assert.equal(C.monthSummary(s, '2026-11').exp, 70);
});

test('recurrencias: mensual con fin de mes, semanal y generación automática', () => {
  const r = { start: '2026-01-31', every: 'month', interval: 1 };
  assert.deepEqual([...C.occurrences(r, '2026-01-01', '2026-04-30')], ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual([...C.occurrences({ start: '2026-11-01', every: 'week', interval: 2 }, '2026-11-01', '2026-11-30')], ['2026-11-01', '2026-11-15', '2026-11-29']);
  const s = base(); s.rec.push({ id: 'r1', name: 'Netflix', kind: 'exp', amt: 10, acc: 'a1', cat: '', every: 'month', interval: 1, start: '2026-09-15', auto: true });
  assert.equal(C.applyDueRecurring(s, '2026-11-18'), 3); assert.equal(C.applyDueRecurring(s, '2026-11-18'), 0);
  assert.equal(C.applyDueRecurring(s, '2026-12-16'), 1);
});

test('pronóstico detecta saldo negativo y gasto diario seguro', () => {
  const s = base(); s.accounts = [{ id: 'a1', name: 'B', type: 'bank', cur: 'USD', open: 300 }];
  s.rec.push({ id: 'r', name: 'Alquiler', kind: 'exp', amt: 500, acc: 'a1', cat: '', every: 'month', interval: 1, start: '2026-11-25' });
  const f = C.forecast(s, 30, '2026-11-18'); assert.equal(f.negativeOn, '2026-11-25'); assert.equal(f.min, -200);
  const sp = C.safeToSpend(s, '2026-11-18'); assert.equal(sp.daysLeft, 13); assert.equal(sp.free, -200); assert.equal(sp.perDay, 0);
  s.rec[0].amt = 100; const sp2 = C.safeToSpend(s, '2026-11-18'); assert.equal(sp2.perDay, round(200 / 13));
});
const round = n => Math.round(n * 100) / 100;

test('deudas: avalancha ahorra intereses frente a bola de nieve', () => {
  const d = [{ id: 'a', name: 'A', bal: 1000, apr: 30, min: 30 }, { id: 'b', name: 'B', bal: 300, apr: 5, min: 15 }];
  const av = C.debtPlan(d, 100, 'avalanche'), sn = C.debtPlan(d, 100, 'snowball');
  assert.ok(av.interest <= sn.interest); assert.ok(av.ok && sn.ok); assert.equal(av.order[0], 'a'); assert.equal(sn.order[0], 'b');
  assert.equal(C.debtPlan([], 0).months, 0);
});

test('metas, compartidos y salud', () => {
  const g = C.goalInfo({ target: 1200, saved: 200, monthly: 100, due: '2027-11-18' }, '2026-11-18'); assert.equal(g.left, 1000); assert.ok(g.need > 80 && g.need < 85); assert.ok(g.eta > '2027-08-01');
  const s = base(); s.people.push({ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Luis' });
  s.shared.push({ id: 'e1', date: '2026-11-01', desc: 'Cena', amt: 90, paidBy: 'me', parts: [] }, { id: 'e2', date: '2026-11-02', desc: 'Taxi', amt: 30, paidBy: 'p1', parts: ['me', 'p1'] });
  let b = C.sharedBalances(s); assert.equal(b.p1, 30 - 15); assert.equal(b.p2, 30);
  s.shared.push({ id: 'e3', date: '2026-11-03', amt: 15, settle: true, from: 'p1', to: 'me' }); b = C.sharedBalances(s); assert.equal(b.p1, 0);
  const h = C.healthScore(s, '2026-11-18'); assert.ok(h.score >= 0 && h.score <= 100);
});

test('suscripciones detectadas y recortes "¿y si?"', () => {
  const s = base(); ['2026-08-05', '2026-09-05', '2026-10-05'].forEach((d, i) => s.tx.push({ id: 'n' + i, date: d, amt: 9.99, kind: 'exp', acc: 'a1', cat: cat(s, 'Ocio'), note: 'Spotify', tags: [] }));
  const d = C.detectSubscriptions(s); assert.equal(d.length, 1); assert.equal(d[0].every, 'month');
  const w = C.whatIf(s, cat(s, 'Ocio'), 50, '2026-11-18'); assert.equal(w.yearly, round(9.99 * 3 / 3 * 0.5 * 12));
  assert.ok(C.compound(0, 100, 0, 1) === 1200);
});

test('CSV: números y fechas regionales, escape contra fórmulas', () => {
  assert.equal(C.parseAmount('1.234,56'), 1234.56); assert.equal(C.parseAmount('-1,234.50'), -1234.5); assert.equal(C.parseAmount('(20,00)'), -20); assert.equal(C.parseAmount('$ 12'), 12);
  assert.equal(C.parseDateAny('05/11/2026'), '2026-11-05'); assert.equal(C.parseDateAny('2026-1-5'), '2026-01-05');
  const rows = C.parseCSV('Fecha;Importe;Concepto\n05/11/2026;-12,50;"Café; bar"\nfoo;1;x'); assert.equal(rows[1][2], 'Café; bar');
  const r = C.csvToTx(rows, { date: 0, amount: 1, note: 2 }); assert.equal(r.out.length, 1); assert.equal(r.bad.length, 1); assert.equal(r.out[0].kind, 'exp');
  assert.ok(C.toCSV([['=1+1', 'a,b']]).startsWith("'=1+1"));
});

test('copia cifrada: ida y vuelta, contraseña mala y datos corruptos', async () => {
  const s = base(); s.tx.push({ id: 't', date: '2026-11-02', amt: 5, kind: 'exp', acc: 'a1', cat: '', note: 'x', tags: [] });
  const enc = await C.encryptBackup(s, 'clave-larga'); assert.ok(!enc.includes('Banco'));
  const back = await C.decryptBackup(enc, 'clave-larga'); assert.equal(back.tx.length, 1); assert.equal(back.accounts[0].name, 'Banco');
  await assert.rejects(C.decryptBackup(enc, 'otra'), /bad-pass/);
  assert.throws(() => C.sanitize({ v: 2 }), /bad-version/);
  const dirty = JSON.parse(JSON.stringify(s)); dirty.tx.push({ date: 'nope', amt: 1 }, { date: '2026-01-01', amt: -3 }); assert.equal(C.sanitize(dirty).tx.length, 1);
  const p = await C.hashPin('1234'); assert.equal((await C.hashPin('1234', p.salt)).hash, p.hash); assert.notEqual((await C.hashPin('4321', p.salt)).hash, p.hash);
});

test('versiones', () => { assert.ok(C.newer('1.0.1', '1.0.0')); assert.ok(!C.newer('1.0.0', '1.0.0')); assert.throws(() => C.versionParts('1.0'), /bad-version/); });
