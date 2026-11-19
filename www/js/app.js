'use strict';
/* Marco de la app: utilidades, navegación (con Dock en escritorio), modales, avisos, render. */
(function () {
  const C = window.LedgerCore, S = window.LedgerStore, I = window.LedgerI18n;
  const L = window.L = { C, S, pages: {}, acts: {}, page: 'home', ym: C.monthOf(C.today()), ui: {} };
  L.st = () => S.state;

  /* ---------- texto y formato ---------- */
  L.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  L.lang = () => (S.state && S.state.settings.lang) || 'es';
  L.t = (k, v) => { let s = (I.T[L.lang()] || I.T.es)[k]; if (s == null) s = I.T.es[k]; if (s == null) return k; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
  const LOC = { es: 'es', en: 'en', pt: 'pt-BR', fr: 'fr' };
  const nf = {};
  L.money = (n, cur, o = {}) => {
    cur = cur || S.state.settings.currency; const k = L.lang() + cur + (o.dec === 0 ? 0 : 1);
    try { nf[k] = nf[k] || new Intl.NumberFormat(LOC[L.lang()], { style: 'currency', currency: cur, maximumFractionDigits: o.dec === 0 ? 0 : undefined, minimumFractionDigits: o.dec === 0 ? 0 : undefined }); return nf[k].format(n); }
    catch { return (Math.round(n * 100) / 100).toFixed(2) + ' ' + cur; }
  };
  L.signed = (n, cur) => (n > 0 ? '+' : n < 0 ? '−' : '') + L.money(Math.abs(n), cur);
  L.pct = v => Math.round(v * 100) + '%';
  L.date = (s, o) => C.parse(s).toLocaleDateString(LOC[L.lang()], o || { day: 'numeric', month: 'short' });
  L.dateLong = s => C.parse(s).toLocaleDateString(LOC[L.lang()], { weekday: 'long', day: 'numeric', month: 'long' });
  L.monthName = (ym, o) => C.parse(ym + '-01').toLocaleDateString(LOC[L.lang()], o || { month: 'long', year: 'numeric' });
  L.acc = id => S.state.accounts.find(a => a.id === id);
  L.cat = id => S.state.cats.find(c => c.id === id);
  L.catName = id => (L.cat(id) || { name: L.t('nocat') }).name;
  L.cur = accId => (L.acc(accId) || {}).cur || S.state.settings.currency;

  const IC = {
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>', tx: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    budget: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>', plan: '<path d="M3 17l5-6 4 3 8-9"/><path d="M15 5h5v5"/>',
    goals: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>', debts: '<path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6M9 11h6"/>',
    shared: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.3 0 4 1.8 4 4.5"/>',
    accounts: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>', reports: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', check: '<path d="M5 12l5 5 9-10"/>',
    chevl: '<path d="M15 5l-7 7 7 7"/>', chevr: '<path d="M9 5l7 7-7 7"/>', down: '<path d="M12 4v13M6 12l6 6 6-6"/>', up: '<path d="M12 20V7M6 12l6-6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', export: '<path d="M12 3v12M7 8l5-5 5 5M5 15v4h14v-4"/>', cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
  };
  L.icon = (n, cls) => `<svg class="${cls || 'ico'}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

  /* ---------- controles de ventana propios (Windows) ---------- */
  L.winControls = () => {
    const w = window.ledgerHost && window.ledgerHost.win, host = document.querySelector('.titlebar .acts');
    if (!w || !host || host.querySelector('.wc')) return;
    const svg = d => `<svg viewBox="0 0 12 12" aria-hidden="true">${d}</svg>`;
    const ic = { min: svg('<path d="M2 6h8"/>'), max: svg('<rect x="2.5" y="2.5" width="7" height="7" rx="1"/>'), res: svg('<path d="M4.5 2.5h5v5M2.5 4.5h5v5h-5z"/>'), close: svg('<path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/>') };
    const box = document.createElement('div'); box.className = 'wc';
    box.innerHTML = `<button type="button" data-c="min" aria-label="${L.esc(L.t('win_min'))}">${ic.min}</button><button type="button" data-c="max" aria-label="${L.esc(L.t('win_max'))}">${ic.max}</button><button type="button" data-c="close" class="x" aria-label="${L.esc(L.t('win_close'))}">${ic.close}</button>`;
    box.onclick = e => { const b = e.target.closest('button'); if (b) w.cmd(b.dataset.c); };
    const mark = m => { const b = box.querySelector('[data-c=max]'); b.innerHTML = m ? ic.res : ic.max; };
    w.onState(mark); w.isMax().then(mark); host.append(box); document.documentElement.classList.add('has-wc');
  };

  /* ---------- tema y movimiento ---------- */
  L.applyPrefs = () => {
    const s = S.state.settings, root = document.documentElement;
    const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light'; root.dataset.motion = s.motion; root.lang = s.lang;
    document.title = 'Koluva Ledger';
    if (window.ledgerHost) { root.classList.add('is-win'); L.winControls(); }
    document.querySelectorAll('.logo-l').forEach(i => { i.src = `assets/koluva-ledger-imagotipo-${dark ? 'white' : 'ink'}.svg`; });
    document.querySelectorAll('.wm').forEach(i => { i.src = `assets/koluva-ledger-logotipo-${dark ? 'white' : 'ink'}.svg`; });
    const q = document.getElementById('quick'); if (q) q.innerHTML = L.icon('plus') + L.esc(L.t('add'));
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.state) L.applyPrefs(); });
  L.motionOn = () => { const m = S.state.settings.motion; return m === 'on' || (m === 'system' && !matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* ---------- toasts ---------- */
  L.toast = (msg, undo, label) => {
    const box = document.getElementById('toast'), el = document.createElement('div'); el.className = 't'; el.innerHTML = `<span>${L.esc(msg)}</span>`;
    if (undo) { const b = document.createElement('button'); b.textContent = label || L.t('undo'); b.onclick = () => { undo(); el.remove(); }; el.append(b); }
    box.append(el); setTimeout(() => el.remove(), undo ? 7000 : 3500);
  };

  /* ---------- modal ---------- */
  const dlg = () => document.getElementById('modal');
  L.closeModal = () => { const d = dlg(); if (d.open) d.close(); };
  L.modal = ({ title, body, actions = [], onOpen, cls }) => new Promise(resolve => {
    const d = dlg(); document.getElementById('mtitle').textContent = title; document.getElementById('mbody').innerHTML = body; d.className = cls || '';
    const foot = document.getElementById('mfoot'); foot.innerHTML = '';
    const close = v => { d.removeEventListener('close', onClose); if (d.open) d.close(); resolve(v); };
    const onClose = () => resolve(undefined);
    for (const a of actions) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.kind || ''); b.textContent = a.label;
      b.onclick = async () => { b.disabled = true; try { const r = await a.fn?.(document.getElementById('mbody')); if (r !== false) close(r === undefined ? true : r); } catch (e) { L.toast(L.errMsg(e)); } b.disabled = false; };
      foot.append(b);
    }
    document.getElementById('mclose').setAttribute('aria-label', L.t('close')); document.getElementById('mclose').onclick = () => close(undefined);
    d.addEventListener('close', onClose, { once: true });
    document.getElementById('mform').onsubmit = e => { e.preventDefault(); foot.querySelector('.pri')?.click(); };
    d.showModal(); onOpen?.(document.getElementById('mbody'));
    const f = document.querySelector('#mbody input:not([type=hidden]),#mbody select'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
  });
  L.errMsg = e => { const m = String(e && e.message || e); return I.T.es['err_' + m] ? L.t('err_' + m) : L.t('err_generic'); };
  L.confirm = (msg, label) => L.modal({ title: L.t('confirm'), body: `<p>${L.esc(msg)}</p>`, actions: [{ label: L.t('cancel'), fn: () => 'no' }, { label: label || L.t('ok'), kind: 'pri', fn: () => true }] }).then(v => v === true);

  /* ---------- campos y formularios ---------- */
  L.field = (name, label, type = 'text', value = '', o = {}) => {
    const v = value == null ? '' : value, cls = 'f' + (o.full ? ' full' : '');
    if (type === 'select') return `<label class="${cls}">${L.esc(label)}<select name="${name}">${o.options.map(([val, txt]) => `<option value="${L.esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${L.esc(txt)}</option>`).join('')}</select></label>`;
    if (type === 'checkbox') return `<label class="chk ${o.full ? 'full' : ''}"><input type="checkbox" name="${name}"${v ? ' checked' : ''}>${L.esc(label)}</label>`;
    if (type === 'textarea') return `<label class="${cls}">${L.esc(label)}<textarea name="${name}" rows="3" maxlength="${o.max || 500}">${L.esc(v)}</textarea></label>`;
    const extra = type === 'number' ? ` step="${o.step || 'any'}" min="${o.min != null ? o.min : 0}" inputmode="decimal"` : ` maxlength="${o.max || 80}"`;
    return `<label class="${cls}">${L.esc(label)}<input name="${name}" type="${type}" value="${L.esc(v)}"${extra}${o.req ? ' required' : ''}${o.ph ? ` placeholder="${L.esc(o.ph)}"` : ''}${o.attrs || ''}></label>`;
  };
  L.data = root => { const o = {}; root.querySelectorAll('[name]').forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
  L.num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  L.options = (list, sel) => list.map(x => [x.id, x.name]);

  /* ---------- guardar / cambios ---------- */
  L.changed = (keepModal) => { C.snapshotWorth(S.state); S.touch(); L.render(); L.schedule?.(); L.checkBudgetAlerts?.(); };
  S.onStatus = st => { const e = document.getElementById('save'); if (e) e.textContent = ({ pending: '…', saving: '…', saved: L.t('saved'), error: L.t('save_error') })[st] || ''; if (st === 'error') L.toast(L.t('save_error')); };

  /* ---------- navegación ---------- */
  const NAV = ['home', 'tx', 'budget', 'plan', 'goals', 'debts', 'shared', 'accounts', 'reports'];
  L.go = (p, ym) => { L.page = p; if (ym) L.ym = ym; const m = document.getElementById('main'); m.classList.remove('enter'); L.render(); m.scrollTop = 0; void m.offsetWidth; m.classList.add('enter'); };
  function drawNav() {
    const item = (p, extra = '') => `<button class="nav-item" data-act="go" data-p="${p}" ${L.page === p ? 'aria-current="page"' : ''}>${L.icon(p)}<span>${L.esc(L.t('nav_' + p))}</span></button>`;
    document.getElementById('nav').innerHTML = NAV.map(p => item(p)).join('');
    document.getElementById('foot').innerHTML = item('settings');
    const tb = (p) => `<button data-act="go" data-p="${p}" ${L.page === p ? 'aria-current="page"' : ''}>${L.icon(p)}<span>${L.esc(L.t('nav_' + p))}</span></button>`;
    document.getElementById('tabbar').innerHTML = tb('home') + tb('tx') + `<button class="plus" data-act="quick" aria-label="${L.esc(L.t('add'))}"><span class="c">${L.icon('plus')}</span></button>` + tb('budget') + `<button data-act="more" ${['plan', 'goals', 'debts', 'shared', 'accounts', 'reports', 'settings'].includes(L.page) ? 'aria-current="page"' : ''}>${L.icon('more')}<span>${L.esc(L.t('more'))}</span></button>`;
  }
  L.render = () => {
    L.applyPrefs(); drawNav();
    const pg = L.pages[L.page] || L.pages.home, main = document.getElementById('main');
    const keep = main.scrollTop; main.innerHTML = `<div class="page">${pg()}</div>`; main.scrollTop = keep;
    L.after?.[L.page]?.(main);
  };
  L.after = {};

  L.acts.go = el => L.go(el.dataset.p);
  L.acts.more = () => L.modal({
    title: L.t('more'), body: `<div class="list">${['plan', 'goals', 'debts', 'shared', 'accounts', 'reports', 'settings'].map(p => `<button class="item btn ghost" style="justify-content:flex-start;width:100%" data-more="${p}">${L.icon(p)}<span>${L.esc(L.t('nav_' + p))}</span></button>`).join('')}</div>`,
    onOpen: root => root.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { L.closeModal(); L.go(b.dataset.more); }),
  });
  L.acts.quick = () => L.txForm?.();

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || el.closest('dialog') && !el.closest('#mbody')) return;
    const f = L.acts[el.dataset.act]; if (f) { e.preventDefault(); Promise.resolve(f(el, e)).catch(err => L.toast(L.errMsg(err))); }
  });
  document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && L.acts[el.dataset.chg]) L.acts[el.dataset.chg](el, e); });
  document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && L.acts[el.dataset.inp]) L.acts[el.dataset.inp](el, e); });

  /* atajos de escritorio */
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey || document.getElementById('layer').children.length) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); L.acts.quick(); }
    else if (/^[1-9]$/.test(e.key)) { L.go(NAV[+e.key - 1]); }
  });
  document.getElementById('nav').addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; const items = [...document.querySelectorAll('#nav .nav-item')], i = items.indexOf(document.activeElement);
    if (i < 0) return; e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });

  /* Dock Koluva: el icono bajo el puntero crece y los vecinos crecen menos. Solo puntero preciso. */
  (function dock() {
    const side = document.querySelector('.side'); if (!side) return;
    const set = (items, y) => items.forEach(it => { const r = it.getBoundingClientRect(), d = Math.abs(y - (r.top + r.height / 2)); it.style.setProperty('--s', y == null ? 1 : (1 + .28 * Math.max(0, 1 - d / 110)).toFixed(3)); });
    side.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !L.motionOn()) return; set([...side.querySelectorAll('.nav-item')], e.clientY); });
    side.addEventListener('pointerleave', () => side.querySelectorAll('.nav-item').forEach(i => i.style.removeProperty('--s')));
  })();

  /* categoría -> color de punto (no se usa color extra: puntos por posición) */
  L.catOptions = kind => S.state.cats.filter(c => c.kind === kind).map(c => [c.id, c.name]);
  L.accOptions = (all) => S.state.accounts.filter(a => all || !a.archived).map(a => [a.id, `${a.name} (${a.cur})`]);
  L.empty = (title, text, btn) => `<div class="empty"><img src="assets/koluva-ledger-isotipo-color.svg" alt=""><h3>${L.esc(title)}</h3><p>${L.esc(text || '')}</p>${btn || ''}</div>`;
  L.download = async (name, text, mime) => { try { if (await S.Host.saveFile(name, text, mime)) L.toast(L.t('exported')); } catch (e) { L.toast(L.errMsg(e)); } };
})();
