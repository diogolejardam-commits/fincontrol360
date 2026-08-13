/* FinControl 360° — registro/atualização do Service Worker (PWA only) */
(function () {
  'use strict';
  var FC_PWA_VERSION = 'fincontrol360-pwa-v9';
  var SEEN_KEY = 'fc_pwa_seen_version';

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
      // se storage bloqueado, não insiste
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

  function onControllerChangeOnce() {
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      try { sessionStorage.setItem('fc_pwa_reload_once', '1'); } catch (e) {}
      // Evita loop: só reload se ainda não recarregamos nesta ativação
      try {
        if (sessionStorage.getItem('fc_pwa_reloading') === '1') return;
        sessionStorage.setItem('fc_pwa_reloading', '1');
      } catch (e2) {}
      window.location.reload();
    });
  }

  function trackWaiting(reg) {
    if (!reg) return;
    function promote(worker) {
      if (!worker) return;
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'FC_PWA_SKIP_WAITING' });
      }
    }
    if (reg.waiting) promote(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          promote(nw);
        } else if (nw.state === 'activated') {
          showUpdatedToastOnce();
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

  // Limpa flag de reload após carga estável
  try {
    if (sessionStorage.getItem('fc_pwa_reloading') === '1') {
      sessionStorage.removeItem('fc_pwa_reloading');
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
