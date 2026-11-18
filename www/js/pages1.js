'use strict';
/* Páginas: Resumen, Movimientos, Cuentas + formulario de movimiento. */
(function () {
  const L = window.L, C = L.C, Ch = window.LedgerCharts, esc = L.esc, t = L.t;
  const st = () => L.st();
  L.CURS = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'VES', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'INR'];
  const curList = `<datalist id="curs">${L.CURS.map(c => `<option value="${c}">`).join('')}</datalist>`;
  L.curList = curList;
  const month = () => L.ym;

  /* ---------- formulario de movimiento ---------- */
  L.txForm = async (tx, preset = {}) => {
    const s = st();
    if (!s.accounts.some(a => !a.archived)) { L.toast(t('need_account')); L.go('accounts'); return L.accForm(); }
    let kind = (tx && tx.kind) || preset.kind || 'exp';
    const notes = [...new Set(s.tx.slice(-300).map(x => x.note).filter(Boolean))].slice(-40);
    const v = { amt: tx ? tx.amt : (preset.amt ?? ''), acc: tx ? tx.acc : (preset.acc || (s.accounts.find(a => !a.archived) || {}).id), to: tx ? tx.to : preset.to, toAmt: tx && tx.toAmt != null ? tx.toAmt : '', cat: tx ? tx.cat : preset.cat, date: tx ? tx.date : C.today(), note: tx ? tx.note : (preset.note || ''), tags: tx ? (tx.tags || []).filter(x => x !== 'auto').join(', ') : '' };
    const body = () => {
      const accs = L.accOptions(true), other = accs.filter(a => a[0] !== v.acc);
      const cats = kind === 'xfer' ? '' : L.field('cat', t('category'), 'select', v.cat, { options: [['', t('nocat')], ...L.catOptions(kind)] });
      const diff = kind === 'xfer' && v.to && L.cur(v.to) !== L.cur(v.acc);
      return `<div class="seg" role="group" style="margin-bottom:12px">${['exp', 'inc', 'xfer'].map(k => `<button type="button" aria-pressed="${k === kind}" data-kind="${k}">${esc(t('kind_' + k))}</button>`).join('')}</div>
      <div class="form">${L.field('amt', t('amount'), 'number', v.amt, { req: true, full: true, attrs: ' style="font-size:24px;font-family:Outfit"' })}
      ${L.field('acc', kind === 'xfer' ? t('from') : t('account'), 'select', v.acc, { options: accs })}
      ${kind === 'xfer' ? L.field('to', t('to'), 'select', v.to && v.to !== v.acc ? v.to : (other[0] || [''])[0], { options: other }) : cats}
      ${diff ? L.field('toAmt', t('amount_received', { cur: L.cur(v.to) }), 'number', v.toAmt, { full: true }) : ''}
      ${L.field('date', t('date'), 'date', v.date, { req: true })}
      ${L.field('note', t('note'), 'text', v.note, { attrs: ' list="notes" autocomplete="off"' })}<datalist id="notes">${notes.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      ${kind === 'xfer' ? '' : L.field('tags', t('tags'), 'text', v.tags, { ph: t('tags_hint') })}</div>`;
    };
    const keep = root => { const d = L.data(root); Object.assign(v, { amt: d.amt, acc: d.acc, to: d.to ?? v.to, toAmt: d.toAmt ?? v.toAmt, cat: d.cat ?? v.cat, date: d.date, note: d.note, tags: d.tags ?? v.tags }); };
    const hook = root => {
      root.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { keep(root); kind = b.dataset.kind; root.innerHTML = body(); hook(root); });
      const a = root.querySelector('[name=acc]'); if (a) a.onchange = () => { keep(root); root.innerHTML = body(); hook(root); };
      const to = root.querySelector('[name=to]'); if (to) to.onchange = () => { keep(root); root.innerHTML = body(); hook(root); };
    };
    const actions = [];
    if (tx) actions.push({ label: t('delete'), kind: 'danger', fn: () => { L.closeModal(); L.delTx(tx.id); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root), amt = L.num(d.amt);
      if (!(amt > 0) || amt > 1e12) throw Error('amount');
      if (!C.validDate(d.date)) throw Error('date');
      const rec = { id: tx ? tx.id : C.uid(), date: d.date, amt: C.round2(amt), kind, acc: d.acc, cat: kind === 'xfer' ? '' : (d.cat || ''), note: d.note.slice(0, 200), tags: (d.tags || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 10) };
      if (!L.acc(rec.acc)) throw Error('account');
      if (kind === 'xfer') { if (!d.to || d.to === d.acc || !L.acc(d.to)) throw Error('xfer'); rec.to = d.to; const ta = L.num(d.toAmt); if (L.cur(d.to) !== L.cur(d.acc) && ta > 0) rec.toAmt = C.round2(ta); }
      if (tx) { const i = st().tx.findIndex(x => x.id === tx.id); if (tx.rec) { rec.rec = tx.rec; rec.tags = [...new Set([...rec.tags, 'auto'])]; } st().tx[i] = rec; }
      else { if (st().tx.length >= C.LIMITS.tx) throw Error('limit'); st().tx.push(rec); }
      L.changed(); L.toast(t('saved'));
    } });
    return L.modal({ title: tx ? t('edit_tx') : t('new_tx'), body: body(), actions, onOpen: hook });
  };
  L.delTx = id => {
    const i = st().tx.findIndex(x => x.id === id); if (i < 0) return; const [row] = st().tx.splice(i, 1);
    L.changed(); L.toast(t('deleted'), () => { st().tx.push(row); L.changed(); });
  };

  /* ---------- RESUMEN ---------- */
  L.pages.home = () => {
    const s = st(), cur = s.settings.currency, now = C.today(), ym = C.monthOf(now);
    if (!s.accounts.length) return `<div class="head"><div><h1>${esc(t('hello', { name: s.settings.name || '' }).replace(/,\s*$/, ''))}</h1></div></div>${L.empty(t('empty_home_t'), t('empty_home'), `<button class="btn pri" data-act="accform">${t('new_account')}</button>`)}`;
    const sp = C.safeToSpend(s, now), tot = C.totals(s, now), ms = C.monthSummary(s, ym), hs = C.healthScore(s, now), ins = C.insights(s, now);
    const up = C.upcoming(s, 10, now).slice(0, 6), bad = sp.left < 0;
    const used = sp.perDay > 0 ? Math.min(100, sp.spentToday / sp.perDay * 100) : (sp.spentToday > 0 ? 100 : 0);
    const worth = s.worth.slice(-12).map(w => w.net);
    const top = Object.entries(ms.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const months = [5, 4, 3, 2, 1, 0].map(i => { const m = C.addMonths(ym, -i), x = C.monthSummary(s, m); return { label: L.monthName(m, { month: 'short' }), a: x.inc, b: x.exp }; });
    const alertTxt = a => {
      if (a.type === 'cat-up') return t('al_cat_up', { cat: a.cat.name, v: L.money(a.v), avg: L.money(a.avg) });
      if (a.type === 'budget-over') return t('al_over', { cat: a.cat.name, v: L.money(a.v), limit: L.money(a.limit) });
      if (a.type === 'budget-near') return t('al_near', { cat: a.cat.name, v: L.money(a.v), limit: L.money(a.limit) });
      if (a.type === 'low-cash') return t('al_low', { date: L.date(a.date) });
      return t('al_subs', { n: a.n });
    };
    const health = ['savings', 'emergency', 'debt', 'budget'].map(k => `<div class="small row" style="justify-content:space-between;margin-top:4px"><span>${t('hs_' + k)}</span><span class="mute">${L.pct(hs.parts[k])}</span></div><div class="bar"><i style="width:${hs.parts[k] * 100}%"></i></div>`).join('');
    return `<div class="head"><div><h1>${esc(t('hello', { name: s.settings.name || '' }).replace(/,\s*$/, ''))}</h1><p>${esc(L.dateLong(now))}</p></div></div>
    <div class="grid">
      <section class="card hero c7${bad ? ' bad' : ''}" aria-labelledby="h-safe"><div class="row"><span class="eyebrow" id="h-safe">${t('safe_today')}</span><span class="sp"></span><button class="btn sm ghost" style="color:#fff" data-act="safeinfo" aria-label="${t('how_calc')}">${L.icon('info')}</button></div>
        <div class="big num">${bad ? '−' : ''}${L.money(Math.abs(sp.left))}</div>
        <div>${t('safe_sub', { day: L.money(sp.perDay), n: sp.daysLeft })}</div><div class="meter" role="progressbar" aria-valuenow="${Math.round(used)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${used}%"></i></div>
        <div class="small" style="margin-top:8px;opacity:.9">${t('safe_free', { v: L.money(sp.free) })}</div></section>
      <section class="card c5"><h3>${t('networth')}</h3><div class="big2">${L.money(tot.net)}</div><div class="row small mute" style="margin:4px 0 8px"><span>${t('assets')} ${L.money(tot.assets, cur, { dec: 0 })}</span><span>${t('liabilities')} ${L.money(tot.liabs, cur, { dec: 0 })}</span></div>${Ch.spark(worth, t('networth'))}</section>
      <section class="card c4"><h3>${t('this_month')} · ${esc(L.monthName(ym, { month: 'long' }))}</h3>
        <div class="row" style="justify-content:space-between"><span class="mute">${t('income')}</span><b class="num">${L.money(ms.inc)}</b></div><div class="row" style="justify-content:space-between"><span class="mute">${t('expenses')}</span><b class="num">${L.money(ms.exp)}</b></div>
        <div class="row" style="justify-content:space-between;border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><span>${t('saved_rate')}</span><b class="num">${ms.inc > 0 ? L.pct(Math.max(-9.99, ms.rate)) : '—'}</b></div></section>
      <section class="card c4"><h3>${t('health')}</h3><div class="row" style="align-items:flex-start"><div class="ring" style="--v:${hs.score}" role="img" aria-label="${hs.score}/100"><b>${hs.score}</b></div><div class="sp">${health}</div></div></section>
      <section class="card c4"><h3>${t('alerts')}</h3>${ins.length ? ins.slice(0, 4).map(a => `<div class="alert ${/over|low|up/.test(a.type) ? 'warn' : ''}">${L.icon('alert')}<span>${esc(alertTxt(a))}</span></div>`).join('') : `<p class="mute">${t('no_alerts')}</p>`}</section>
      <section class="card c6"><h3>${t('upcoming')}</h3>${up.length ? `<div class="list">${up.map(u => `<div class="item"><div class="tt"><b>${esc(u.rec.name)}</b><span class="small mute">${esc(L.date(u.date))}${u.rec.auto ? ' · ' + t('auto') : ''}</span></div><span class="amt">${u.rec.kind === 'inc' ? '+' : '−'}${L.money(u.rec.amt, L.cur(u.rec.acc))}</span>${u.rec.auto ? '' : `<button class="btn sm" data-act="payrec" data-id="${u.rec.id}" data-d="${u.date}">${t('mark_paid')}</button>`}</div>`).join('')}</div>` : `<p class="mute">${t('no_upcoming')}</p>`}</section>
      <section class="card c6"><h3>${t('top_cats')}</h3>${top.length ? `<div class="row" style="align-items:center;gap:18px">${Ch.donut(top.map(([id, v]) => ({ value: v })), t('top_cats'))}<div class="sp list">${top.map(([id, v], i) => `<div class="row small" style="justify-content:space-between;padding:3px 0"><span class="row" style="gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:${Ch.col(i)}"></i>${esc(L.catName(id))}</span><b class="num">${L.money(v)}</b></div>`).join('')}</div></div>` : `<p class="mute">${t('no_data')}</p>`}</section>
      <section class="card c12"><h3>${t('last6')}</h3>${Ch.bars(months, t('last6'))}<div class="row small mute" style="margin-top:6px"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--c3)"></i>${t('income')}</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--c1)"></i>${t('expenses')}</span></div></section>
    </div>`;
  };
  L.acts.safeinfo = () => {
    const sp = C.safeToSpend(st());
    L.modal({ title: t('how_calc'), body: `<p>${esc(t('safe_explain'))}</p><table><tbody>
      <tr><td>${t('sf_liquid')}</td><td class="r">${L.money(C.totals(st()).liquid)}</td></tr><tr><td>${t('sf_in')}</td><td class="r">+ ${L.money(sp.commitIn)}</td></tr><tr><td>${t('sf_out')}</td><td class="r">− ${L.money(sp.commitOut)}</td></tr><tr><td>${t('sf_goals')}</td><td class="r">− ${L.money(sp.goals)}</td></tr>
      <tr><td><b>${t('sf_free')}</b></td><td class="r"><b>${L.money(sp.free)}</b></td></tr><tr><td>${t('sf_days')}</td><td class="r">÷ ${sp.daysLeft}</td></tr><tr><td><b>${t('sf_perday')}</b></td><td class="r"><b>${L.money(sp.perDay)}</b></td></tr></tbody></table>`, actions: [{ label: t('close'), kind: 'pri' }] });
  };
  L.acts.payrec = el => {
    const r = st().rec.find(x => x.id === el.dataset.id); if (!r) return; const d = el.dataset.d;
    st().tx.push({ id: C.uid(), date: C.today(), amt: r.amt, kind: r.kind, acc: r.acc, cat: r.cat, note: r.name, tags: ['rec'], rec: r.id }); r.paid = [...(r.paid || []), d].slice(-36); L.changed(); L.toast(t('saved'));
  };

  /* ---------- MOVIMIENTOS ---------- */
  L.ui.tx = { q: '', acc: '', cat: '', kind: '' };
  L.pages.tx = () => {
    const s = st(), f = L.ui.tx, ym = month();
    const list = s.tx.filter(x => C.monthOf(x.date) === ym && (!f.acc || x.acc === f.acc || x.to === f.acc) && (!f.kind || x.kind === f.kind) && (!f.cat || x.cat === f.cat) && (!f.q || (x.note + ' ' + L.catName(x.cat) + ' ' + (x.tags || []).join(' ')).toLowerCase().includes(f.q.toLowerCase())))
      .sort((a, b) => b.date.localeCompare(a.date) || 0);
    const days = {}; list.forEach(x => (days[x.date] = days[x.date] || []).push(x));
    const sum = C.monthSummary(s, ym);
    return `<div class="head"><div><h1>${t('nav_tx')}</h1><p>${t('tx_count', { n: list.length })}</p></div><div class="row"><button class="btn" data-act="csvout">${L.icon('export')}CSV</button><button class="btn" data-act="csvin">${L.icon('down')}${t('import_csv')}</button><button class="btn pri" data-act="quick">${L.icon('plus')}${t('add')}</button></div></div>
    <div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="mprev" aria-label="${t('prev')}">${L.icon('chevl')}</button><b style="min-width:150px;text-align:center;text-transform:capitalize">${esc(L.monthName(ym))}</b><button class="btn sm" data-act="mnext" aria-label="${t('next')}">${L.icon('chevr')}</button><span class="sp"></span><span class="small mute">${t('income')} ${L.money(sum.inc)} · ${t('expenses')} ${L.money(sum.exp)}</span></div>
    <div class="form" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:14px">
      <label class="f"><span class="sr">${t('search')}</span><input type="search" data-inp="txq" value="${esc(f.q)}" placeholder="${esc(t('search'))}" maxlength="60"></label>
      <label class="f"><span class="sr">${t('account')}</span><select data-chg="txf" name="acc"><option value="">${t('all_accounts')}</option>${s.accounts.map(a => `<option value="${a.id}"${f.acc === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="f"><span class="sr">${t('category')}</span><select data-chg="txf" name="cat"><option value="">${t('all_cats')}</option>${s.cats.map(c => `<option value="${c.id}"${f.cat === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span class="sr">${t('type')}</span><select data-chg="txf" name="kind"><option value="">${t('all_types')}</option>${['exp', 'inc', 'xfer'].map(k => `<option value="${k}"${f.kind === k ? ' selected' : ''}>${t('kind_' + k)}</option>`).join('')}</select></label></div>
    ${list.length ? Object.keys(days).map(d => { const dayNet = days[d].reduce((a, x) => a + (x.kind === 'inc' ? x.amt : x.kind === 'exp' ? -x.amt : 0), 0); return `<div class="day"><span>${esc(L.date(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</span><span>${dayNet ? L.signed(dayNet) : ''}</span></div><div class="list card" style="padding:4px 14px">${days[d].map(row).join('')}</div>`; }).join('') : L.empty(t('no_tx'), t('no_tx_hint'), `<button class="btn pri" data-act="quick">${t('add')}</button>`)}`;
    function row(x) {
      const cur = L.cur(x.acc), sub = x.kind === 'xfer' ? `${esc((L.acc(x.acc) || {}).name || '?')} → ${esc((L.acc(x.to) || {}).name || '?')}` : `${esc(L.catName(x.cat))} · ${esc((L.acc(x.acc) || {}).name || '?')}`;
      return `<button class="item" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left" data-act="edittx" data-id="${x.id}"><div class="tt"><b>${esc(x.note || (x.kind === 'xfer' ? t('kind_xfer') : L.catName(x.cat)))}</b><span class="small mute">${sub}${(x.tags || []).length ? ' · #' + esc(x.tags.join(' #')) : ''}</span></div><span class="amt ${x.kind === 'inc' ? 'in' : ''}">${x.kind === 'inc' ? '+' : x.kind === 'exp' ? '−' : ''}${L.money(x.amt, cur)}</span></button>`;
    }
  };
  L.acts.edittx = el => L.txForm(st().tx.find(x => x.id === el.dataset.id));
  L.acts.mprev = () => { L.ym = C.addMonths(L.ym, -1); L.render(); }; L.acts.mnext = () => { L.ym = C.addMonths(L.ym, 1); L.render(); };
  L.acts.txf = el => { L.ui.tx[el.name] = el.value; L.render(); };
  let qt; L.acts.txq = el => { L.ui.tx.q = el.value; clearTimeout(qt); qt = setTimeout(() => { L.render(); const i = document.querySelector('[data-inp=txq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  L.acts.csvout = () => {
    const s = st(), rows = [['date', 'type', 'amount', 'currency', 'account', 'to', 'category', 'note', 'tags'], ...s.tx.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => [x.date, x.kind, x.amt, L.cur(x.acc), (L.acc(x.acc) || {}).name, x.to ? (L.acc(x.to) || {}).name : '', L.catName(x.cat), x.note, (x.tags || []).join(' ')])];
    return L.download(`koluva-ledger-${C.today()}.csv`, '﻿' + C.toCSV(rows), 'text/csv');
  };
  L.acts.csvin = async () => {
    const f = await L.S.Host.openFile(); if (!f) return;
    let rows; try { rows = C.parseCSV(f.text); } catch { return L.toast(t('err_file')); }
    if (rows.length < 2) return L.toast(t('err_file'));
    const head = rows[0], opts = head.map((h, i) => [i, h || `#${i + 1}`]), guess = rx => { const i = head.findIndex(h => rx.test(h)); return i < 0 ? 0 : i; };
    const ok = await L.modal({ title: t('import_csv'), body: `<p class="mute small">${t('csv_help', { n: rows.length - 1 })}</p><div class="form">${L.field('acc', t('account'), 'select', '', { options: L.accOptions() })}${L.field('date', t('date'), 'select', guess(/date|fecha|data/i), { options: opts })}${L.field('amount', t('amount'), 'select', guess(/amount|importe|monto|valor|montant/i), { options: opts })}${L.field('note', t('note'), 'select', guess(/note|desc|concept|detail|libell|hist/i), { options: opts })}${L.field('cat', t('category'), 'select', '', { options: [['', '—'], ...opts] })}</div>`,
      actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('import'), kind: 'pri', fn: root => { const d = L.data(root); const { out, bad } = C.csvToTx(rows, { date: +d.date, amount: +d.amount, note: +d.note, cat: d.cat === '' ? null : +d.cat }); if (!out.length) throw Error('file'); if (st().tx.length + out.length > C.LIMITS.tx) throw Error('limit'); out.forEach(o => { let cid = ''; if (o.catName) { let c = st().cats.find(c => c.name.toLowerCase() === o.catName.toLowerCase() && c.kind === o.kind); if (!c) { c = { id: C.uid(), name: o.catName.slice(0, 60), kind: o.kind, budget: 0, rollover: false }; if (st().cats.length < C.LIMITS.cats) st().cats.push(c); else c = null; } cid = c ? c.id : ''; } st().tx.push({ id: C.uid(), date: o.date, amt: o.amt, kind: o.kind, acc: d.acc, cat: cid, note: o.note, tags: ['csv'] }); }); L.changed(); L.toast(t('imported', { n: out.length, bad: bad.length })); } }] });
  };

  /* ---------- CUENTAS ---------- */
  const TYPES = ['cash', 'bank', 'wallet', 'savings', 'card', 'invest'];
  L.accForm = (a) => {
    const actions = [];
    if (a) actions.push({ label: t('delete'), kind: 'danger', fn: async () => { if (st().tx.some(x => x.acc === a.id || x.to === a.id)) { a.archived = true; L.changed(); L.toast(t('archived_msg')); return true; } L.closeModal(); if (!(await L.confirm(t('confirm_delete')))) return true; st().accounts = st().accounts.filter(x => x.id !== a.id); st().rec = st().rec.filter(r => r.acc !== a.id); L.changed(); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root); if (!d.name) throw Error('name'); const cur = d.cur.toUpperCase(); if (!/^[A-Z]{3}$/.test(cur)) throw Error('cur'); const open = L.num(d.open || 0); if (!Number.isFinite(open)) throw Error('amount');
      if (a) Object.assign(a, { name: d.name, type: d.type, cur, open, archived: d.archived }); else { if (st().accounts.length >= C.LIMITS.accounts) throw Error('limit'); st().accounts.push({ id: C.uid(), name: d.name, type: d.type, cur, open, archived: false }); }
      L.changed();
    } });
    return L.modal({ title: a ? t('edit_account') : t('new_account'), body: `<div class="form">${L.field('name', t('name'), 'text', a ? a.name : '', { req: true, full: true })}${L.field('type', t('type'), 'select', a ? a.type : 'bank', { options: TYPES.map(k => [k, t('acc_' + k)]) })}${L.field('cur', t('currency'), 'text', a ? a.cur : st().settings.currency, { attrs: ' list="curs" maxlength="3" style="text-transform:uppercase"' })}${curList}${L.field('open', t('opening_balance'), 'number', a ? a.open : '', { min: -1e12 })}${a ? L.field('archived', t('archived'), 'checkbox', a.archived, { full: true }) : ''}</div>`, actions });
  };
  L.acts.accform = el => L.accForm(el && el.dataset && el.dataset.id ? L.acc(el.dataset.id) : undefined);
  L.acts.reconcile = async el => {
    const a = L.acc(el.dataset.id), bal = C.accountBalance(st(), a.id);
    await L.modal({ title: t('reconcile'), body: `<p class="mute small">${esc(t('reconcile_help', { v: L.money(bal, a.cur) }))}</p><div class="form">${L.field('real', t('real_balance'), 'number', bal, { min: -1e12, full: true })}</div>`,
      actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('adjust'), kind: 'pri', fn: root => { const real = L.num(L.data(root).real); if (!Number.isFinite(real)) throw Error('amount'); const diff = C.round2(real - bal); if (diff === 0) return true; st().tx.push({ id: C.uid(), date: C.today(), amt: Math.abs(diff), kind: diff > 0 ? 'inc' : 'exp', acc: a.id, cat: '', note: t('adjust_note'), tags: ['ajuste'] }); L.changed(); } }] });
  };
  L.acts.transfer = el => L.txForm(null, { kind: 'xfer', acc: el.dataset.id });
  L.pages.accounts = () => {
    const s = st(), tot = C.totals(s), act = s.accounts.filter(a => !a.archived), arc = s.accounts.filter(a => a.archived);
    const card = a => { const b = C.accountBalance(s, a.id); return `<div class="card c4"><div class="row"><span class="chip">${esc(t('acc_' + a.type))}</span><span class="sp"></span><button class="btn sm ghost" data-act="accform" data-id="${a.id}" aria-label="${t('edit')}">${L.icon('edit')}</button></div><h3 style="margin-top:8px">${esc(a.name)}</h3><div class="big2">${L.money(b, a.cur)}</div>${a.cur !== s.settings.currency ? `<div class="small mute">≈ ${L.money(C.toBase(s, b, a.cur))}</div>` : ''}<div class="row" style="margin-top:10px"><button class="btn sm" data-act="reconcile" data-id="${a.id}">${t('reconcile')}</button><button class="btn sm" data-act="transfer" data-id="${a.id}">${t('kind_xfer')}</button></div></div>`; };
    return `<div class="head"><div><h1>${t('nav_accounts')}</h1><p>${t('networth')}: <b>${L.money(tot.net)}</b></p></div><button class="btn pri" data-act="accform">${L.icon('plus')}${t('new_account')}</button></div>
    ${act.length ? `<div class="grid">${act.map(card).join('')}</div>` : L.empty(t('empty_acc'), t('empty_home'), `<button class="btn pri" data-act="accform">${t('new_account')}</button>`)}
    ${arc.length ? `<h3 style="margin:22px 0 8px">${t('archived')}</h3><div class="grid">${arc.map(card).join('')}</div>` : ''}`;
  };
})();
