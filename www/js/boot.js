'use strict';
(async function () {
  const L = window.L, C = L.C, S = L.S;
  try {
    const detect = (navigator.language || 'es').slice(0, 2), r = await S.init(['es', 'en', 'pt', 'fr'].includes(detect) ? detect : 'es');
    L.applyPrefs();
    document.getElementById('app').hidden = false;
    const s = S.state;
    if (r.fresh) {
      if (r.corrupt) L.toast(L.t('corrupt'));
      L.render(); await L.opening(); await L.setup(); L.render(); if (!s.settings.tourDone) await L.tour();
    } else {
      if (r.recovered) L.toast(L.t('recovered'));
      const made = C.applyDueRecurring(s); C.snapshotWorth(s); if (made) { S.touch(); L.toast(L.t('auto_created', { n: made })); }
      L.render(); L.lock(); await L.opening(); if (!s.settings.tourDone && s.accounts.length === 0) await L.tour();
    }
    L.schedule(); L.checkUpdateSoon();
    setInterval(() => { const m = C.applyDueRecurring(S.state); if (m) { S.touch(); L.render(); } }, 6 * 36e5);
  } catch (e) {
    const esc = v => String(v == null ? '' : v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const cap = window.Capacitor, NL = String.fromCharCode(10), info = ['Koluva Ledger ' + ((window.LEDGER_CFG && window.LEDGER_CFG.version) || '?'), 'plataforma: ' + (cap && cap.getPlatform ? cap.getPlatform() : 'web'), 'navegador: ' + navigator.userAgent].join(NL);
    const detail = ((e && (e.name || 'Error')) + ': ' + (e && e.message) + NL + String((e && e.stack) || '').split(NL).slice(0, 8).join(NL) + NL + NL + info);
    document.body.innerHTML = '<div style="padding:24px;font:15px/1.5 system-ui;color:#222;background:#fff;min-height:100vh"><p><b>Koluva Ledger no pudo iniciar / could not start.</b></p><p>Tus datos no se tocaron. Copiá este detalle y enviáselo a Koluva (koluvacorp@gmail.com):</p><pre style="white-space:pre-wrap;word-break:break-word;background:#f3f3f3;padding:12px;border-radius:8px;font-size:12px">' + esc(detail) + '</pre><button id="retry" style="padding:12px 18px;font-size:15px;border-radius:10px;border:0;background:#C8102E;color:#fff">Reintentar / Retry</button></div>';
    const rb = document.getElementById('retry'); if (rb) rb.onclick = () => location.reload(); console.error(e);
  }
})();
