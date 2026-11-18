'use strict';
/* Ajustes, copias, actualizaciones, bloqueo con PIN, recorrido, asistente inicial y apertura. */
(function () {
  const L = window.L, C = L.C, S = L.S, Host = S.Host, esc = L.esc, t = L.t, cfg = window.LEDGER_CFG;
  const st = () => L.st();
  const LANGS = [['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français']];

  /* ---------- ACTUALIZACIONES ---------- */
  L.ui.upd = { state: 'idle', manifest: null, pct: 0, msg: '' };
  const U = L.ui.upd;
  const lastKey = 'ledger-last-update-check';
  const redraw = () => { if (L.page === 'settings') { const box = document.getElementById('upd'); if (box) box.innerHTML = updHtml(); } };
  const updHtml = () => {
    const note = U.manifest ? (U.manifest.notes && (U.manifest.notes[L.lang()] || U.manifest.notes.es) || '') : '';
    const body = { idle: '', checking: `<p class="mute">${t('upd_checking')}</p>`, current: `<p>${t('upd_current')}</p>`, unpublished: `<p class="mute">${t('upd_unpub')}</p>`, error: `<p>${esc(U.msg || t('upd_error'))}</p>`,
      available: `<p><b>${t('upd_available', { v: U.manifest && U.manifest.version })}</b></p><p class="small mute" style="white-space:pre-line">${esc(note)}</p><button class="btn pri" data-act="upddl">${L.icon('down')}${t('upd_download')}</button>`,
      downloading: `<p>${t('upd_downloading', { p: U.pct })}</p><div class="bar"><i style="width:${U.pct}%"></i></div>`,
      ready: `<p><b>${t('upd_ready')}</b></p><button class="btn pri" data-act="updinstall">${t('upd_install')}</button>` }[U.state] || '';
    return body;
  };
  let notifiedUpd = '';
  const auto = () => st().settings.autoUpdate !== false;
  async function checkUpdate(silent) {
    if (!Host.canUpdate || U.state === 'checking' || U.state === 'downloading') return;
    U.state = 'checking'; redraw();
    try {
      const r = await Host.update.check(); U.state = r.status; U.manifest = r.manifest || null; try { localStorage.setItem(lastKey, String(Date.now())); } catch {}
      if (r.status === 'available' && silent && notifiedUpd !== r.manifest.version) { notifiedUpd = r.manifest.version; L.toast(t('upd_available', { v: r.manifest.version }), () => L.go('settings'), t('view')); }
    } catch (e) { U.state = silent ? 'idle' : 'error'; U.msg = ''; }
    redraw();
  }
  L.checkUpdateSoon = () => {
    if (auto()) setTimeout(() => { if (auto()) checkUpdate(true); }, 4000);
    setInterval(() => { if (auto() && !document.hidden) checkUpdate(true); }, 6 * 36e5);
  };
  L.acts.updcheck = () => checkUpdate(false);
  L.acts.upddl = async () => {
    U.state = 'downloading'; U.pct = 0; redraw();
    try { await Host.update.download(U.manifest, p => { U.pct = Math.max(0, Math.min(100, Math.round(p.pct != null ? p.pct : (p.received / p.total) * 100))); redraw(); }); U.state = 'ready'; }
    catch (e) { U.state = 'error'; U.msg = t('upd_error_verify'); }
    redraw();
  };
  L.acts.updinstall = async () => { await S.flush(); try { await Host.update.install(); } catch (e) { U.state = 'error'; U.msg = t('upd_error'); redraw(); } };

  /* ---------- COPIAS ---------- */
  L.acts.exportjson = () => L.download(`koluva-ledger-${C.today()}.json`, JSON.stringify(st()), 'application/json');
  L.acts.exportenc = async () => {
    const ok = await L.modal({ title: t('export_enc'), body: `<p class="small mute">${t('enc_help')}</p><div class="form">${L.field('p1', t('password'), 'password', '', { full: true, max: 200 })}${L.field('p2', t('password_again'), 'password', '', { full: true, max: 200 })}</div>`,
      actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('export'), kind: 'pri', fn: async root => { const d = L.data(root); if (d.p1.length < 8) throw Error('pass_short'); if (d.p1 !== d.p2) throw Error('pass_match'); const txt = await C.encryptBackup(st(), d.p1); await L.download(`koluva-ledger-${C.today()}.kledger`, txt, 'application/octet-stream'); } }] });
  };
  L.acts.importfile = async () => {
    const f = await Host.openFile(); if (!f) return;
    let next;
    try {
      if (/"koluvaLedger"/.test(f.text.slice(0, 200))) {
        const pass = await L.modal({ title: t('password'), body: `<div class="form">${L.field('p', t('password'), 'password', '', { full: true, max: 200 })}</div>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('ok'), kind: 'pri', fn: root => L.data(root).p || false }] });
        if (typeof pass !== 'string') return; next = await C.decryptBackup(f.text, pass);
      } else next = C.sanitize(JSON.parse(f.text));
    } catch (e) { return L.toast(e.message === 'bad-pass' ? t('err_bad-pass') : t('err_file')); }
    if (!(await L.confirm(t('import_confirm', { a: next.tx.length, b: next.accounts.length })))) return;
    const bak = JSON.stringify(st()); try { await Host.saveFile(`koluva-ledger-before-import-${C.today()}.json`, bak, 'application/json'); } catch {}
    S.replace(next); C.snapshotWorth(next); L.applyPrefs(); L.render(); L.toast(t('imported_ok'));
  };
  L.acts.wipe = async () => {
    if (!(await L.confirm(t('wipe_confirm'), t('delete')))) return;
    const txt = await L.modal({ title: t('wipe_title'), body: `<p>${esc(t('wipe_type', { w: 'BORRAR' }))}</p><div class="form">${L.field('w', '', 'text', '', { full: true })}</div>`, actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('delete'), kind: 'danger', fn: root => L.data(root).w.toUpperCase() === 'BORRAR' || L.data(root).w.toUpperCase() === 'DELETE' ? true : false }] });
    if (txt !== true) return;
    const lang = st().settings.lang; const s = C.emptyState(lang); C.seedCats(s, lang); s.settings.tourDone = true; S.replace(s); L.applyPrefs(); L.go('home');
  };

  /* ---------- PIN ---------- */
  L.acts.pinset = async () => {
    await L.modal({ title: t('pin_set'), body: `<p class="small mute">${t('pin_help')}</p><div class="form">${L.field('a', t('pin_new'), 'password', '', { full: true, attrs: ' inputmode="numeric" maxlength="8" autocomplete="off"' })}${L.field('b', t('pin_again'), 'password', '', { full: true, attrs: ' inputmode="numeric" maxlength="8" autocomplete="off"' })}</div>`,
      actions: [{ label: t('cancel'), fn: () => 'no' }, { label: t('save'), kind: 'pri', fn: async root => { const d = L.data(root); if (!/^\d{4,8}$/.test(d.a)) throw Error('pin_fmt'); if (d.a !== d.b) throw Error('pin_match'); st().settings.pin = await C.hashPin(d.a); L.changed(); L.toast(t('pin_on')); } }] });
  };
  L.acts.pinoff = async () => { if (!(await L.confirm(t('pin_off_confirm')))) return; st().settings.pin = null; L.changed(); };
  let fails = 0, until = 0;
  L.lock = () => {
    if (!st().settings.pin || document.getElementById('lock')) return;
    const layer = document.getElementById('layer'); let v = '';
    const el = document.createElement('div'); el.className = 'lock'; el.id = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('locked'));
    const draw = (msg) => { el.innerHTML = `<img class="lg" src="assets/koluva-ledger-imagotipo-${document.documentElement.dataset.theme === 'dark' ? 'white' : 'ink'}.svg" alt="Koluva Ledger"><div class="eyebrow">${t('enter_pin')}</div><div class="pins" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i < v.length ? 'on' : ''}" ${i >= 4 && v.length < 5 ? 'style="display:none"' : ''}></i>`).join('')}</div><div class="small" role="status" style="min-height:20px">${esc(msg || '')}</div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del" aria-label="${t('delete')}">⌫</button><button data-k="0">0</button><button data-k="ok" aria-label="${t('ok')}">✓</button></div>`; };
    const tryPin = async () => {
      if (Date.now() < until) return draw(t('pin_wait', { s: Math.ceil((until - Date.now()) / 1000) }));
      const h = await C.hashPin(v, st().settings.pin.salt);
      if (h.hash === st().settings.pin.hash) { fails = 0; el.remove(); return; }
      v = ''; fails++; if (fails >= 5) { until = Date.now() + Math.min(300, 30 * (fails - 4)) * 1000; draw(t('pin_wait', { s: Math.min(300, 30 * (fails - 4)) })); } else draw(t('pin_bad'));
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; if (k === 'del') v = v.slice(0, -1); else if (k === 'ok') return tryPin(); else if (v.length < 8) v += k; draw(); });
    el.addEventListener('keydown', e => { if (/^\d$/.test(e.key) && v.length < 8) { v += e.key; draw(); } else if (e.key === 'Backspace') { v = v.slice(0, -1); draw(); } else if (e.key === 'Enter') tryPin(); });
    el.tabIndex = -1; draw(); layer.append(el); el.focus();
  };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60000 && S.state && S.state.settings.pin) L.lock(); });

  /* ---------- AJUSTES ---------- */
  L.acts.setpref = el => { const s = st().settings; s[el.dataset.k] = el.dataset.v === undefined ? (el.type === 'checkbox' ? el.checked : el.value) : el.dataset.v; if (el.dataset.k === 'remindDays') s.remindDays = Math.max(0, Math.min(14, parseInt(el.value) || 0)); L.changed(); };
  L.acts.setlang = el => { st().settings.lang = el.value; L.changed(); };
  L.acts.setname = el => { st().settings.name = el.value.slice(0, 60); S.touch(); };
  L.acts.setcur = el => { const v = el.value.toUpperCase(); if (/^[A-Z]{3}$/.test(v)) { st().settings.currency = v; L.changed(); } else { L.toast(t('err_cur')); el.value = st().settings.currency; } };
  L.acts.setrate = el => { const v = L.num(el.value); if (v > 0) { st().rates[el.name] = v; L.changed(); } else { delete st().rates[el.name]; L.changed(); } };
  L.acts.setnotify = async el => { const s = st().settings; s.notify = el.checked; if (s.notify && Host.kind === 'web') { try { await Notification.requestPermission(); } catch {} } if (s.notify && Host.kind === 'android') { try { await Host.notify(t('notif_on_title'), t('notif_on_body')); } catch {} } L.changed(); };
  L.acts.tour = () => L.tour();
  L.acts.openurl = el => Host.openExternal(el.dataset.u);
  L.pages.settings = () => {
    const s = st(), set = s.settings, used = [...new Set([...s.accounts.map(a => a.cur), ...s.debts.map(d => d.cur)])].filter(c => c !== set.currency);
    const seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, lab]) => `<button data-act="setpref" data-k="${k}" data-v="${v}" aria-pressed="${set[k] === v}">${esc(lab)}</button>`).join('')}</div>`;
    return `<div class="head"><div><h1>${t('nav_settings')}</h1></div></div><div class="grid">
    <section class="card c6"><h3>${t('appearance')}</h3><div class="form">
      <label class="f">${t('language')}<select data-chg="setlang">${LANGS.map(([c, n]) => `<option value="${c}"${set.lang === c ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="f"><span>${t('theme')}</span>${seg('theme', [['light', t('th_light')], ['dark', t('th_dark')], ['system', t('th_system')]])}</div>
      <div class="f full"><span>${t('motion')}</span>${seg('motion', [['on', t('mo_on')], ['system', t('mo_system')], ['off', t('mo_off')]])}</div>
      <label class="chk full"><input type="checkbox" ${set.opening ? 'checked' : ''} data-chg="setopen">${t('opening')}</label></div><button class="btn" style="margin-top:12px" data-act="tour">${t('tour_again')}</button></section>
    <section class="card c6"><h3>${t('profile')}</h3><div class="form"><label class="f">${t('your_name')}<input value="${esc(set.name)}" data-inp="setname" maxlength="60"></label><label class="f">${t('base_currency')}<input value="${esc(set.currency)}" list="curs" maxlength="3" style="text-transform:uppercase" data-chg="setcur"></label>${L.curList}</div>
      ${used.length ? `<h3 style="margin:14px 0 6px">${t('rates')}</h3><p class="small mute">${t('rates_help', { cur: set.currency })}</p><div class="form">${used.map(c => `<label class="f">1 ${esc(c)} = ? ${esc(set.currency)}<input type="number" min="0" step="any" name="${esc(c)}" value="${s.rates[c] || ''}" data-chg="setrate"></label>`).join('')}</div>` : ''}</section>
    <section class="card c6"><h3>${t('reminders')}</h3><label class="chk"><input type="checkbox" ${set.notify ? 'checked' : ''} data-chg="setnotify">${t('remind_on')}</label><label class="f" style="margin-top:10px;max-width:240px">${t('remind_days')}<input type="number" min="0" max="14" step="1" value="${set.remindDays}" data-chg="setpref" data-k="remindDays"></label><p class="small mute" style="margin-top:8px">${t(Host.kind === 'android' ? 'remind_note_android' : 'remind_note')}</p></section>
    <section class="card c6"><h3>${t('security')}</h3><p class="small mute">${t('security_note')}</p><div class="row" style="margin-top:10px">${set.pin ? `<button class="btn" data-act="pinset">${L.icon('lock')}${t('pin_change')}</button><button class="btn danger" data-act="pinoff">${t('pin_off')}</button>` : `<button class="btn" data-act="pinset">${L.icon('lock')}${t('pin_set')}</button>`}</div></section>
    <section class="card c12"><h3>${t('your_data')}</h3><p class="small mute">${t('data_note')}</p><div class="row" style="margin-top:10px"><button class="btn" data-act="exportjson">${L.icon('export')}${t('export_json')}</button><button class="btn" data-act="exportenc">${L.icon('lock')}${t('export_enc')}</button><button class="btn" data-act="importfile">${L.icon('down')}${t('import_backup')}</button><span class="sp"></span><button class="btn danger" data-act="wipe">${L.icon('trash')}${t('wipe')}</button></div></section>
    <section class="card c12"><h3>${t('updates')}</h3><p class="small mute">${t('version')} <b class="mono" style="letter-spacing:.05em">${esc(Host.version)}</b> · ${t('platform_' + Host.kind)}</p>${Host.canUpdate ? `<div class="row" style="margin:10px 0"><button class="btn" data-act="updcheck">${L.icon('refresh')}${t('upd_check')}</button></div><label class="chk full" style="margin-bottom:8px"><input type="checkbox" ${auto() ? 'checked' : ''} data-chg="setautoupd">${t('auto_upd')}</label><div id="upd">${updHtml()}</div>` : `<p class="mute">${t('upd_web')}</p>`}</section>
    <section class="card c12"><h3>${t('about')}</h3><p><b>Koluva Ledger</b> — ${t('summary')}</p><p class="small mute" style="margin-top:6px">${t('tagline')}</p><div class="row" style="margin-top:10px"><button class="btn sm" data-act="openurl" data-u="https://koluva.com">koluva.com</button><button class="btn sm" data-act="openurl" data-u="https://github.com/${cfg.repo}">GitHub</button><button class="btn sm" data-act="license">${t('license_title')}</button></div></section></div>`;
  };
  L.acts.setautoupd = el => { st().settings.autoUpdate = el.checked; L.changed(); if (el.checked) checkUpdate(true); };
  L.acts.setopen = el => { st().settings.opening = el.checked; L.changed(); };
  L.acts.license = () => L.modal({ title: t('license_title'), body: `<p style="white-space:pre-line" class="small">${esc(t('license_text'))}</p>`, actions: [{ label: t('close'), kind: 'pri' }] });

  /* ---------- RECORDATORIOS ---------- */
  L.schedule = () => {
    const s = st(); if (!s.settings.notify) return Host.schedule([]);
    const list = [], days = s.settings.remindDays;
    for (const u of C.upcoming(s, 30)) {
      if (u.rec.auto || u.rec.kind !== 'exp') continue;
      const at = C.parse(C.addDays(u.date, -days)); at.setHours(9, 0, 0, 0); if (at.getTime() < Date.now()) continue;
      list.push({ id: Math.abs([...(u.rec.id + u.date)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)), at: at.getTime(), title: t('notif_title'), body: t('notif_body', { n: u.rec.name, v: L.money(u.rec.amt, L.cur(u.rec.acc)), d: L.date(u.date) }) });
      if (list.length >= 40) break;
    }
    Host.schedule(list);
  };
  let notified = new Set();
  setInterval(() => { // escritorio/web: avisos mientras la app está abierta
    const s = S.state; if (!s || !s.settings.notify || Host.kind === 'android') return;
    const today = C.today();
    for (const u of C.upcoming(s, s.settings.remindDays)) { if (u.rec.auto || u.rec.kind !== 'exp') continue; const k = u.rec.id + u.date + today; if (notified.has(k)) continue; notified.add(k); Host.notify(t('notif_title'), t('notif_body', { n: u.rec.name, v: L.money(u.rec.amt, L.cur(u.rec.acc)), d: L.date(u.date) })); }
  }, 30 * 60000);

  /* ---------- RECORRIDO ---------- */
  L.tour = async () => {
    const slides = ['t1', 't2', 't3', 't4', 't5']; let i = 0;
    const body = () => `<div class="tour"><img src="assets/koluva-ledger-isotipo-color.svg" alt=""><h2>${t(slides[i] + '_h')}</h2><p style="margin-top:8px">${t(slides[i] + '_p')}</p><div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const draw = () => { document.getElementById('mbody').innerHTML = body(); const f = document.getElementById('mfoot'); f.innerHTML = ''; const mk = (lab, kind, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + kind; b.textContent = lab; b.onclick = fn; f.append(b); }; mk(t('skip'), 'ghost', end); if (i > 0) mk(t('prev'), '', () => { i--; draw(); }); mk(i === slides.length - 1 ? t('start') : t('next'), 'pri', () => { if (i === slides.length - 1) end(); else { i++; draw(); } }); };
    const end = () => { st().settings.tourDone = true; S.touch(); L.closeModal(); };
    L.modal({ title: t('tour_title'), body: body(), actions: [], onOpen: draw }); setTimeout(draw, 0);
  };

  /* ---------- ASISTENTE INICIAL ---------- */
  L.setup = async () => {
    const detect = (navigator.language || 'es').slice(0, 2); let lang = LANGS.some(l => l[0] === detect) ? detect : 'es';
    st().settings.lang = lang; C.seedCats(st(), lang); L.applyPrefs();
    const guessCur = { 'es-AR': 'ARS', 'es-MX': 'MXN', 'es-CL': 'CLP', 'es-CO': 'COP', 'es-PE': 'PEN', 'es-UY': 'UYU', 'pt-BR': 'BRL', 'es-ES': 'EUR', 'fr-FR': 'EUR', 'en-GB': 'GBP', 'en-CA': 'CAD', 'en-AU': 'AUD' }[navigator.language] || 'USD';
    const body = () => `<p class="small mute">${t('setup_lang')}</p><div class="seg" role="group" style="margin-bottom:14px">${LANGS.map(([c, n]) => `<button type="button" data-lang="${c}" aria-pressed="${lang === c}">${n}</button>`).join('')}</div><p>${esc(t('setup_intro'))}</p><div class="form" style="margin-top:12px">${L.field('name', t('your_name'), 'text', st().settings.name, { full: true })}${L.field('cur', t('base_currency'), 'text', st().settings.currency === 'USD' ? guessCur : st().settings.currency, { attrs: ' list="curs" maxlength="3" style="text-transform:uppercase"' })}${L.curList}${L.field('type', t('first_account_type'), 'select', 'bank', { options: ['cash', 'bank', 'wallet', 'savings'].map(k => [k, t('acc_' + k)]) })}${L.field('acc', t('first_account'), 'text', '', { full: true, ph: t('first_account_ph') })}${L.field('open', t('opening_balance'), 'number', '', { min: -1e12 })}</div>`;
    const keep = {};
    await L.modal({ title: t('welcome'), body: body(), actions: [{ label: t('create'), kind: 'pri', fn: root => { const d = L.data(root), cur = d.cur.toUpperCase(); if (!/^[A-Z]{3}$/.test(cur)) throw Error('cur'); const open = L.num(d.open || 0); if (!Number.isFinite(open)) throw Error('amount'); const s = st(); s.settings.name = d.name; s.settings.currency = cur; if (d.acc) s.accounts.push({ id: C.uid(), name: d.acc.slice(0, 60), type: d.type, cur, open, archived: false }); L.changed(); } }],
      onOpen: root => root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { const d = L.data(root); lang = b.dataset.lang; st().settings.lang = lang; C.seedCats(st(), lang); st().settings.name = d.name; st().settings.currency = (d.cur || 'USD').toUpperCase(); L.applyPrefs(); document.getElementById('mtitle').textContent = t('welcome'); root.innerHTML = body(); root.querySelector('[name=acc]').value = d.acc; root.querySelector('[name=open]').value = d.open; root.querySelector('[name=type]').value = d.type; root.querySelectorAll('[data-lang]').forEach(x => x.onclick = b.onclick); document.querySelector('#mfoot .pri').textContent = t('create'); }) });
  };

  /* ---------- APERTURA (propia de Ledger: los pilares suben como peldaños) ---------- */
  L.opening = () => {
    if (!st().settings.opening || !L.motionOn() || !window.KolivaIntro) return Promise.resolve();
    return window.KolivaIntro.play({ iso: 'assets/koluva-ledger-isotipo-white.svg', pattern: 'assets/ledger-isotipo-pattern.svg', color: '#C8102E', duration: 2000 });
  };
})();
