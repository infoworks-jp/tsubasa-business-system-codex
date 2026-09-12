(function () {
  "use strict";

  window.TSUBASA_CONFIG = Object.freeze({
    supabaseUrl: "https://spyopczqtxypqjbhylzf.supabase.co",
    publishableKey: "sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg",
    schema: "rev2",
    publicUrl: "https://infoworks-jp.github.io/tsubasa-business-system-codex/"
  });

  function addExtraNav() {
    const nav = document.querySelector('header nav');
    if (!nav) return;
    if (!document.getElementById('historyNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'historyNavBtn';
      btn.textContent = '長期実績';
      btn.onclick = function () { location.href = './history.html'; };
      nav.appendChild(btn);
    }
    if (!document.getElementById('consultHistoryNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'consultHistoryNavBtn';
      btn.textContent = '長期コンサル分析';
      btn.onclick = function () { location.href = './consulting-history.html'; };
      nav.appendChild(btn);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addExtraNav);
  else addExtraNav();
})();
