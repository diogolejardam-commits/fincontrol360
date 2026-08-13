/* FinControl 360° — registro/atualização do Service Worker (PWA only) */
(function () {
  'use strict';
  var FC_PWA_VERSION = 'fincontrol360-pwa-v7';
  var SEEN_KEY = 'fc_pwa_seen_version';
  var PENDING_KEY = 'fc_pwa_update_pending';
  var RELOAD_KEY = 'fc_pwa_update_reloaded';
  var updatePending = false;

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e1) {}
    try {
      if (typeof navigator.standalone === 'boolean' && navigator.standalone) return true;
    } catch (e2) {}
    return false;
  }

  function showUpdatedToastOnce() {
    try {
      var seen = localStorage.getItem(SEEN_KEY) || '';
      if (seen === FC_PWA_VERSION) return;
      localStorage.setItem(SEEN_KEY, FC_PWA_VERSION);
    } catch (e) {
      // Sem persistência não é possível garantir "uma vez por versão".
      return;
    }
    if (document.getElementById('fc-pwa-updated-toast')) return;
    var el = document.createElement('div');
    el.id = 'fc-pwa-updated-toast';
    el.setAttribute('role', 'status');
    el.textContent = 'FinControl 360° atualizado';
    el.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:18px', 'transform:translateX(-50%)',
      'z-index:99999', 'background:#122038', 'color:#e8eef8',
      'border:1px solid rgba(132,223,66,.45)', 'border-radius:999px',
      'padding:10px 16px', 'font:600 13px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,.35)', 'pointer-events:none', 'opacity:0',
      'transition:opacity .25s ease'
    ].join(';');
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3200);
  }

  function markRealUpdate() {
    updatePending = true;
    try { sessionStorage.setItem(PENDING_KEY, FC_PWA_VERSION); } catch (e) {}
  }

  function hasRealUpdatePending() {
    if (updatePending) return true;
    try {
      return sessionStorage.getItem(PENDING_KEY) === FC_PWA_VERSION;
    } catch (e) {
      return false;
    }
  }

  function onControllerChangeOnce() {
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      // clients.claim também dispara na instalação inicial; só recarrega
      // quando updatefound confirmou que já existia um controlador anterior.
      if (!hasRealUpdatePending()) return;
      reloaded = true;
      try {
        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.setItem(RELOAD_KEY, FC_PWA_VERSION);
      } catch (e) {}
      window.location.reload();
    });
  }

  function trackWaiting(reg) {
    if (!reg) return;
    function promote(worker, isRealUpdate) {
      if (!worker) return;
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        if (isRealUpdate) markRealUpdate();
        worker.postMessage({ type: 'FC_PWA_SKIP_WAITING' });
      }
    }
    if (reg.waiting) promote(reg.waiting, !!navigator.serviceWorker.controller);
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      // Capturado antes da ativação: na primeira instalação ainda não há
      // controlador; em atualização real a versão anterior controla a página.
      var isRealUpdate = !!navigator.serviceWorker.controller;
      if (isRealUpdate) markRealUpdate();
      nw.addEventListener('statechange', function () {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          promote(nw, isRealUpdate);
        }
      });
    });
  }

  window.FC_PWA = {
    version: FC_PWA_VERSION,
    isStandalone: isStandalone,
    showUpdatedToastOnce: showUpdatedToastOnce
  };

  if (!('serviceWorker' in navigator)) return;

  // Toast somente após o reload causado por uma atualização real.
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === FC_PWA_VERSION) {
      sessionStorage.removeItem(RELOAD_KEY);
      showUpdatedToastOnce();
    }
  } catch (e3) {}

  onControllerChangeOnce();

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      trackWaiting(reg);
      try { reg.update(); } catch (e4) {}
      // recheck periódico leve (só enquanto a página PWA estiver aberta)
      setInterval(function () {
        try { reg.update(); } catch (e5) {}
      }, 60 * 60 * 1000);
    }).catch(function () {});
  });
})();
