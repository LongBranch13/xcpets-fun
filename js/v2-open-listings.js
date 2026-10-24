/* shop-safety (owner 5:22 AM CT Oct 24, 2026): "You have N open listings" banner in My Pets (play.html #petsPanel) for the connected wallet.
 * Each line: pet, amount + coin, expiry; Cancel goes to the shop's existing cancel action (shop.html#sell). Display only: reads the replayed
 * world (V2Mock.world().listings), never signs, no rule change. */
(function () {
  var V = window.V2Rules; if (!V || !V.openListings) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var last = null;
  function tick() { var M = window.V2Mock, panel = document.getElementById('petsPanel'); if (!M || !panel || !M.world) return;
    var me = M.ME, w, tip; try { w = M.world(); tip = (M.state && M.state().tip) || w.tip; } catch (e) { return; }
    var L = me && w && tip && V.salesOn && V.salesOn(tip + 1) ? V.openListings(w, tip + 1).filter(function (S) { return S.seller === me; }) : [];
    var key = me + '|' + tip + '|' + L.map(function (S) { return S.n; }).join(','); if (key === last) return; last = key;
    var el = document.getElementById('myOpenListings');
    if (!L.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'myOpenListings'; el.className = 'sh-openbar';
      el.style.cssText = 'background:#2B2730;border:2px solid #ffd166;padding:8px 10px;margin:8px 0;font-size:13px';
      var h = panel.querySelector('h2'); if (h && h.nextSibling) panel.insertBefore(el, h.nextSibling); else panel.appendChild(el); }
    el.innerHTML = '<b>📋 You have ' + L.length + ' open listing' + (L.length === 1 ? '' : 's') + '</b><ul style="margin:6px 0 0;padding-left:18px">' + L.map(function (S) { var p = (w.byId || {})[S.petId] || {};
      return '<li style="margin:4px 0"><a href="pet.html?id=' + S.petId + '">#' + S.petId + ' ' + esc(p.name || '') + '</a> for <b style="color:#ffd166;white-space:nowrap">' + esc(V.saleAmountText(S.asset, S.price)) + '</b> · ends after block ' +
        Number(S.expire).toLocaleString('en-US') + ' (' + Math.max(0, S.expire - tip) + ' blocks left) <a class="btn ghost" href="shop.html#sell">Cancel in the shop</a></li>'; }).join('') + '</ul>'; }
  setInterval(tick, 3000); if (document.readyState !== 'loading') setTimeout(tick, 500); else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 500); });
  window.V2OpenListings = { tick: function () { last = null; tick(); } };
})();
