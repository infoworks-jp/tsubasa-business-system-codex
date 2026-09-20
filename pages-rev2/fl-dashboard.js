// Compatibility entry point for the Pages deployment's F/L dashboard script.
// Monthly calculations now live exclusively in fl-trends.js. Do not restore
// the former sum-of-bank-payments F or gross-pay-plus-remittance L calculation.
(function () {
  'use strict';
  const labels = Object.freeze({
    title: 'F/L・FLR 経営指標',
    fl: '累計 F/L比率',
    flr: '累計 FLR比率',
    monthlyFlr: 'FLR率'
  });
  window.__TSUBASA_FL_DIRECT__ = '20260920-source-aware-unified';
  window.TSUBASA_FL_LABELS = labels;
  window.openTsubasaFL = function () {
    if (window.TsubasaFL && typeof window.showTab === 'function') {
      return window.showTab('flTrends');
    }
    const host = document.getElementById('host');
    if (host) {
      const note = document.createElement('div');
      note.className = 'notice';
      note.textContent = '給与・FLの画面を読み込み中です。未集計は0円・0%ではありません。';
      host.prepend(note);
    }
  };
  // site-config.js loads the shared module. Its overview/top summary and
  // FL・改善推移 tab replace this entry point's separate charts. Retaining a
  // second renderer would display incompatible F/L figures on the same page.
})();
