'use strict';
/* Koluva Ledger: resumen ampliado, alta rápida, análisis por pestaña, Ctrl K y widget de Android. Se carga después de settings.js. */
(function () {
  const L = window.L, C = L.C, esc = L.esc, st = () => L.st(), I = window.LedgerI18n;
  const t = L.t;

  const dayNum = s => Number(s.slice(8, 10));
  const exps = (s, from, to) => s.tx.filter(x => x.kind === 'exp' && x.date >= from && x.date <= to);
  const base = (s, x) => C.toBase(s, x.amt, (L.acc(x.acc) || {}).cur);
  const sum = (s, list) => list.reduce((a, x) => a + base(s, x), 0);
  const delta = (cur, prev, big = '') => {
    if (!prev) return '';
    const p = Math.round((cur - prev) / prev * 100);
    return `<small class="${p > 0 ? 'down' : 'up'}">${t('vs_same', { p: Math.abs(p), dir: t(p >= 0 ? 'dir_more' : 'dir_less') })}</small>`;
  };
  const card = (label, value, sub = '') => `<section class="card c3 pl-kpi"><span class="mute small">${esc(label)}</span><b class="num pl-big">${value}</b>${sub}</section>`;
  const injectBefore = (html, marker, extra) => { const i = html.indexOf(marker); return i < 0 ? html : html.slice(0, i) + extra + html.slice(i); };

  function dailyBars(s, ym) {
    const n = C.daysIn(ym), per = Array(n).fill(0), today = C.today();
    for (const x of exps(s, ym + '-01', ym + '-' + String(n).padStart(2, '0'))) per[dayNum(x.date) - 1] += base(s, x);
    const max = Math.max(1, ...per), W = 620, H = 150, bw = W / n;
    const cols = per.map((v, i) => { const h = v / max * (H - 30), d = `${ym}-${String(i + 1).padStart(2, '0')}`; return `<rect x="${(i * bw + 1.5).toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${Math.max(v ? 2 : 0, h).toFixed(1)}" rx="3" class="chart-bar ${d === today ? 'pl-now' : ''}" style="animation-delay:${Math.min(i, 8) * 24}ms"><title>${esc(L.date(d))}: ${L.money(v)}</title></rect>${(i + 1) % 5 === 0 || i === 0 ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${i + 1}</text>` : ''}`; }).join('');
    return `<svg class="chart chart-motion pl-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('daily_chart'))}">${cols}</svg>`;
  }

  /* ---------- RESUMEN ---------- */
  const baseHome = L.pages.home;
  L.pages.home = function () {
    const html = baseHome(), s = st(); if (!s.accounts.length) return html;
    const now = C.today(), ym = C.monthOf(now), n = dayNum(now), dim = C.daysIn(ym), pm = C.addMonths(ym, -1);
    const ms = C.monthSummary(s, ym), sameLast = sum(s, exps(s, pm + '-01', pm + '-' + String(Math.min(n, C.daysIn(pm))).padStart(2, '0')));
    const avg = n ? ms.exp / n : 0, proj = avg * dim, spentDays = new Set(s.tx.filter(x => x.kind === 'exp').map(x => x.date));
    let streak = 0; for (let d = now; streak < 365 && !spentDays.has(d); d = C.addDays(d, -1)) streak++;
    const todaySpent = sum(s, exps(s, now, now));
    const quick = `<div class="row pl-actions"><button class="btn pri" data-act="plq" data-k="exp">${L.icon('plus')}${esc(t('q_exp'))}</button><button class="btn" data-act="plq" data-k="inc">${L.icon('plus')}${esc(t('q_inc'))}</button><button class="btn" data-act="plq" data-k="xfer">${L.icon('tx')}${esc(t('q_xfer'))}</button></div>`;
    const strip = `<div class="grid pl-strip">${card(t('vs_last'), L.money(ms.exp), delta(ms.exp, sameLast))}${card(t('avg_day'), L.money(avg), `<small class="mute">${esc(t('proj_month', { v: L.money(proj) }))}</small>`)}${card(t('nospend'), String(streak), `<small class="mute">${esc(t('nospend_sub'))}</small>`)}${card(t('today_spent'), L.money(todaySpent))}</div>`;
    const recent = s.tx.slice(-60).reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), goals = s.goals.slice(0, 3);
    const rec = recent.length ? `<div class="list">${recent.map(x => `<div class="item"><div class="tt"><b>${esc(x.note || (x.kind === 'xfer' ? t('kind_xfer') : L.catName(x.cat)))}</b><span class="small mute">${esc(L.date(x.date))}</span></div><span class="amt ${x.kind === 'inc' ? 'in' : ''}">${x.kind === 'inc' ? '+' : x.kind === 'exp' ? '−' : ''}${L.money(x.amt, L.cur(x.acc))}</span></div>`).join('')}</div>` : `<p class="mute">${esc(t('no_tx'))}</p>`;
    const gl = goals.length ? goals.map(g => { const gi = C.goalInfo(g, now); return `<div style="margin:8px 0"><div class="row small" style="justify-content:space-between"><b>${esc(g.name)}</b><span class="mute">${L.pct(gi.pct)}</span></div><div class="bar"><i style="width:${gi.pct * 100}%"></i></div></div>`; }).join('') : `<p class="mute">${esc(t('no_goals_yet'))}</p>`;
    const extra = `<div class="grid pl-extra"><section class="card c12"><h3>${esc(t('daily_chart'))}</h3>${dailyBars(s, ym)}</section><section class="card c6"><div class="row"><h3>${esc(t('recent_tx'))}</h3><span class="sp"></span><button class="btn sm ghost" data-act="go" data-p="tx">${esc(t('see_all'))}</button></div>${rec}</section><section class="card c6"><div class="row"><h3>${esc(t('goals_prog'))}</h3><span class="sp"></span><button class="btn sm ghost" data-act="go" data-p="goals">${esc(t('see_all'))}</button></div>${gl}</section></div>`;
    return injectBefore(html, '<div class="grid">', quick + strip) + extra;
  };
  L.acts.plq = el => { const k = el.dataset.k; L.txForm(null, { kind: k }); };

  /* ---------- MOVIMIENTOS: resumen del filtro y carga rápida ---------- */
  const baseTx = L.pages.tx;
  L.pages.tx = function () {
    const html = baseTx(), s = st(), f = L.ui.tx, ym = L.ym;
    const list = s.tx.filter(x => C.monthOf(x.date) === ym && (!f.acc || x.acc === f.acc || x.to === f.acc) && (!f.kind || x.kind === f.kind) && (!f.cat || x.cat === f.cat) && (!f.q || (x.note + ' ' + L.catName(x.cat) + ' ' + (x.tags || []).join(' ')).toLowerCase().includes(f.q.toLowerCase())));
    const inc = sum(s, list.filter(x => x.kind === 'inc')), exp = sum(s, list.filter(x => x.kind === 'exp')), big = list.filter(x => x.kind === 'exp').sort((a, b) => base(s, b) - base(s, a))[0];
    const strip = `<div class="grid pl-strip">${card(t('f_count'), String(list.length))}${card(t('income'), L.money(inc))}${card(t('expenses'), L.money(exp))}${card(t('f_net'), L.signed(inc - exp), big ? `<small class="mute">${esc(t('f_big'))}: ${esc(big.note || L.catName(big.cat))} (${L.money(big.amt, L.cur(big.acc))})</small>` : '')}</div>`;
    const accs = L.accOptions(), cats = L.catOptions('exp');
    const qa = `<section class="card pl-qa" data-qa><div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end"><b>${esc(t('qa_title'))}</b><span class="mute small">${esc(t('qa_hint'))}</span></div><div class="pl-qa-row">
      <label class="f"><span class="sr">${esc(t('type'))}</span><select name="kind"><option value="exp">${esc(t('kind_exp'))}</option><option value="inc">${esc(t('kind_inc'))}</option></select></label>
      <label class="f"><span class="sr">${esc(t('amount'))}</span><input name="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('amount'))}"></label>
      <label class="f"><span class="sr">${esc(t('category'))}</span><select name="cat"><option value="">${esc(t('nocat'))}</option>${cats.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span class="sr">${esc(t('account'))}</span><select name="acc">${accs.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></label>
      <label class="f pl-note"><span class="sr">${esc(t('qa_note'))}</span><input name="note" maxlength="80" placeholder="${esc(t('qa_note'))}"></label>
      <button class="btn pri" data-act="qadd">${L.icon('plus')}${esc(t('add'))}</button></div></section>`;
    return injectBefore(html, '<div class="form" style="grid-template-columns:2fr 1fr 1fr 1fr', strip + qa);
  };
  L.acts.qadd = el => {
    const box = el.closest('[data-qa]'), g = n => box.querySelector(`[name=${n}]`).value, s = st();
    const amt = L.num(g('amt')), kind = g('kind'), acc = g('acc'); if (!(amt > 0) || !L.acc(acc)) return L.toast(t('err_amount'));
    const cat = g('cat') || '', note = g('note').trim().slice(0, 80);
    if (s.tx.length >= C.LIMITS.tx) return L.toast(t('err_limit'));
    s.tx.push({ id: C.uid(), date: C.today(), amt: C.round2(amt), kind, acc, cat, note, tags: [] });
    L.changed(); L.toast(t('qa_done', { v: L.money(amt, L.cur(acc)) }));
    const i = document.querySelector('[data-qa] [name=amt]'); if (i) i.focus();
  };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-qa]') && e.target.tagName === 'INPUT') { e.preventDefault(); L.acts.qadd(e.target); } });

  /* ---------- PRESUPUESTO, METAS, CUENTAS, REPORTES ---------- */
  const afterHead = (html, strip) => {
    const i = html.indexOf('<div class="head"'); if (i < 0) return html + strip;
    const re = /<div|<\/div>/g; re.lastIndex = i; let depth = 0, m;
    while ((m = re.exec(html))) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) return html.slice(0, re.lastIndex) + strip + html.slice(re.lastIndex); }
    return html + strip;
  };
  const baseBudget = L.pages.budget;
  L.pages.budget = function () {
    const html = baseBudget(), s = st(), ym = L.ym, bs = C.budgetStatus(s, ym); if (!bs.length) return html;
    const spent = bs.reduce((a, b) => a + b.spent, 0), limit = bs.reduce((a, b) => a + b.limit, 0), now = C.today(), cur = C.monthOf(now) === ym, pace = cur ? dayNum(now) / C.daysIn(ym) : 1, used = limit > 0 ? spent / limit : 0;
    const paceTxt = used > pace + 0.08 ? t('b_pace_fast') : t('b_pace_ok');
    return afterHead(html, `<div class="grid pl-strip">${card(t('b_planned'), L.money(limit))}${card(t('b_spent'), L.money(spent), `<small class="mute">${L.pct(used)}</small>`)}${card(t('b_left'), L.money(limit - spent))}${card(t('b_pace'), L.pct(pace), `<small class="${used > pace + 0.08 ? 'down' : 'up'}">${esc(paceTxt)}</small>`)}</div>`);
  };
  const baseGoals = L.pages.goals;
  L.pages.goals = function () {
    const html = baseGoals(), s = st(); if (!s.goals.length) return html;
    const saved = s.goals.reduce((a, g) => a + C.toBase(s, g.saved, g.cur), 0), target = s.goals.reduce((a, g) => a + C.toBase(s, g.target, g.cur), 0), done = s.goals.filter(g => C.goalInfo(g).done).length;
    const next = s.goals.filter(g => g.due && !C.goalInfo(g).done).sort((a, b) => a.due.localeCompare(b.due))[0];
    return afterHead(html, `<div class="grid pl-strip">${card(t('g_saved'), L.money(saved), `<small class="mute">${target ? L.pct(saved / target) : ''}</small>`)}${card(t('g_target'), L.money(target))}${card(t('g_done'), `${done} / ${s.goals.length}`)}${card(t('g_next'), next ? esc(L.date(next.due)) : '—', next ? `<small class="mute">${esc(next.name)}</small>` : '')}</div>`);
  };
  const baseAcc = L.pages.accounts;
  L.pages.accounts = function () {
    const html = baseAcc(), s = st(); if (!s.accounts.length) return html; const tot = C.totals(s, C.today());
    return afterHead(html, `<div class="grid pl-strip">${card(t('a_net'), L.money(tot.net))}${card(t('a_liquid'), L.money(tot.liquid))}${card(t('a_assets'), L.money(tot.assets))}${card(t('a_liabs'), L.money(tot.liabs))}</div>`);
  };
  const baseRep = L.pages.reports;
  L.pages.reports = function () {
    const html = baseRep(), s = st(), now = C.today(), ym = C.monthOf(now); if (!s.tx.some(x => x.kind === 'exp')) return html;
    const from = C.addDays(now, -89), wd = Array(7).fill(0); for (const x of exps(s, from, now)) wd[(C.parse(x.date).getDay() + 6) % 7] += base(s, x);
    const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(({ es: 'es-AR', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR' })[L.lang()], { weekday: 'short' })), max = Math.max(1, ...wd);
    const wbars = `<div class="pl-hours">${wd.map((v, i) => `<div title="${esc(names[i])}: ${L.money(v)}"><i style="height:${Math.max(4, v / max * 100)}%"></i><small>${esc(names[i])}</small></div>`).join('')}</div>`;
    const top = exps(s, ym + '-01', ym + '-31').sort((a, b) => base(s, b) - base(s, a)).slice(0, 5);
    const topH = top.length ? `<div class="list">${top.map(x => `<div class="item"><div class="tt"><b>${esc(x.note || L.catName(x.cat))}</b><span class="small mute">${esc(L.date(x.date))} · ${esc(L.catName(x.cat))}</span></div><span class="amt">−${L.money(x.amt, L.cur(x.acc))}</span></div>`).join('')}</div>` : `<p class="mute">${esc(t('no_data'))}</p>`;
    const cur = C.monthSummary(s, ym).byCat, prev = C.monthSummary(s, C.addMonths(ym, -1)).byCat;
    const moves = [...new Set([...Object.keys(cur), ...Object.keys(prev)])].map(id => ({ id, d: (cur[id] || 0) - (prev[id] || 0) })).filter(m => Math.abs(m.d) > 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
    const mv = moves.length ? `<div class="list">${moves.map(m => `<div class="item"><div class="tt"><b>${esc(L.catName(m.id))}</b></div><span class="amt ${m.d < 0 ? 'in' : ''}">${m.d > 0 ? '+' : '−'}${L.money(Math.abs(m.d))}</span></div>`).join('')}</div>` : `<p class="mute">${esc(t('no_data'))}</p>`;
    const extra = `<div class="grid pl-extra"><section class="card c6"><h3>${esc(t('weekday_chart'))}</h3><p class="mute small">${esc(t('last90'))}</p>${wbars}</section><section class="card c6"><h3>${esc(t('top_exp'))}</h3>${topH}</section><section class="card c12"><h3>${esc(t('cat_moves'))}</h3>${mv}</section></div>`;
    return html + extra;
  };

  /* ---------- Ctrl K ---------- */
  function palette() {
    if (document.getElementById('pl-pal') || !L.st() || !L.st().accounts) return;
    const items = [{ l: t('q_exp'), run: () => L.txForm(null, { kind: 'exp' }) }, { l: t('q_inc'), run: () => L.txForm(null, { kind: 'inc' }) }, { l: t('q_xfer'), run: () => L.txForm(null, { kind: 'xfer' }) }, ...['home', 'tx', 'budget', 'plan', 'goals', 'debts', 'shared', 'accounts', 'reports', 'settings'].map(p => ({ l: t('nav_' + p), run: () => L.go(p) }))];
    const box = document.createElement('div'); box.id = 'pl-pal'; box.innerHTML = `<div class="pl-card" role="dialog" aria-label="${esc(t('pal_ph'))}"><input type="text" placeholder="${esc(t('pal_ph'))}" autocomplete="off"><ul></ul></div>`;
    document.body.append(box);
    const input = box.querySelector('input'), ul = box.querySelector('ul'); let sel = 0, shown = items;
    const draw = () => { ul.innerHTML = shown.map((i, n) => `<li class="${n === sel ? 'on' : ''}" data-i="${n}">${esc(i.l)}</li>`).join(''); };
    const close = () => box.remove(), go = n => { const i = shown[n]; close(); if (i) i.run(); };
    input.addEventListener('input', () => { const q = input.value.toLowerCase(); shown = items.filter(i => i.l.toLowerCase().includes(q)); sel = 0; draw(); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') go(sel); });
    ul.addEventListener('click', e => { const li = e.target.closest('li'); if (li) go(Number(li.dataset.i)); });
    box.addEventListener('mousedown', e => { if (e.target === box) close(); });
    draw(); input.focus();
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); } });

  /* ---------- Widget de Android: "Podés gastar hoy" y próximos pagos ---------- */
  const native = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor.Plugins && window.Capacitor.Plugins.LedgerNative : null;
  let wt = null;
  function pushWidget() {
    const N = native(), s = st(); if (!N || !N.setWidget || !s || !s.accounts || !s.accounts.length) return;
    try {
      const now = C.today(), sp = C.safeToSpend(s, now), up = C.upcoming(s, 10, now).slice(0, 3);
      N.setWidget({ title: t('w_title'), big: L.money(Math.max(0, sp.left)), sub: `${L.money(sp.perDay)} ${t('w_day')}`, none: t('w_none'), rows: JSON.stringify(up.map(u => ({ when: L.date(u.date), text: u.rec.name, amt: (u.rec.kind === 'inc' ? '+' : '−') + L.money(u.rec.amt, L.cur(u.rec.acc)) }))) });
    } catch { /* el widget es opcional */ }
  }
  L.pushWidget = () => { clearTimeout(wt); wt = setTimeout(pushWidget, 800); };
  const baseSettings = L.pages.settings;
  if (baseSettings) L.pages.settings = function () { const h = baseSettings(); return native() ? h + `<p class="mute small" style="margin:12px 0">${esc(t('w_hint'))}</p>` : h; };
  const baseChanged = L.changed; L.changed = function () { baseChanged.apply(this, arguments); L.pushWidget(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pushWidget(); });
  setTimeout(pushWidget, 2500); setInterval(pushWidget, 10 * 60 * 1000);
})();
