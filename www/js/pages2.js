'use strict';
/* Páginas: Presupuesto, Pronóstico, Metas, Deudas, Compartidos, Reportes. */
(function () {
  const L = window.L, C = L.C, Ch = window.LedgerCharts, esc = L.esc, t = L.t;
  const st = () => L.st();
  const sel = (name, val, opts) => L.field(name, '', 'select', val, { options: opts });
  const nextId = () => C.uid();

  /* ---------- PRESUPUESTO (sobres) ---------- */
  L.catForm = c => {
    const actions = [];
    if (c) actions.push({ label: t('delete'), kind: 'danger', fn: async () => { L.closeModal(); if (!(await L.confirm(t('confirm_delete')))) return true; st().cats = st().cats.filter(x => x.id !== c.id); L.changed(); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root); if (!d.name) throw Error('name'); const b = d.budget === '' ? 0 : L.num(d.budget); if (!(b >= 0)) throw Error('amount');
      if (c) Object.assign(c, { name: d.name, budget: b, rollover: !!d.rollover, kind: d.kind || c.kind, sub: !!d.sub });
      else { if (st().cats.length >= C.LIMITS.cats) throw Error('limit'); st().cats.push({ id: nextId(), name: d.name, kind: d.kind, budget: b, rollover: !!d.rollover, sub: !!d.sub }); }
      L.changed();
    } });
    return L.modal({ title: c ? t('edit_cat') : t('new_cat'), body: `<div class="form">${L.field('name', t('name'), 'text', c ? c.name : '', { req: true, full: true })}${c ? '' : L.field('kind', t('type'), 'select', 'exp', { options: [['exp', t('kind_exp')], ['inc', t('kind_inc')]] })}${L.field('budget', t('monthly_budget'), 'number', c && c.budget ? c.budget : '', { ph: '0' })}${L.field('rollover', t('rollover'), 'checkbox', c ? c.rollover : false, { full: true })}${L.field('sub', t('is_sub_cat'), 'checkbox', c ? c.sub : false, { full: true })}</div>`, actions });
  };
  L.acts.catform = el => L.catForm(el && el.dataset && el.dataset.id ? L.cat(el.dataset.id) : undefined);
  L.pages.budget = () => {
    const s = st(), ym = L.ym, sum = C.monthSummary(s, ym), bs = C.budgetStatus(s, ym);
    const prevAvg = [1, 2, 3].reduce((a, i) => a + C.monthSummary(s, C.addMonths(ym, -i)).inc, 0) / 3, income = sum.inc > 0 ? sum.inc : prevAvg;
    const planned = s.cats.filter(c => c.kind === 'exp').reduce((a, c) => a + (c.budget || 0), 0), unassigned = income - planned;
    const withBud = new Set(bs.map(b => b.cat.id)), others = s.cats.filter(c => c.kind === 'exp' && !withBud.has(c.id));
    const row = b => `<button class="item" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;display:block" data-act="catform" data-id="${b.cat.id}"><div class="row" style="justify-content:space-between"><b>${esc(b.cat.name)}${b.cat.rollover ? ` <span class="chip">${L.icon('repeat')}</span>` : ''}</b><span class="num">${L.money(b.spent)} / ${L.money(b.limit)}</span></div><div class="bar" style="margin:6px 0" role="progressbar" aria-valuenow="${Math.round(b.pct * 100)}" aria-valuemin="0" aria-valuemax="100"><i class="${b.pct > 1 ? 'over' : ''}" style="width:${Math.min(100, b.pct * 100)}%"></i></div><div class="small mute">${b.left >= 0 ? t('left_of', { v: L.money(b.left) }) : t('over_by', { v: L.money(-b.left) })}${b.carry ? ' · ' + t('carry', { v: L.money(b.carry) }) : ''}</div></button>`;
    return `<div class="head"><div><h1>${t('nav_budget')}</h1><p>${t('budget_sub')}</p></div><button class="btn pri" data-act="catform">${L.icon('plus')}${t('new_cat')}</button></div>
    <div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="mprev" aria-label="${t('prev')}">${L.icon('chevl')}</button><b style="min-width:150px;text-align:center;text-transform:capitalize">${esc(L.monthName(ym))}</b><button class="btn sm" data-act="mnext" aria-label="${t('next')}">${L.icon('chevr')}</button></div>
    <div class="grid" style="margin-bottom:14px"><div class="card c4"><span class="eyebrow">${t('expected_income')}</span><div class="big2">${L.money(income)}</div></div><div class="card c4"><span class="eyebrow">${t('planned')}</span><div class="big2">${L.money(planned)}</div></div><div class="card c4"><span class="eyebrow">${t('unassigned')}</span><div class="big2">${L.money(unassigned)}</div><div class="small mute">${unassigned < 0 ? t('over_assigned') : t('assign_hint')}</div></div></div>
    <div class="card">${bs.length ? bs.map(row).join('') : `<p class="mute">${t('no_budgets')}</p>`}</div>
    ${others.length ? `<h3 style="margin:20px 0 8px">${t('no_budget_cats')}</h3><div class="card"><div class="list">${others.map(c => `<button class="item" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left" data-act="catform" data-id="${c.id}"><span class="tt"><b>${esc(c.name)}</b></span><span class="num">${L.money(sum.byCat[c.id] || 0)}</span><span class="chip">${t('set_budget')}</span></button>`).join('')}</div></div>` : ''}
    <h3 style="margin:20px 0 8px">${t('inc_cats')}</h3><div class="card"><div class="list">${s.cats.filter(c => c.kind === 'inc').map(c => `<button class="item" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left" data-act="catform" data-id="${c.id}"><span class="tt"><b>${esc(c.name)}</b></span><span class="num">${L.money(s.tx.filter(x => x.kind === 'inc' && x.cat === c.id && C.monthOf(x.date) === ym).reduce((a, x) => a + C.toBase(s, x.amt, L.cur(x.acc)), 0))}</span></button>`).join('')}</div></div>`;
  };

  /* ---------- PRONÓSTICO / RECURRENTES / SUSCRIPCIONES / SIMULADOR ---------- */
  L.ui.plan = { tab: 'forecast', days: 60, simCat: '', simPct: 25, inv: { p: 0, m: 100, r: 6, y: 10 } };
  const EVERY = ['day', 'week', 'month', 'year'];
  L.recForm = (r, preset = {}) => {
    const actions = [];
    if (r) actions.push({ label: t('delete'), kind: 'danger', fn: async () => { L.closeModal(); if (!(await L.confirm(t('confirm_delete')))) return true; st().rec = st().rec.filter(x => x.id !== r.id); L.changed(); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root), amt = L.num(d.amt); if (!d.name) throw Error('name'); if (!(amt > 0)) throw Error('amount'); if (!C.validDate(d.start)) throw Error('date'); if (d.end && !C.validDate(d.end)) throw Error('date');
      const o = { name: d.name, kind: d.kind, amt: C.round2(amt), acc: d.acc, cat: d.cat, every: d.every, interval: Math.max(1, Math.min(60, parseInt(d.interval) || 1)), start: d.start, end: d.end || undefined, auto: !!d.auto, sub: !!d.sub };
      if (!L.acc(o.acc)) throw Error('account');
      if (r) { if (o.auto && !r.auto) o.lastGen = C.addDays(C.today(), -1); Object.assign(r, o); } else { if (st().rec.length >= 2000) throw Error('limit'); st().rec.push({ id: nextId(), paused: false, paid: [], lastGen: o.auto ? C.addDays(C.today(), -1) : undefined, ...o }); }
      L.changed();
    } });
    const v = r || { name: preset.name || '', kind: preset.kind || 'exp', amt: preset.amt || '', acc: preset.acc || (st().accounts.find(a => !a.archived) || {}).id, cat: preset.cat || '', every: preset.every || 'month', interval: 1, start: preset.start || C.today(), end: '', auto: false, sub: !!preset.sub };
    return L.modal({ title: r ? t('edit_rec') : t('new_rec'), body: `<div class="form">${L.field('name', t('name'), 'text', v.name, { req: true, full: true })}${L.field('kind', t('type'), 'select', v.kind, { options: [['exp', t('kind_exp')], ['inc', t('kind_inc')]] })}${L.field('amt', t('amount'), 'number', v.amt, { req: true })}${L.field('acc', t('account'), 'select', v.acc, { options: L.accOptions() })}${L.field('cat', t('category'), 'select', v.cat, { options: [['', t('nocat')], ...st().cats.map(c => [c.id, c.name])] })}${L.field('every', t('repeat'), 'select', v.every, { options: EVERY.map(k => [k, t('ev_' + k)]) })}${L.field('interval', t('every_n'), 'number', v.interval, { step: 1, min: 1 })}${L.field('start', t('starts'), 'date', v.start, { req: true })}${L.field('end', t('end_opt'), 'date', v.end || '')}${L.field('auto', t('auto_gen'), 'checkbox', v.auto, { full: true })}${L.field('sub', t('is_sub'), 'checkbox', v.sub, { full: true })}</div>`, actions });
  };
  L.acts.recform = el => L.recForm(el && el.dataset && el.dataset.id ? st().rec.find(x => x.id === el.dataset.id) : undefined);
  L.acts.recpause = el => { const r = st().rec.find(x => x.id === el.dataset.id); r.paused = !r.paused; L.changed(); };
  L.acts.plantab = el => { L.ui.plan.tab = el.dataset.tab; L.render(); };
  L.acts.plandays = el => { L.ui.plan.days = +el.dataset.d; L.render(); };
  L.acts.addsub = el => { const d = JSON.parse(el.dataset.s); L.recForm(null, { name: d.name, amt: d.amt, acc: d.acc, cat: d.cat, every: d.every, start: C.addDays(d.last, d.every === 'week' ? 7 : 30), sub: true }); };
  L.acts.simcat = el => { L.ui.plan.simCat = el.value; L.render(); };
  L.acts.simpct = el => { L.ui.plan.simPct = +el.value; const o = document.getElementById('sim-out'); if (o) o.innerHTML = simOut(); document.getElementById('sim-pct').textContent = el.value + '%'; };
  L.acts.invin = el => { const i = L.ui.plan.inv; i[el.name] = Math.max(0, L.num(el.value) || 0); const o = document.getElementById('inv-out'); if (o) o.innerHTML = invOut(); };
  const simOut = () => { const p = L.ui.plan, w = C.whatIf(st(), p.simCat, p.simPct); return `<div class="grid"><div class="card c4"><span class="eyebrow">${t('avg3')}</span><div class="big2">${L.money(w.avg)}</div></div><div class="card c4"><span class="eyebrow">${t('save_month')}</span><div class="big2">${L.money(w.monthly)}</div></div><div class="card c4"><span class="eyebrow">${t('save_year')}</span><div class="big2">${L.money(w.yearly)}</div></div></div>`; };
  const invOut = () => { const i = L.ui.plan.inv, f = C.compound(i.p, i.m, i.r, i.y), put = i.p + i.m * 12 * i.y; return `<div class="grid"><div class="card c4"><span class="eyebrow">${t('final')}</span><div class="big2">${L.money(f)}</div></div><div class="card c4"><span class="eyebrow">${t('contributed')}</span><div class="big2">${L.money(put)}</div></div><div class="card c4"><span class="eyebrow">${t('earned')}</span><div class="big2">${L.money(f - put)}</div></div></div>`; };
  L.pages.plan = () => {
    const s = st(), p = L.ui.plan, tabs = ['forecast', 'recurring', 'subs', 'sim'];
    const head = `<div class="head"><div><h1>${t('nav_plan')}</h1><p>${t('plan_sub')}</p></div></div><div class="tabs" role="tablist">${tabs.map(k => `<button role="tab" aria-selected="${p.tab === k}" data-act="plantab" data-tab="${k}">${t('tab_' + k)}</button>`).join('')}</div>`;
    if (p.tab === 'forecast') {
      if (!s.accounts.length) return head + L.empty(t('empty_acc'), t('empty_home'), `<button class="btn pri" data-act="accform">${t('new_account')}</button>`);
      const f = C.forecast(s, p.days), mi = f.series.findIndex(x => x.date === f.minDate);
      return head + `<div class="row" style="margin-bottom:12px"><div class="seg">${[30, 60, 90].map(d => `<button aria-pressed="${p.days === d}" data-act="plandays" data-d="${d}">${t('days', { n: d })}</button>`).join('')}</div></div>
      ${f.negativeOn ? `<div class="alert warn">${L.icon('alert')}<span>${esc(t('al_low', { date: L.date(f.negativeOn) }))}</span></div>` : ''}
      <div class="card">${Ch.line(f.series.map((x, i) => ({ y: x.bal, label: i % 10 === 0 ? L.date(x.date) : '' })), { zero: true, mark: mi, label: t('tab_forecast') })}</div>
      <div class="grid" style="margin-top:14px"><div class="card c4"><span class="eyebrow">${t('today')}</span><div class="big2">${L.money(f.series[0].bal)}</div></div><div class="card c4"><span class="eyebrow">${t('lowest')}</span><div class="big2">${L.money(f.min)}</div><div class="small mute">${L.date(f.minDate)}</div></div><div class="card c4"><span class="eyebrow">${t('in_days', { n: p.days })}</span><div class="big2">${L.money(f.end)}</div></div></div><p class="small mute" style="margin-top:10px">${t('forecast_note')}</p>`;
    }
    if (p.tab === 'recurring') {
      const now = C.today(), nextOf = r => { const it = C.occurrences(r, now, C.addDays(now, 800)).next(); return it.done ? null : it.value; };
      return head + `<div class="row" style="margin-bottom:12px"><span class="sp"></span><button class="btn pri" data-act="recform">${L.icon('plus')}${t('new_rec')}</button></div>${s.rec.length ? `<div class="card"><div class="list">${s.rec.map(r => `<div class="item" style="${r.paused ? 'opacity:.55' : ''}"><div class="tt"><b>${esc(r.name)}</b><span class="small mute">${t('ev_' + r.every)}${r.interval > 1 ? ' ×' + r.interval : ''} · ${nextOf(r) ? esc(L.date(nextOf(r))) : '—'}${r.auto ? ' · ' + t('auto') : ''}${r.sub ? ' · ' + t('sub') : ''}</span></div><span class="amt">${r.kind === 'inc' ? '+' : '−'}${L.money(r.amt, L.cur(r.acc))}</span><button class="btn sm" data-act="recpause" data-id="${r.id}">${r.paused ? t('resume') : t('pause')}</button><button class="btn sm ghost" data-act="recform" data-id="${r.id}" aria-label="${t('edit')}">${L.icon('edit')}</button></div>`).join('')}</div></div>` : L.empty(t('no_rec'), t('no_rec_hint'), `<button class="btn pri" data-act="recform">${t('new_rec')}</button>`)}`;
    }
    if (p.tab === 'subs') {
      const subs = s.rec.filter(r => r.sub && !r.paused), det = C.detectSubscriptions(s), month = subs.reduce((a, r) => a + C.toBase(s, C.monthlyEquivalent(r), L.cur(r.acc)), 0);
      return head + `<div class="grid" style="margin-bottom:14px"><div class="card c6"><span class="eyebrow">${t('sub_month')}</span><div class="big2">${L.money(month)}</div></div><div class="card c6"><span class="eyebrow">${t('sub_year')}</span><div class="big2">${L.money(month * 12)}</div></div></div>
      ${subs.length ? `<div class="card"><div class="list">${subs.slice().sort((a, b) => C.monthlyEquivalent(b) - C.monthlyEquivalent(a)).map(r => `<div class="item"><div class="tt"><b>${esc(r.name)}</b><span class="small mute">${t('ev_' + r.every)}</span></div><span class="amt">${L.money(r.amt, L.cur(r.acc))}</span><button class="btn sm ghost" data-act="recform" data-id="${r.id}" aria-label="${t('edit')}">${L.icon('edit')}</button></div>`).join('')}</div></div>` : `<p class="mute">${t('no_subs')}</p>`}
      ${det.length ? `<h3 style="margin:20px 0 8px">${t('detected')}</h3><div class="card"><div class="list">${det.map(d => `<div class="item"><div class="tt"><b>${esc(d.name)}</b><span class="small mute">${t('detected_hint', { n: d.count, e: t('ev_' + d.every) })}</span></div><span class="amt">${L.money(d.amt, L.cur(d.acc))}</span><button class="btn sm" data-act="addsub" data-s='${esc(JSON.stringify(d))}'>${t('track')}</button></div>`).join('')}</div></div>` : ''}`;
    }
    const exp = s.cats.filter(c => c.kind === 'exp'); if (!p.simCat && exp[0]) p.simCat = exp[0].id; const i = p.inv;
    return head + `<div class="card" style="margin-bottom:14px"><h3>${t('sim_title')}</h3><p class="mute small" style="margin-bottom:10px">${t('sim_help')}</p><div class="form"><label class="f">${t('category')}<select data-chg="simcat">${exp.map(c => `<option value="${c.id}"${c.id === p.simCat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="f">${t('cut')} <b id="sim-pct">${p.simPct}%</b><input type="range" min="5" max="100" step="5" value="${p.simPct}" data-inp="simpct"></label></div><div id="sim-out" style="margin-top:12px">${simOut()}</div></div>
    <div class="card"><h3>${t('inv_title')}</h3><div class="form" style="grid-template-columns:repeat(4,1fr)">${[['p', 'inv_start'], ['m', 'inv_month'], ['r', 'inv_rate'], ['y', 'inv_years']].map(([k, lab]) => `<label class="f">${t(lab)}<input type="number" min="0" step="any" name="${k}" value="${i[k]}" data-inp="invin"></label>`).join('')}</div><div id="inv-out" style="margin-top:12px">${invOut()}</div><p class="small mute" style="margin-top:8px">${t('inv_note')}</p></div>`;
  };

  /* ---------- METAS ---------- */
  L.goalForm = g => {
    const actions = [];
    if (g) actions.push({ label: t('delete'), kind: 'danger', fn: async () => { L.closeModal(); if (!(await L.confirm(t('confirm_delete')))) return true; st().goals = st().goals.filter(x => x.id !== g.id); L.changed(); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root), target = L.num(d.target), saved = L.num(d.saved || 0), monthly = L.num(d.monthly || 0); if (!d.name) throw Error('name'); if (!(target > 0) || !(saved >= 0) || !(monthly >= 0)) throw Error('amount'); if (d.due && !C.validDate(d.due)) throw Error('date');
      const o = { name: d.name, target, saved, monthly, due: d.due || undefined, done: saved >= target };
      if (g) Object.assign(g, o); else { if (st().goals.length >= 500) throw Error('limit'); st().goals.push({ id: nextId(), ...o }); } L.changed();
    } });
    return L.modal({ title: g ? t('edit_goal') : t('new_goal'), body: `<div class="form">${L.field('name', t('name'), 'text', g ? g.name : '', { req: true, full: true })}${L.field('target', t('target'), 'number', g ? g.target : '', { req: true })}${L.field('saved', t('saved_so_far'), 'number', g ? g.saved : 0)}${L.field('monthly', t('monthly_plan'), 'number', g ? g.monthly : '')}${L.field('due', t('due_opt'), 'date', g ? g.due || '' : '')}</div><p class="small mute" style="margin-top:8px">${t('goal_note')}</p>`, actions });
  };
  L.acts.goalform = el => L.goalForm(el && el.dataset && el.dataset.id ? st().goals.find(x => x.id === el.dataset.id) : undefined);
  L.acts.goaladd = async el => {
    const g = st().goals.find(x => x.id === el.dataset.id);
    await L.modal({ title: t('contribute'), body: `<div class="form">${L.field('amt', t('amount'), 'number', '', { full: true, min: -1e12 })}</div><p class="small mute">${t('contribute_hint')}</p>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: root => { const a = L.num(L.data(root).amt); if (!Number.isFinite(a) || a === 0) throw Error('amount'); g.saved = Math.max(0, C.round2(g.saved + a)); const was = g.done; g.done = g.saved >= g.target; L.changed(); if (g.done && !was) L.toast(t('goal_done', { name: g.name })); } }] });
  };
  L.pages.goals = () => {
    const s = st();
    const card = g => { const i = C.goalInfo(g); return `<div class="card c6"><div class="row" style="align-items:center;gap:16px"><div class="ring" style="--v:${Math.round(i.pct * 100)}" role="img" aria-label="${Math.round(i.pct * 100)}%"><b style="font-size:18px">${Math.round(i.pct * 100)}%</b></div><div class="sp"><h3 style="margin:0">${esc(g.name)}${i.done ? ` <span class="chip red">${L.icon('check')}</span>` : ''}</h3><div class="num">${L.money(g.saved)} <span class="mute">/ ${L.money(g.target)}</span></div>
      ${i.need != null ? `<div class="small mute">${t('need_month', { v: L.money(i.need) })}${g.due ? ' · ' + t('until', { d: L.date(g.due, { day: 'numeric', month: 'short', year: 'numeric' }) }) : ''}</div>` : ''}${i.eta ? `<div class="small mute">${t('eta', { d: L.date(i.eta, { month: 'long', year: 'numeric' }) })}</div>` : ''}</div></div>
      <div class="row" style="margin-top:10px"><button class="btn sm pri" data-act="goaladd" data-id="${g.id}">${L.icon('plus')}${t('contribute')}</button><button class="btn sm" data-act="goalform" data-id="${g.id}">${L.icon('edit')}${t('edit')}</button></div></div>`; };
    return `<div class="head"><div><h1>${t('nav_goals')}</h1><p>${t('goals_sub')}</p></div><button class="btn pri" data-act="goalform">${L.icon('plus')}${t('new_goal')}</button></div>${s.goals.length ? `<div class="grid">${s.goals.map(card).join('')}</div>` : L.empty(t('no_goals'), t('no_goals_hint'), `<button class="btn pri" data-act="goalform">${t('new_goal')}</button>`)}`;
  };

  /* ---------- DEUDAS ---------- */
  L.ui.debt = { extra: 0 };
  L.debtForm = dbt => {
    const actions = [];
    if (dbt) actions.push({ label: t('delete'), kind: 'danger', fn: async () => { L.closeModal(); if (!(await L.confirm(t('confirm_delete')))) return true; st().debts = st().debts.filter(x => x.id !== dbt.id); L.changed(); return true; } });
    actions.push({ label: t('save'), kind: 'pri', fn: root => {
      const d = L.data(root), bal = L.num(d.bal), apr = L.num(d.apr || 0), min = L.num(d.min || 0); if (!d.name) throw Error('name'); if (!(bal >= 0) || !(apr >= 0) || !(min >= 0)) throw Error('amount'); const cur = d.cur.toUpperCase(); if (!/^[A-Z]{3}$/.test(cur)) throw Error('cur');
      const o = { name: d.name, bal, apr, min, cur }; if (dbt) Object.assign(dbt, o); else { if (st().debts.length >= 500) throw Error('limit'); st().debts.push({ id: nextId(), ...o }); } L.changed();
    } });
    return L.modal({ title: dbt ? t('edit_debt') : t('new_debt'), body: `<div class="form">${L.field('name', t('name'), 'text', dbt ? dbt.name : '', { req: true, full: true })}${L.field('bal', t('balance'), 'number', dbt ? dbt.bal : '', { req: true })}${L.field('apr', t('apr'), 'number', dbt ? dbt.apr : '')}${L.field('min', t('min_payment'), 'number', dbt ? dbt.min : '')}${L.field('cur', t('currency'), 'text', dbt ? dbt.cur : st().settings.currency, { attrs: ' list="curs" maxlength="3" style="text-transform:uppercase"' })}${L.curList}</div>`, actions });
  };
  L.acts.debtform = el => L.debtForm(el && el.dataset && el.dataset.id ? st().debts.find(x => x.id === el.dataset.id) : undefined);
  L.acts.debtextra = el => { L.ui.debt.extra = Math.max(0, L.num(el.value) || 0); const o = document.getElementById('debt-out'); if (o) o.innerHTML = debtOut(); };
  L.acts.debtpay = async el => {
    const d = st().debts.find(x => x.id === el.dataset.id);
    await L.modal({ title: t('pay_debt'), body: `<div class="form">${L.field('amt', t('amount'), 'number', d.min || '', { full: true })}${L.field('acc', t('from_account_opt'), 'select', '', { options: [['', '—'], ...L.accOptions()], full: true })}</div>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: root => { const x = L.data(root), a = L.num(x.amt); if (!(a > 0)) throw Error('amount'); d.bal = Math.max(0, C.round2(d.bal - a)); if (x.acc) st().tx.push({ id: nextId(), date: C.today(), amt: C.round2(a), kind: 'exp', acc: x.acc, cat: '', note: t('debt_payment', { name: d.name }), tags: ['deuda'] }); L.changed(); } }] });
  };
  const plans = () => { const ds = st().debts.map(d => ({ ...d, bal: C.toBase(st(), d.bal, d.cur), min: C.toBase(st(), d.min, d.cur) })); return ['avalanche', 'snowball'].map(m => ({ m, ...C.debtPlan(ds, L.ui.debt.extra, m) })); };
  const debtOut = () => {
    const [av, sn] = plans(), best = av.interest <= sn.interest ? av : sn, other = best === av ? sn : av;
    const end = r => r.ok ? L.date(C.addDays(C.today(), Math.round(r.months * 30.4375)), { month: 'long', year: 'numeric' }) : '—';
    const names = id => esc((st().debts.find(d => d.id === id) || {}).name || '');
    return `<div class="grid">${[av, sn].map(r => `<div class="card c6" ${r === best ? 'style="outline:2px solid var(--red)"' : ''}><h3>${t('m_' + r.m)} ${r === best ? `<span class="chip red">${t('best')}</span>` : ''}</h3><div class="big2">${r.ok ? t('months', { n: r.months }) : '—'}</div><div class="small mute">${t('debt_free', { d: end(r) })}</div><div class="small">${t('total_interest')}: <b>${L.money(r.interest)}</b></div><div class="small mute" style="margin-top:6px">${t('order')}: ${r.order.map(names).join(' → ')}</div></div>`).join('')}</div>${best.interest < other.interest ? `<p style="margin-top:10px"><b>${t('you_save', { v: L.money(other.interest - best.interest) })}</b></p>` : ''}`;
  };
  L.pages.debts = () => {
    const s = st(), tot = s.debts.reduce((a, d) => a + C.toBase(s, d.bal, d.cur), 0);
    return `<div class="head"><div><h1>${t('nav_debts')}</h1><p>${t('total_debt')}: <b>${L.money(tot)}</b></p></div><button class="btn pri" data-act="debtform">${L.icon('plus')}${t('new_debt')}</button></div>
    ${s.debts.length ? `<div class="card" style="margin-bottom:14px"><div class="list">${s.debts.map(d => `<div class="item"><div class="tt"><b>${esc(d.name)}</b><span class="small mute">${d.apr}% · ${t('min')} ${L.money(d.min, d.cur)}</span></div><span class="amt">${L.money(d.bal, d.cur)}</span><button class="btn sm" data-act="debtpay" data-id="${d.id}">${t('pay')}</button><button class="btn sm ghost" data-act="debtform" data-id="${d.id}" aria-label="${t('edit')}">${L.icon('edit')}</button></div>`).join('')}</div></div>
    <div class="card"><h3>${t('payoff_planner')}</h3><label class="f" style="max-width:280px">${t('extra_month')}<input type="number" min="0" step="any" value="${L.ui.debt.extra || ''}" data-inp="debtextra" placeholder="0"></label><div id="debt-out" style="margin-top:12px">${debtOut()}</div><p class="small mute" style="margin-top:8px">${t('debt_note')}</p></div>` : L.empty(t('no_debts'), t('no_debts_hint'), `<button class="btn pri" data-act="debtform">${t('new_debt')}</button>`)}`;
  };

  /* ---------- COMPARTIDOS ---------- */
  L.acts.personform = async () => { await L.modal({ title: t('new_person'), body: `<div class="form">${L.field('name', t('name'), 'text', '', { req: true, full: true })}</div>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: root => { const n = L.data(root).name; if (!n) throw Error('name'); if (st().people.length >= 200) throw Error('limit'); st().people.push({ id: nextId(), name: n }); L.changed(); } }] }); };
  L.acts.persondel = async el => { if (!(await L.confirm(t('confirm_person')))) return; const id = el.dataset.id; st().people = st().people.filter(p => p.id !== id); st().shared = st().shared.filter(e => e.paidBy !== id && e.from !== id && e.to !== id).map(e => ({ ...e, parts: (e.parts || []).filter(x => x !== id) })); L.changed(); };
  L.acts.sharedform = async () => {
    const s = st(); if (!s.people.length) { L.toast(t('need_person')); return L.acts.personform(); }
    const who = [['me', t('me')], ...s.people.map(p => [p.id, p.name])];
    await L.modal({ title: t('new_shared'), body: `<div class="form">${L.field('desc', t('description'), 'text', '', { req: true, full: true })}${L.field('amt', t('amount'), 'number', '', { req: true })}${L.field('date', t('date'), 'date', C.today())}${L.field('paidBy', t('paid_by'), 'select', 'me', { options: who, full: true })}<div class="full"><span class="mono">${t('split_with')}</span>${who.map(([id, n]) => `<label class="chk" style="margin-top:6px"><input type="checkbox" name="p_${id}" checked>${esc(n)}</label>`).join('')}</div>${s.accounts.length ? L.field('rec', t('record_my_share'), 'checkbox', false, { full: true }) + L.field('acc', t('account'), 'select', (s.accounts[0] || {}).id, { options: L.accOptions() }) + L.field('cat', t('category'), 'select', '', { options: [['', t('nocat')], ...L.catOptions('exp')] }) : ''}</div>`,
      actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: root => {
        const d = L.data(root), amt = L.num(d.amt); if (!d.desc) throw Error('name'); if (!(amt > 0)) throw Error('amount'); if (!C.validDate(d.date)) throw Error('date');
        const parts = who.map(w => w[0]).filter(id => d['p_' + id]); if (!parts.length) throw Error('split'); if (s.shared.length >= 20000) throw Error('limit');
        s.shared.push({ id: nextId(), date: d.date, desc: d.desc, amt: C.round2(amt), paidBy: d.paidBy, parts });
        if (d.rec && parts.includes('me') && L.acc(d.acc)) s.tx.push({ id: nextId(), date: d.date, amt: C.round2(amt / parts.length), kind: 'exp', acc: d.acc, cat: d.cat, note: d.desc, tags: ['compartido'] });
        L.changed();
      } }] });
  };
  L.acts.settle = async el => {
    const s = st(), p = s.people.find(x => x.id === el.dataset.id), bal = C.sharedBalances(s)[p.id] || 0; if (!bal) return;
    await L.modal({ title: t('settle'), body: `<p>${esc(bal > 0 ? t('settle_in', { n: p.name }) : t('settle_out', { n: p.name }))}</p><div class="form">${L.field('amt', t('amount'), 'number', Math.abs(bal), { full: true })}</div>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: root => { const a = L.num(L.data(root).amt); if (!(a > 0)) throw Error('amount'); s.shared.push({ id: nextId(), date: C.today(), desc: t('settle'), amt: C.round2(a), settle: true, paidBy: '', parts: [], from: bal > 0 ? p.id : 'me', to: bal > 0 ? 'me' : p.id }); L.changed(); } }] });
  };
  L.acts.shareddel = el => { const i = st().shared.findIndex(e => e.id === el.dataset.id); if (i < 0) return; const [row] = st().shared.splice(i, 1); L.changed(); L.toast(t('deleted'), () => { st().shared.push(row); L.changed(); }); };
  L.pages.shared = () => {
    const s = st(), bal = C.sharedBalances(s), name = id => id === 'me' ? t('me') : ((s.people.find(p => p.id === id) || {}).name || '?');
    return `<div class="head"><div><h1>${t('nav_shared')}</h1><p>${t('shared_sub')}</p></div><div class="row"><button class="btn" data-act="personform">${L.icon('plus')}${t('new_person')}</button><button class="btn pri" data-act="sharedform">${L.icon('plus')}${t('new_shared')}</button></div></div>
    ${s.people.length ? `<div class="grid" style="margin-bottom:14px">${s.people.map(p => { const b = bal[p.id] || 0; return `<div class="card c4"><div class="row"><b>${esc(p.name)}</b><span class="sp"></span><button class="btn sm ghost" data-act="persondel" data-id="${p.id}" aria-label="${t('delete')}">${L.icon('trash')}</button></div><div class="big2">${L.money(Math.abs(b))}</div><div class="small mute">${b > 0 ? t('owes_you') : b < 0 ? t('you_owe') : t('even')}</div>${b ? `<button class="btn sm" style="margin-top:8px" data-act="settle" data-id="${p.id}">${t('settle')}</button>` : ''}</div>`; }).join('')}</div>` : L.empty(t('no_people'), t('no_people_hint'), `<button class="btn pri" data-act="personform">${t('new_person')}</button>`)}
    ${s.shared.length ? `<h3 style="margin:18px 0 8px">${t('history')}</h3><div class="card"><div class="list">${s.shared.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map(e => `<div class="item"><div class="tt"><b>${esc(e.settle ? t('settle') : e.desc)}</b><span class="small mute">${esc(L.date(e.date))} · ${e.settle ? esc(name(e.from) + ' → ' + name(e.to)) : esc(t('paid_by_x', { n: name(e.paidBy), k: (e.parts || []).length }))}</span></div><span class="amt">${L.money(e.amt)}</span><button class="btn sm ghost" data-act="shareddel" data-id="${e.id}" aria-label="${t('delete')}">${L.icon('trash')}</button></div>`).join('')}</div></div>` : ''}`;
  };

  /* ---------- REPORTES ---------- */
  L.ui.rep = 6;
  L.acts.repn = el => { L.ui.rep = +el.dataset.n; L.render(); };
  L.acts.repcsv = () => {
    const s = st(), n = L.ui.rep, now = C.monthOf(C.today()), rows = [['month', 'income', 'expenses', 'net', 'savings_rate']];
    for (let i = n - 1; i >= 0; i--) { const m = C.addMonths(now, -i), x = C.monthSummary(s, m); rows.push([m, x.inc, x.exp, x.net, Math.round(x.rate * 100) + '%']); }
    return L.download(`koluva-ledger-report-${C.today()}.csv`, '﻿' + C.toCSV(rows), 'text/csv');
  };
  L.acts.print = () => window.print();
  L.pages.reports = () => {
    const s = st(), n = L.ui.rep, now = C.monthOf(C.today()), months = [];
    for (let i = n - 1; i >= 0; i--) { const m = C.addMonths(now, -i); months.push({ m, ...C.monthSummary(s, m) }); }
    const byCat = {}, byNote = {}; let inc = 0, exp = 0;
    for (const x of s.tx) { if (x.kind !== 'exp' || !months.some(mm => mm.m === C.monthOf(x.date))) continue; const v = C.toBase(s, x.amt, L.cur(x.acc)); byCat[x.cat] = (byCat[x.cat] || 0) + v; if (x.note) byNote[x.note.trim()] = (byNote[x.note.trim()] || 0) + v; }
    months.forEach(m => { inc += m.inc; exp += m.exp; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), notes = Object.entries(byNote).sort((a, b) => b[1] - a[1]).slice(0, 8), totalCat = cats.reduce((a, [, v]) => a + v, 0) || 1;
    const worth = s.worth.slice(-24);
    return `<div class="head"><div><h1>${t('nav_reports')}</h1></div><div class="row"><div class="seg">${[3, 6, 12].map(k => `<button aria-pressed="${n === k}" data-act="repn" data-n="${k}">${t('months', { n: k })}</button>`).join('')}</div><button class="btn" data-act="repcsv">${L.icon('export')}CSV</button><button class="btn desk" data-act="print">${t('print')}</button></div></div>
    <div class="grid"><div class="card c4"><span class="eyebrow">${t('income')}</span><div class="big2">${L.money(inc)}</div></div><div class="card c4"><span class="eyebrow">${t('expenses')}</span><div class="big2">${L.money(exp)}</div></div><div class="card c4"><span class="eyebrow">${t('saved_rate')}</span><div class="big2">${inc > 0 ? L.pct((inc - exp) / inc) : '—'}</div></div>
    <div class="card c12"><h3>${t('inc_vs_exp')}</h3>${Ch.bars(months.map(m => ({ label: L.monthName(m.m, { month: 'short' }), a: m.inc, b: m.exp })), t('inc_vs_exp'))}<div class="row small mute" style="margin-top:6px"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--c3)"></i>${t('income')}</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--c1)"></i>${t('expenses')}</span></div></div>
    <div class="card c6"><h3>${t('by_category')}</h3>${cats.length ? `<div class="row" style="gap:14px;align-items:center">${Ch.donut(cats.slice(0, 6).map(([, v]) => ({ value: v })), t('by_category'))}<div class="sp"><table><tbody>${cats.slice(0, 10).map(([id, v], i) => `<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:${i < 6 ? Ch.col(i) : 'var(--bar)'}"></i>${esc(L.catName(id))}</td><td class="r">${L.money(v)}</td><td class="r mute">${Math.round(v / totalCat * 100)}%</td></tr>`).join('')}</tbody></table></div></div>` : `<p class="mute">${t('no_data')}</p>`}</div>
    <div class="card c6"><h3>${t('top_places')}</h3>${notes.length ? `<table><tbody>${notes.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${L.money(v)}</td></tr>`).join('')}</tbody></table>` : `<p class="mute">${t('no_data')}</p>`}</div>
    <div class="card c12"><h3>${t('networth_hist')}</h3>${worth.length > 1 ? Ch.line(worth.map(w => ({ y: w.net, label: L.monthName(w.ym, { month: 'short' }) })), { label: t('networth_hist') }) : `<p class="mute">${t('worth_hint')}</p>`}</div>
    <div class="card c12"><h3>${t('monthly_table')}</h3><div style="overflow:auto"><table><thead><tr><th>${t('month')}</th><th class="r">${t('income')}</th><th class="r">${t('expenses')}</th><th class="r">${t('net')}</th><th class="r">${t('saved_rate')}</th></tr></thead><tbody>${months.slice().reverse().map(m => `<tr><td style="text-transform:capitalize">${esc(L.monthName(m.m))}</td><td class="r">${L.money(m.inc)}</td><td class="r">${L.money(m.exp)}</td><td class="r">${L.signed(m.net)}</td><td class="r">${m.inc > 0 ? L.pct(m.rate) : '—'}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  };
})();
