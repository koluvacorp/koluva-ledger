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
      L.render(); await L.setup(); L.render(); if (!s.settings.tourDone) await L.tour();
    } else {
      if (r.recovered) L.toast(L.t('recovered'));
      const made = C.applyDueRecurring(s); C.snapshotWorth(s); if (made) { S.touch(); L.toast(L.t('auto_created', { n: made })); }
      L.render(); L.lock(); await L.opening(); if (!s.settings.tourDone && s.accounts.length === 0) await L.tour();
    }
    L.schedule(); L.checkUpdateSoon();
    setInterval(() => { const m = C.applyDueRecurring(S.state); if (m) { S.touch(); L.render(); } }, 6 * 36e5);
  } catch (e) {
    document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">Koluva Ledger: no se pudo iniciar / could not start.</p>'; console.error(e);
  }
})();
