/* fight-owner-labels (2026-10-19, owner): every challenge / accept / confirm / sand intro says whose pet is whose.
 * 'YOUR PET' (green, like the breed picker's My Pets badge) vs 'OPPONENT'; viewer owns neither: both owners' short addresses; owns both: both YOUR PET.
 * Viewer = connected wallet or ?addr= (V2UI.ME). Display only. */
(function () {
  function me() { return (window.V2UI && V2UI.ME) || ''; }
  function sh(a, n) { a = String(a || ''); return a.length > 12 ? a.slice(0, n || 6) + '…' + a.slice(-4) : a || '?'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** kind(p, o): 'me' | 'opp' | 'addr' */
  function kind(p, o) { var M = me(); if (!p) return 'addr'; if (M && p.owner === M) return 'me'; if (M && o && o.owner === M) return 'opp'; return 'addr'; }
  function html(p, o) { if (!p) return ''; var k = kind(p, o), n = esc(p.name || '#' + p.id);
    return k === 'me' ? '<em class="ftag me">YOUR PET · ' + n + '</em>' : k === 'opp' ? '<em class="ftag">OPPONENT · ' + n + '</em>' : '<em class="ftag" title="' + esc(p.owner) + '">' + esc(sh(p.owner)) + ' · ' + n + '</em>'; }
  function text(p, o) { var k = kind(p, o); return k === 'me' ? 'YOUR PET' : k === 'opp' ? 'OPPONENT' : sh(p && p.owner, 4); }
  /** canvas(x, a, o, cx, y): small tag above a sprite on the sand */
  function canvas(x, p, o, cx, y) { if (!x || !p) return; var k = kind(p, o), s = text(p, o); x.save(); x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center';
    var w = Math.ceil(x.measureText(s).width) + 6; x.fillStyle = '#000'; x.fillRect(cx - w / 2 - 1, y - 8, w + 2, 10); x.fillStyle = k === 'me' ? '#4fd18b' : '#4b3f7a'; x.fillRect(cx - w / 2, y - 7, w, 8);
    x.fillStyle = k === 'me' ? '#0d1a12' : '#fff'; x.fillText(s, cx, y); x.restore(); }
  if (!document.getElementById('ftagCss')) { var st = document.createElement('style'); st.id = 'ftagCss';
    st.textContent = '.ftag{display:inline-block;font-style:normal;font-weight:700;font-size:11px;letter-spacing:.5px;line-height:1.25;padding:2px 5px;border:1px solid #000;background:#4b3f7a;color:#fff;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:0 0 3px}.ftag.me{background:#4fd18b;color:#0d1a12}.fme{border-color:#4fd18b!important;box-shadow:0 0 0 2px #4fd18b}.ftsum{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}';
    document.head.appendChild(st); }
  window.V2FightTag = { kind: kind, html: html, text: text, canvas: canvas, mine: function (p) { return kind(p) === 'me'; } };
})();
