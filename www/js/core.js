'use strict';
/* Koluva Ledger · lógica pura (sin DOM). Se prueba en Node: test/core.test.cjs */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LedgerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LIQUID = ['cash', 'bank', 'wallet', 'savings'];
  const LIMITS = { tx: 200000, accounts: 200, cats: 300, text: 200 };

  /* ---------- fechas (cadenas YYYY-MM-DD, sin husos horarios) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monthOf = s => s.slice(0, 7);
  const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parse(s)) === s;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 16);
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  /* ---------- estado ---------- */
  function emptyState(lang = 'es', currency = 'USD') {
    return {
      v: 1, created: today(),
      settings: { lang, theme: 'system', motion: 'system', currency, opening: true, autoUpdate: true, tourDone: false, notify: false, remindDays: 2, pin: null, name: '' },
      rates: {}, accounts: [], cats: [], tx: [], rec: [], goals: [], debts: [], people: [], shared: [], worth: [], lastRec: null,
    };
  }
  const DEFAULT_CATS = {
    es: { exp: ['Alquiler', 'Comida', 'Transporte', 'Servicios', 'Salud', 'Ocio', 'Educación', 'Ropa', 'Suscripciones', 'Otros'], inc: ['Sueldo', 'Extras', 'Otros ingresos'] },
    en: { exp: ['Rent', 'Food', 'Transport', 'Utilities', 'Health', 'Leisure', 'Education', 'Clothes', 'Subscriptions', 'Other'], inc: ['Salary', 'Side income', 'Other income'] },
    pt: { exp: ['Aluguel', 'Comida', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Roupas', 'Assinaturas', 'Outros'], inc: ['Salário', 'Extras', 'Outras receitas'] },
    fr: { exp: ['Loyer', 'Nourriture', 'Transport', 'Factures', 'Santé', 'Loisirs', 'Éducation', 'Vêtements', 'Abonnements', 'Autres'], inc: ['Salaire', 'Extras', 'Autres revenus'] },
  };
  function seedCats(state, lang) {
    const set = DEFAULT_CATS[lang] || DEFAULT_CATS.es;
    state.cats = [...set.exp.map((name, i) => ({ id: uid(), name, kind: 'exp', budget: 0, rollover: false, sub: i === 8 })), ...set.inc.map(name => ({ id: uid(), name, kind: 'inc', budget: 0, rollover: false }))];
  }

  /* ---------- conversión de moneda: rates[X] = cuánto vale 1 X en la moneda base ---------- */
  const toBase = (state, amt, cur) => (!cur || cur === state.settings.currency) ? amt : amt * (Number(state.rates[cur]) > 0 ? Number(state.rates[cur]) : 1);

  /* ---------- saldos ---------- */
  function accountBalance(state, id, upTo) {
    const a = state.accounts.find(x => x.id === id); if (!a) return 0;
    let b = Number(a.open) || 0;
    for (const t of state.tx) {
      if (upTo && t.date > upTo) continue;
      if (t.kind === 'inc' && t.acc === id) b += t.amt;
      else if (t.kind === 'exp' && t.acc === id) b -= t.amt;
      else if (t.kind === 'xfer') { if (t.acc === id) b -= t.amt; if (t.to === id) b += (t.toAmt != null ? t.toAmt : t.amt); }
    }
    return round2(b);
  }
  function totals(state, upTo) {
    let liquid = 0, invest = 0, debtCards = 0, loans = 0;
    for (const a of state.accounts) {
      if (a.archived) continue;
      const b = toBase(state, accountBalance(state, a.id, upTo), a.cur);
      if (LIQUID.includes(a.type)) liquid += b; else if (a.type === 'invest') invest += b; else if (a.type === 'card') debtCards += b;
    }
    for (const d of state.debts) loans += toBase(state, d.bal, d.cur);
    const assets = liquid + invest + Math.max(0, debtCards), liabs = loans + Math.max(0, -debtCards);
    return { liquid: round2(liquid), invest: round2(invest), card: round2(debtCards), loans: round2(loans), assets: round2(assets), liabs: round2(liabs), net: round2(assets - liabs) };
  }

  /* ---------- resumen mensual ---------- */
  function monthSummary(state, ym) {
    let inc = 0, exp = 0; const byCat = {};
    for (const t of state.tx) {
      if (monthOf(t.date) !== ym || t.kind === 'xfer') continue;
      const acc = state.accounts.find(a => a.id === t.acc), v = toBase(state, t.amt, acc && acc.cur);
      if (t.kind === 'inc') inc += v; else { exp += v; byCat[t.cat] = (byCat[t.cat] || 0) + v; }
    }
    return { inc: round2(inc), exp: round2(exp), net: round2(inc - exp), byCat, rate: inc > 0 ? (inc - exp) / inc : 0 };
  }
  function budgetStatus(state, ym) {
    const sum = monthSummary(state, ym), prev = addMonths(ym, -1);
    const prevSum = monthSummary(state, prev);
    return state.cats.filter(c => c.kind === 'exp' && c.budget > 0).map(c => {
      const spent = sum.byCat[c.id] || 0;
      let carry = 0;
      if (c.rollover) carry = Math.max(0, c.budget - (prevSum.byCat[c.id] || 0));
      const limit = c.budget + carry;
      return { cat: c, spent: round2(spent), limit: round2(limit), left: round2(limit - spent), pct: limit > 0 ? spent / limit : 0, carry: round2(carry) };
    });
  }

  /* ---------- recurrencias ---------- */
  function* occurrences(r, from, to) {
    if (!r.start || !validDate(r.start)) return;
    const step = Math.max(1, Math.min(60, r.interval | 0 || 1));
    let guard = 0, n = 0;
    const anchor = parse(r.start);
    for (;;) {
      let d;
      if (r.every === 'week') d = addDays(r.start, 7 * step * n);
      else if (r.every === 'year') { const y = anchor.getFullYear() + step * n, m = anchor.getMonth(); d = iso(new Date(y, m, Math.min(anchor.getDate(), new Date(y, m + 1, 0).getDate()))); }
      else if (r.every === 'day') d = addDays(r.start, step * n);
      else { const ym = addMonths(r.start.slice(0, 7), step * n); d = `${ym}-${pad(Math.min(anchor.getDate(), daysIn(ym)))}`; }
      n++;
      if (d > to || (r.end && d > r.end) || ++guard > 5000) return;
      if (d >= from) yield d;
    }
  }
  /* Genera los movimientos vencidos de las recurrencias automáticas. Devuelve cuántos creó. */
  function applyDueRecurring(state, upTo = today()) {
    let created = 0;
    for (const r of state.rec) {
      if (!r.auto || r.paused) continue;
      const from = r.lastGen ? addDays(r.lastGen, 1) : r.start;
      for (const d of occurrences(r, from, upTo)) {
        if (state.tx.length >= LIMITS.tx) break;
        state.tx.push({ id: uid(), date: d, amt: r.amt, kind: r.kind, acc: r.acc, cat: r.cat, note: r.name, tags: ['auto'], rec: r.id }); created++;
      }
      r.lastGen = upTo;
    }
    return created;
  }
  const monthlyEquivalent = r => r.amt * ({ day: 30.4375, week: 4.345, month: 1, year: 1 / 12 }[r.every] || 1) / Math.max(1, r.interval | 0 || 1);
  function upcoming(state, days = 30, from = today()) {
    const to = addDays(from, days), out = [];
    for (const r of state.rec) {
      if (r.paused) continue;
      const start = r.auto && r.lastGen ? addDays(r.lastGen, 1) : from;
      for (const d of occurrences(r, start < from ? from : start, to)) if (!(r.paid && r.paid.includes(d))) out.push({ date: d, rec: r });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ---------- pronóstico de caja (único: saldo diario proyectado + punto más bajo) ---------- */
  function forecast(state, days = 90, from = today()) {
    let bal = totals(state, from).liquid;
    const ev = {}; let minV = bal, minD = from, negative = null;
    for (const u of upcoming(state, days, from)) {
      const acc = state.accounts.find(a => a.id === u.rec.acc);
      if (acc && !LIQUID.includes(acc.type) && acc.type !== 'card') continue;
      if (u.rec.kind === 'xfer') continue;
      const v = toBase(state, u.rec.amt, acc && acc.cur) * (u.rec.kind === 'inc' ? 1 : -1);
      ev[u.date] = (ev[u.date] || 0) + v;
    }
    for (const g of state.goals) if (g.monthly > 0 && !g.done) { for (let i = 0; i <= days; i += 1) { const d = addDays(from, i); if (d.slice(8) === '01') ev[d] = (ev[d] || 0) - g.monthly; } }
    const series = [];
    for (let i = 0; i <= days; i++) {
      const d = addDays(from, i); if (i > 0) bal += ev[d] || 0;
      series.push({ date: d, bal: round2(bal) });
      if (bal < minV) { minV = bal; minD = d; }
      if (negative === null && bal < 0) negative = d;
    }
    return { series, min: round2(minV), minDate: minD, negativeOn: negative, end: round2(bal) };
  }

  /* ---------- "Puedes gastar hoy" (gasto diario seguro) ---------- */
  function safeToSpend(state, now = today()) {
    const ym = monthOf(now), last = `${ym}-${pad(daysIn(ym))}`, daysLeft = diffDays(now, last) + 1;
    const liquid = totals(state, now).liquid;
    let commitIn = 0, commitOut = 0;
    for (const u of upcoming(state, daysLeft - 1, now)) {
      if (u.rec.auto && u.date <= now) continue;
      const acc = state.accounts.find(a => a.id === u.rec.acc), v = toBase(state, u.rec.amt, acc && acc.cur);
      if (u.rec.kind === 'inc') commitIn += v; else if (u.rec.kind === 'exp') commitOut += v;
    }
    const goals = state.goals.filter(g => g.monthly > 0 && !g.done).reduce((s, g) => s + g.monthly, 0);
    const budgetRoom = budgetStatus(state, ym).reduce((s, b) => s + Math.max(0, b.left), 0);
    const free = liquid + commitIn - commitOut - goals;
    const perDay = Math.max(0, free) / daysLeft;
    const spentToday = state.tx.filter(t => t.date === now && t.kind === 'exp').reduce((s, t) => s + toBase(state, t.amt, (state.accounts.find(a => a.id === t.acc) || {}).cur), 0);
    return { free: round2(free), perDay: round2(perDay), daysLeft, spentToday: round2(spentToday), left: round2(perDay - spentToday), budgetRoom: round2(budgetRoom), commitOut: round2(commitOut), commitIn: round2(commitIn), goals: round2(goals) };
  }

  /* ---------- deudas: bola de nieve vs avalancha ---------- */
  function debtPlan(debts, extra = 0, method = 'avalanche') {
    const ds = debts.filter(d => d.bal > 0).map(d => ({ id: d.id, name: d.name, bal: d.bal, apr: Number(d.apr) || 0, min: Math.max(0, Number(d.min) || 0) }));
    if (!ds.length) return { months: 0, interest: 0, order: [], ok: true, paidOff: {} };
    const order = [...ds].sort((a, b) => method === 'snowball' ? a.bal - b.bal : b.apr - a.apr).map(d => d.id);
    let months = 0, interest = 0; const paidOff = {};
    while (ds.some(d => d.bal > 0.005) && months < 1200) {
      months++;
      for (const d of ds) if (d.bal > 0) { const i = d.bal * d.apr / 1200; d.bal += i; interest += i; }
      let pool = extra + ds.reduce((s, d) => s + (d.bal > 0 ? d.min : 0), 0);
      for (const d of ds) if (d.bal > 0) { const pay = Math.min(d.bal, d.min, pool); d.bal -= pay; pool -= pay; }
      for (const id of order) { const d = ds.find(x => x.id === id); if (d.bal > 0 && pool > 0) { const pay = Math.min(d.bal, pool); d.bal -= pay; pool -= pay; } }
      for (const d of ds) if (d.bal <= 0.005 && paidOff[d.id] === undefined) paidOff[d.id] = months;
    }
    return { months, interest: round2(interest), order, ok: months < 1200, paidOff };
  }

  /* ---------- metas ---------- */
  function goalInfo(g, now = today()) {
    const left = Math.max(0, g.target - g.saved), pct = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
    let need = null, eta = null;
    if (g.due && left > 0) { const months = Math.max(1, (diffDays(now, g.due) / 30.4375)); need = left / months; }
    if (g.monthly > 0 && left > 0) eta = addDays(now, Math.ceil(left / g.monthly * 30.4375));
    return { left: round2(left), pct, need: need === null ? null : round2(need), eta, done: left <= 0 };
  }

  /* ---------- gastos compartidos ---------- */
  function sharedBalances(state) {
    const bal = {};
    for (const p of state.people) bal[p.id] = 0;            // positivo = te debe, negativo = le debes
    for (const e of state.shared) {
      if (e.settle) { // pago entre personas: e.from paga a e.to
        if (e.from === 'me') bal[e.to] = (bal[e.to] || 0) + e.amt; else if (e.to === 'me') bal[e.from] = (bal[e.from] || 0) - e.amt;
        continue;
      }
      const ids = e.parts && e.parts.length ? e.parts : ['me', ...state.people.map(p => p.id)];
      const share = e.amt / ids.length;
      if (e.paidBy === 'me') { for (const id of ids) if (id !== 'me') bal[id] = (bal[id] || 0) + share; }
      else if (ids.includes('me')) bal[e.paidBy] = (bal[e.paidBy] || 0) - share;
    }
    for (const k of Object.keys(bal)) bal[k] = round2(bal[k]);
    return bal;
  }

  /* ---------- salud financiera 0-100 ---------- */
  function healthScore(state, now = today()) {
    const ym = monthOf(now), cur = monthSummary(state, ym), prev = monthSummary(state, addMonths(ym, -1));
    const inc = Math.max(cur.inc, prev.inc), exp = Math.max(cur.exp, prev.exp, 1);
    const t = totals(state, now);
    const sav = inc > 0 ? Math.max(0, Math.min(1, ((inc - exp) / inc) / 0.2)) : 0;       // 20% ahorro = 100
    const emerg = Math.max(0, Math.min(1, t.liquid / (exp * 3)));                        // 3 meses = 100
    const monthlyDebt = state.debts.reduce((s, d) => s + (Number(d.min) || 0), 0);
    const dti = inc > 0 ? Math.max(0, Math.min(1, 1 - (monthlyDebt / inc) / 0.36)) : (monthlyDebt > 0 ? 0 : 1);
    const bs = budgetStatus(state, ym);
    const bud = bs.length ? bs.reduce((s, b) => s + (b.pct <= 1 ? 1 : Math.max(0, 1 - (b.pct - 1))), 0) / bs.length : 0.5;
    const parts = { savings: sav, emergency: emerg, debt: dti, budget: bud };
    const score = Math.round((sav * 30 + emerg * 30 + dti * 20 + bud * 20));
    return { score, parts };
  }

  /* ---------- detector de suscripciones ---------- */
  function detectSubscriptions(state) {
    const groups = {};
    for (const t of state.tx) { if (t.kind !== 'exp' || !t.note || t.rec) continue; const k = t.note.trim().toLowerCase(); (groups[k] = groups[k] || []).push(t); }
    const known = new Set(state.rec.map(r => r.name.trim().toLowerCase()));
    const out = [];
    for (const [k, list] of Object.entries(groups)) {
      if (list.length < 3 || known.has(k)) continue;
      list.sort((a, b) => a.date.localeCompare(b.date));
      const gaps = []; for (let i = 1; i < list.length; i++) gaps.push(diffDays(list[i - 1].date, list[i].date));
      const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length, amts = list.map(t => t.amt);
      const same = Math.max(...amts) - Math.min(...amts) <= Math.max(...amts) * 0.15;
      if (same && avg >= 26 && avg <= 35) out.push({ name: list[list.length - 1].note, amt: amts[amts.length - 1], every: 'month', acc: list[list.length - 1].acc, cat: list[list.length - 1].cat, last: list[list.length - 1].date, count: list.length });
      else if (same && avg >= 6 && avg <= 8) out.push({ name: list[list.length - 1].note, amt: amts[amts.length - 1], every: 'week', acc: list[list.length - 1].acc, cat: list[list.length - 1].cat, last: list[list.length - 1].date, count: list.length });
    }
    return out;
  }

  /* ---------- avisos útiles ---------- */
  function insights(state, now = today()) {
    const ym = monthOf(now), cur = monthSummary(state, ym), out = [];
    const prevs = [1, 2, 3].map(i => monthSummary(state, addMonths(ym, -i)));
    const dayFrac = Number(now.slice(8)) / daysIn(ym);
    for (const c of state.cats.filter(x => x.kind === 'exp')) {
      const avg = prevs.reduce((s, p) => s + (p.byCat[c.id] || 0), 0) / 3, v = cur.byCat[c.id] || 0;
      if (avg > 0 && v > avg * 1.4 && v > avg * dayFrac * 1.4 && v - avg > 1) out.push({ type: 'cat-up', cat: c, v: round2(v), avg: round2(avg) });
    }
    for (const b of budgetStatus(state, ym)) if (b.pct >= 0.9) out.push({ type: b.pct > 1 ? 'budget-over' : 'budget-near', cat: b.cat, v: b.spent, limit: b.limit });
    const f = forecast(state, 60, now); if (f.negativeOn) out.push({ type: 'low-cash', date: f.negativeOn });
    const subs = detectSubscriptions(state); if (subs.length) out.push({ type: 'subs', n: subs.length });
    return out;
  }

  /* ---------- ¿y si...? recortar una categoría ---------- */
  function whatIf(state, catId, cutPct, now = today()) {
    const ym = monthOf(now), vals = [1, 2, 3].map(i => monthSummary(state, addMonths(ym, -i)).byCat[catId] || 0);
    const avg = vals.reduce((s, v) => s + v, 0) / 3, monthly = avg * Math.max(0, Math.min(100, cutPct)) / 100;
    return { avg: round2(avg), monthly: round2(monthly), yearly: round2(monthly * 12) };
  }
  function compound(principal, monthly, annualPct, years) {
    let b = principal; const r = annualPct / 1200;
    for (let m = 0; m < years * 12; m++) b = b * (1 + r) + monthly;
    return round2(b);
  }

  /* ---------- patrimonio histórico ---------- */
  function snapshotWorth(state, now = today()) {
    const t = totals(state, now), ym = monthOf(now), last = state.worth[state.worth.length - 1];
    const row = { date: now, ym, assets: t.assets, liabs: t.liabs, net: t.net };
    if (last && last.ym === ym) state.worth[state.worth.length - 1] = row; else state.worth.push(row);
    if (state.worth.length > 600) state.worth.splice(0, state.worth.length - 600);
  }

  /* ---------- CSV ---------- */
  function toCSV(rows) {
    const esc = v => { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return rows.map(r => r.map(esc).join(',')).join('\r\n');
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '', delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cur += c;
      if (rows.length > 100000) throw Error('csv-too-big');
    }
    row.push(cur); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  function parseAmount(s) {
    s = String(s).trim().replace(/[^\d,.\-()]/g, ''); if (!s) return NaN;
    let neg = /^\(.*\)$/.test(s) || s.startsWith('-'); s = s.replace(/[()\-]/g, '');
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    const n = parseFloat(s); return neg ? -n : n;
  }
  function parseDateAny(s) {
    s = String(s).trim(); let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    return null;
  }
  /* mapa: {date,amount,note,cat,kind?} índices de columna; devuelve movimientos listos (sin id de cuenta) */
  function csvToTx(rows, map, hasHeader = true) {
    const out = [], bad = [];
    rows.slice(hasHeader ? 1 : 0).forEach((r, i) => {
      const date = parseDateAny(r[map.date] || ''), n = parseAmount(r[map.amount] || '');
      if (!date || !validDate(date) || !Number.isFinite(n) || n === 0) { bad.push(i + 1); return; }
      out.push({ date, amt: round2(Math.abs(n)), kind: n < 0 ? 'exp' : 'inc', note: String(r[map.note] || '').slice(0, LIMITS.text), catName: map.cat != null ? String(r[map.cat] || '') : '' });
    });
    return { out, bad };
  }

  /* ---------- validación al importar/restaurar copias ---------- */
  function sanitize(obj) {
    if (!obj || typeof obj !== 'object' || obj.v !== 1) throw Error('bad-version');
    const s = emptyState(); const str = (v, n = LIMITS.text) => String(v == null ? '' : v).slice(0, n);
    const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
    const arr = (a, max) => { if (!Array.isArray(a)) return []; if (a.length > max) throw Error('too-big'); return a; };
    const st = obj.settings || {};
    s.created = validDate(obj.created) ? obj.created : today();
    s.settings = { ...s.settings, lang: ['es', 'en', 'pt', 'fr'].includes(st.lang) ? st.lang : 'es', theme: ['light', 'dark', 'system'].includes(st.theme) ? st.theme : 'system', motion: ['on', 'system', 'off'].includes(st.motion) ? st.motion : 'system', currency: /^[A-Z]{3}$/.test(st.currency) ? st.currency : 'USD', opening: st.opening !== false, autoUpdate: st.autoUpdate !== false, tourDone: !!st.tourDone, notify: !!st.notify, remindDays: Math.max(0, Math.min(14, num(st.remindDays) | 0)), name: str(st.name, 60),
      pin: st.pin && typeof st.pin.salt === 'string' && typeof st.pin.hash === 'string' ? { salt: st.pin.salt.slice(0, 64), hash: st.pin.hash.slice(0, 128) } : null };
    for (const [k, v] of Object.entries(obj.rates || {})) if (/^[A-Z]{3}$/.test(k) && num(v) > 0) s.rates[k] = num(v);
    s.accounts = arr(obj.accounts, LIMITS.accounts).map(a => ({ id: str(a.id, 32), name: str(a.name, 60), type: ['cash', 'bank', 'card', 'savings', 'wallet', 'invest'].includes(a.type) ? a.type : 'bank', cur: /^[A-Z]{3}$/.test(a.cur) ? a.cur : s.settings.currency, open: num(a.open), archived: !!a.archived }));
    s.cats = arr(obj.cats, LIMITS.cats).map(c => ({ id: str(c.id, 32), name: str(c.name, 60), kind: c.kind === 'inc' ? 'inc' : 'exp', budget: Math.max(0, num(c.budget)), rollover: !!c.rollover, sub: !!c.sub }));
    s.tx = arr(obj.tx, LIMITS.tx).filter(t => validDate(t.date) && num(t.amt) >= 0).map(t => ({ id: str(t.id, 32), date: t.date, amt: round2(num(t.amt)), kind: ['inc', 'exp', 'xfer'].includes(t.kind) ? t.kind : 'exp', acc: str(t.acc, 32), to: t.to ? str(t.to, 32) : undefined, toAmt: t.toAmt != null ? num(t.toAmt) : undefined, cat: str(t.cat, 32), note: str(t.note), tags: Array.isArray(t.tags) ? t.tags.slice(0, 10).map(x => str(x, 30)) : [], rec: t.rec ? str(t.rec, 32) : undefined, goal: t.goal ? str(t.goal, 32) : undefined }));
    s.rec = arr(obj.rec, 2000).filter(r => validDate(r.start)).map(r => ({ id: str(r.id, 32), name: str(r.name, 80), kind: ['inc', 'exp'].includes(r.kind) ? r.kind : 'exp', amt: Math.abs(num(r.amt)), acc: str(r.acc, 32), cat: str(r.cat, 32), every: ['day', 'week', 'month', 'year'].includes(r.every) ? r.every : 'month', interval: Math.max(1, Math.min(60, num(r.interval) | 0 || 1)), start: r.start, end: validDate(r.end) ? r.end : undefined, auto: !!r.auto, paused: !!r.paused, lastGen: validDate(r.lastGen) ? r.lastGen : undefined, sub: !!r.sub, paid: Array.isArray(r.paid) ? r.paid.filter(validDate).slice(-36) : [] }));
    s.goals = arr(obj.goals, 500).map(g => ({ id: str(g.id, 32), name: str(g.name, 80), target: Math.max(0, num(g.target)), saved: Math.max(0, num(g.saved)), monthly: Math.max(0, num(g.monthly)), due: validDate(g.due) ? g.due : undefined, done: !!g.done }));
    s.debts = arr(obj.debts, 500).map(d => ({ id: str(d.id, 32), name: str(d.name, 80), bal: Math.max(0, num(d.bal)), apr: Math.max(0, Math.min(1000, num(d.apr))), min: Math.max(0, num(d.min)), cur: /^[A-Z]{3}$/.test(d.cur) ? d.cur : s.settings.currency }));
    s.people = arr(obj.people, 200).map(p => ({ id: str(p.id, 32), name: str(p.name, 60) }));
    s.shared = arr(obj.shared, 20000).filter(e => validDate(e.date)).map(e => ({ id: str(e.id, 32), date: e.date, desc: str(e.desc), amt: Math.max(0, num(e.amt)), paidBy: str(e.paidBy, 32), parts: Array.isArray(e.parts) ? e.parts.slice(0, 200).map(x => str(x, 32)) : [], settle: !!e.settle, from: e.from ? str(e.from, 32) : undefined, to: e.to ? str(e.to, 32) : undefined }));
    s.worth = arr(obj.worth, 700).filter(w => validDate(w.date)).map(w => ({ date: w.date, ym: monthOf(w.date), assets: num(w.assets), liabs: num(w.liabs), net: num(w.net) }));
    return s;
  }

  /* ---------- copia cifrada (PBKDF2-SHA256 250k + AES-256-GCM) ---------- */
  const b64 = u8 => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt, usage) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, usage);
  }
  async function encryptBackup(state, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt, ['encrypt']), new TextEncoder().encode(JSON.stringify(state))));
    return JSON.stringify({ koluvaLedger: 1, enc: 'AES-256-GCM', kdf: 'PBKDF2-SHA256-250000', salt: b64(salt), iv: b64(iv), data: b64(ct) });
  }
  async function decryptBackup(text, pass) {
    const o = JSON.parse(text); if (!o || o.koluvaLedger !== 1 || !o.data) throw Error('bad-file');
    let plain; try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, await deriveKey(pass, unb64(o.salt), ['decrypt']), unb64(o.data)); } catch { throw Error('bad-pass'); }
    return sanitize(JSON.parse(new TextDecoder().decode(plain)));
  }
  async function hashPin(pin, salt) {
    salt = salt || b64(crypto.getRandomValues(new Uint8Array(16)));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 150000, hash: 'SHA-256' }, base, 256));
    return { salt, hash: b64(bits) };
  }

  /* ---------- versiones y manifiesto de actualización ---------- */
  function versionParts(v) { if (typeof v !== 'string' || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(v)) throw Error('bad-version'); return v.split('.').map(Number); }
  function newer(a, b) { const x = versionParts(a), y = versionParts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }

  return { LIQUID, LIMITS, pad, iso, parse, today, addDays, monthOf, daysIn, addMonths, diffDays, validDate, uid, round2, emptyState, seedCats, DEFAULT_CATS, toBase, accountBalance, totals, monthSummary, budgetStatus, occurrences, applyDueRecurring, monthlyEquivalent, upcoming, forecast, safeToSpend, debtPlan, goalInfo, sharedBalances, healthScore, detectSubscriptions, insights, whatIf, compound, snapshotWorth, toCSV, parseCSV, parseAmount, parseDateAny, csvToTx, sanitize, encryptBackup, decryptBackup, hashPin, versionParts, newer, b64, unb64 };
});
