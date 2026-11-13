/* PRACTICE BAR (practice-fun-1102): pretend balance + day, Grow a day / Next day / Refill / Start over, and the "Play for real" nudges. */
(function () {
  'use strict';
  var XP = window.XcpPractice; if (!XP) return;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function paint() { var s = XP.state(); if ($('pxDay')) $('pxDay').textContent = s.day; if ($('pxBal')) $('pxBal').textContent = fmt(s.bal);
    var st = $('pxStats'); if (st) st.textContent = s.stats.hatched ? 'This practice run: ' + fmt(s.stats.hatched) + ' egg' + (s.stats.hatched === 1 ? '' : 's') + ' hatched, ' + s.stats.legendary + ' Legendary, ' + s.stats.wow + ' with a showy trait.' : 'Crack your first practice egg: it is always a Legendary.'; }
  function msg(t) { var m = $('pxMsg'); if (m) m.textContent = t || ''; }
  function reread() { try { window.dispatchEvent(new Event('xcpets:practice-refresh')); } catch (e) {} setTimeout(paint, 50); }
  function busy(b, on) { if (b) b.disabled = on; }
  function later(fn) { setTimeout(fn, 30); }
  if ($('pxGrow')) $('pxGrow').onclick = function () { var b = this; busy(b, true); msg('Feeding your practice pets…'); later(function () { var n = 0; try { n = XP.growDay(); } catch (e) { msg(String(e.message || e)); } busy(b, false); msg(n ? '🍽️ Fed ' + n + ' pet' + (n === 1 ? '' : 's') + ', then skipped to the next day. Keep going: pets turn Mythic after about 9 days.' : '⏭️ Next day. Hatch a pet first, then Grow a day to watch it grow up.'); reread(); }); };
  if ($('pxDayBtn')) $('pxDayBtn').onclick = function () { XP.nextDay(); msg('⏭️ Skipped 144 pretend blocks: a new chain day. Your pets are hungry again.'); reread(); };
  if ($('pxRefill')) $('pxRefill').onclick = function () { XP.refill(); msg('💰 Pretend balance refilled to ' + fmt(XP.START_BAL) + '.'); reread(); };
  if ($('pxReset')) $('pxReset').onclick = function () { if (!confirm('Reset the practice pet? Only the practice pet in this browser is cleared. Real pets are not touched.')) return; try { window.__xcpPracticeStore.wipe(); } catch (e) {} XP._forget(); location.reload(); };
  /* hatch reveal: a small PRACTICE tag while the real reveal plays, and a nudge to the real game after it */
  var tag = null, seen = false;
  function watch() { var on = [].some.call(document.querySelectorAll('#animBox, #packBox.on'), function (el) { var cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; }) || !!(window.V2LifeAnim && V2LifeAnim.busy && V2LifeAnim.busy());
    if (on && !tag) { tag = document.createElement('div'); tag.className = 'px-reveal-tag'; tag.textContent = 'PRACTICE · not a real pet'; document.body.appendChild(tag); seen = true; }
    if (!on && tag) { tag.remove(); tag = null; var c = $('pxCta'); if (c && seen) { c.classList.remove('px-pop'); void c.offsetWidth; c.classList.add('px-pop'); } } }
  setInterval(watch, 400);
  /* practice burns land in a block right away, so never hold the reveal back as a 'while you were away' replay */
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest && e.target.closest('#cfYes, .confirm .btn, #hatchBtn, #packBtn, #boxBtn'); if (t) document.documentElement.classList.remove('ip-hold'); }, true);
  /* real-game wording that does not fit practice: 'waiting for the next block', mempool links. Practice burns are mined at once. */
  var WAIT = /mempool|next block|when (this|it) confirms|once confirmed|~10 min|Broadcast/i;
  function tidyToasts() { var box = $('toasts'); if (!box) return; [].slice.call(box.children).forEach( function (t) { if (!t.__px && WAIT.test(t.textContent || '')) { if (box.querySelector('.px-done')) { t.remove(); return; } t.__px = 1; t.classList.add('px-done'); t.innerHTML = '✨ Practice burn done right away in a pretend block. Nothing went on chain.'; } }); }
  function tidyPgt() { var g = $('pgt'); if (g && !g.__pxBusy && WAIT.test(g.textContent || '')) { g.__pxBusy = 1; g.textContent = String(g.textContent).replace(/ ?They appear here once confirmed in a block\.?/, ' Done in a pretend block, no waiting.').replace(/\s*·\s*tx [0-9a-f]{6,}…/i, ''); g.__pxBusy = 0; } }
  /* real-wallet only buttons (tokenize, gift, sell, post to X): not part of practice */
  var REAL_ONLY = /^(🎟 ?Tokenize|🎁 ?Gift|𝕏 ?Post|🎞️ ?Save GIF|🏷️ ?Sell|💸 ?Sell|Sell\b|List for sale|Make an offer)/;
  function tidyReal() { [].forEach.call(document.querySelectorAll('main button:not([data-px]), main a.btn:not([data-px]), #petOverlay button:not([data-px])'), function (b) { b.setAttribute('data-px', '1'); if (REAL_ONLY.test((b.textContent || '').trim())) { b.hidden = true; b.style.display = 'none'; } }); }
  function tidyFee() { var f = $('cfFee'); if (f && /^network fee/.test(f.textContent || '')) f.textContent = 'No network fee: practice burns are free and pretend.'; }
  function tidyConfirm() { var y = $('cfYes'); if (!y) return; if (/Sign & burn|Confirm breed · sign/i.test(y.textContent || '')) y.textContent = 'Pretend burn, free'; }
  function tidyCoach() { [].forEach.call(document.querySelectorAll('.tut-tip, .tut-card'), function (t) { var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), n; while ((n = w.nextNode())) { if (/wallet asks you to sign/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Your wallet asks you to sign\.?/i, 'This hatch is pretend. Nothing is signed.'); } }); }
  /* the picture itself says PRACTICE, so a screenshot of the pet cannot pass as a real one */
  var SHOT = '#pets canvas.sprite, #mpsBox canvas.sprite, .pc-art > canvas, #dCanvas, .bgrid .pet.card > canvas, .fpc > canvas, #packBox .packgrid canvas';
  function veil() { [].forEach.call(document.querySelectorAll(SHOT), function (c) { if (!c || c.closest('.px-shot')) return; var w = document.createElement('span'); w.className = 'px-shot'; c.parentNode.insertBefore(w, c); w.appendChild(c); }); }
  function stampShare() { var S = window.XCPShare; if (!S || S.__pxStamp || typeof S.cardCanvas !== 'function') return; var orig = S.cardCanvas;
    S.cardCanvas = function (p) { var c = orig(p); try { var g = c.getContext('2d'), W = c.width; g.save(); g.translate(W / 2, c.height * 0.42); g.rotate(-0.3); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = "72px 'Press Start 2P', monospace"; g.lineWidth = 16; g.strokeStyle = '#1a1200'; g.fillStyle = '#ffd23f'; g.strokeText('PRACTICE', 0, 0); g.fillText('PRACTICE', 0, 0); g.font = "28px 'Press Start 2P', monospace"; g.strokeText('NOT A REAL PET', 0, 96); g.fillText('NOT A REAL PET', 0, 96); g.restore(); } catch (e) {} return c; };
    S.__pxStamp = 1; }
  try { new MutationObserver(function () { tidyToasts(); tidyPgt(); tidyFee(); tidyConfirm(); tidyCoach(); tidyReal(); veil(); stampShare(); }).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
  veil(); stampShare();
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('a[href*="mempool.space"], a[href*="xcp.io"], a[href*="horizon.market"]'); if (a) { e.preventDefault(); e.stopPropagation(); msg('That link opens a real chain page. Practice burns never leave this browser.'); } }, true);
  /* stay inside practice: the pet page and the game places (arena, Rare Room, breeding motel) have practice copies */
  var MAP = { 'pet.html': 'practice-pet.html', 'play.html': 'practice.html', 'fight.html': 'practice-fight.html', 'breed.html': 'practice-breed.html', 'rare-room.html': 'practice-rare.html' };
  function mapUrl(href) { var u; try { u = new URL(href, location.href); } catch (e) { return null; } if (u.origin !== location.origin) return null;
    var f = u.pathname.split('/').pop(), to = MAP[f]; if (!to) return null; var hash = u.hash; return to + u.search.replace(/([?&])addr=[^&]*&?/, '$1').replace(/[?&]$/, '') + hash; }
  function savePetRet(id) { try { sessionStorage.setItem('xcpets-v2-petret', JSON.stringify({ y: Math.round(window.scrollY), id: id, at: Date.now(), path: location.pathname + location.search })); } catch (x) {} }
  document.addEventListener('click', function (e) { if (e.defaultPrevented) return; var t = e.target; if (!t || !t.closest) return;
    var a = t.closest('a[href]'); if (a && !a.classList.contains('px-real') && !a.hasAttribute('data-real')) { var to = mapUrl(a.getAttribute('href')); if (to) { e.preventDefault(); e.stopPropagation(); if (e.ctrlKey || e.metaKey || a.target === '_blank') window.open(to, '_blank'); else location.href = to; } return; }
    var card = t.closest('#pets .pet.card[data-pid]'); if (card && !a && !(e.shiftKey || document.body.classList.contains('selmode')) && (t.closest('.openbtn') || !t.closest('button, input, label, select,xc-select, .keepbtn, .pet-discard'))) { var id = card.dataset.pid; e.preventDefault(); e.stopPropagation(); savePetRet(+id); var u = 'practice-pet.html?id=' + id; if (e.ctrlKey || e.metaKey) window.open(u, '_blank'); else location.href = u; } }, true);
  /* anything else that sets location to a real page we have a practice copy of (Navigation API where the browser has it) */
  try { if (window.navigation && navigation.addEventListener) navigation.addEventListener('navigate', function (e) { if (!e.cancelable || e.hashChange || e.downloadRequest) return; var to = mapUrl(e.destination.url); if (to) { e.preventDefault(); location.href = to; } }); } catch (e) {}
  /* the pet page has no live re-render: after a practice burn there, read it again */
  if (document.body.getAttribute('data-v2page') === 'pet') window.addEventListener('xcpets:practice', function () { setTimeout(function () { location.reload(); }, 600); });
  window.addEventListener('xcpets:practice', paint);
  setInterval(paint, 2000); paint();
})();
