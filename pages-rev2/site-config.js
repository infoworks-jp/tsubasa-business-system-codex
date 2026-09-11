(function () {
  "use strict";

  window.TSUBASA_CONFIG = Object.freeze({
    supabaseUrl: "https://spyopczqtxypqjbhylzf.supabase.co",
    publishableKey: "sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg",
    schema: "rev2",
    publicUrl: "https://infoworks-jp.github.io/tsubasa-business-system-codex/"
  });

  function addHistoryNav() {
    const nav = document.querySelector('header nav');
    if (!nav || document.getElementById('historyNavBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'historyNavBtn';
    btn.textContent = '長期実績';
    btn.onclick = function () { location.href = './history.html'; };
    nav.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHistoryNav);
  else addHistoryNav();
})();
