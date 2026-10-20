/* XCPETS promo page: everything is rendered client-side by pet-core.js (no network calls). */
(function () {
  'use strict';
  // Fixed reference block (970,568) used for the gallery.
  var GALLERY_HASH = '00000000000000000001d62038106eb14d0843d95b5f19a878cb3a144eec8c27';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  // --------------------------------------------------------------- animation
  var animated = [];
  setInterval(function () {
    for (var i = 0; i < animated.length; i++) { var a = animated[i]; a.f = (a.f + 1) % a.frames.length; paint(a.ctx, a.frames[a.f]); }
  }, 280);
  function paint(ctx, img) { ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); }
  function canvas32(label) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'pixel'; if (label) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); } return c; }
  function show(canvas, pet, stage) {
    var frames = PetCore.renderFrames(pet, { stage: stage }), ctx = canvas.getContext('2d');
    paint(ctx, frames[0]);
    for (var i = 0; i < animated.length; i++) if (animated[i].canvas === canvas) { animated.splice(i, 1); break; }
    animated.push({ canvas: canvas, ctx: ctx, frames: frames, f: 0 });
  }
  function card(pet, stage, title, meta) {
    var d = document.createElement('div'); d.className = 'card';
    var c = canvas32(title + ', ' + PetCore.STAGES[stage]); d.appendChild(c);
    var t = PetCore.TIERS[pet.tierIndex];
    d.insertAdjacentHTML('beforeend', '<div class="t"><span>' + esc(title) + '</span><span class="pill tier tier-' + t.id + '">' + t.label + '</span></div><div class="m">' + meta + '</div>');
    show(c, pet, stage);
    return d;
  }

  // -------------------------------------------------------------------- hero
  (function hero() {
    var box = $('heroPets'), ids = PetCore.SPECIES.map(function (s) { return s.id; }), slots = [], k = 0;
    for (var i = 0; i < 9; i++) { var c = canvas32(); box.appendChild(c); slots.push(c); }
    function fill() {
      slots.forEach(function (c, i) {
        var id = ids[(k + i) % ids.length], sp = PetCore.SPECIES[(k + i) % ids.length];
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', sp.label + ' at Mythic');
        show(c, PetCore.characterPet(id, { tier: 'legendary' }), 5);
      });
      k = (k + 9) % ids.length;
    }
    fill(); setInterval(fill, 4200);
  })();

  // ----------------------------------------------------------------- gallery + cast: LIVE hatch rules (ux-batch 2026-10-16)
  // Species/tier legality and odds come from V2Rules (tier unlock from 971,669, Nakamoto 1 in 777 always Legendary, Legendary boost), sprites from
  // the live generator (GenPetCore) with no gear: a fresh hatch wears nothing until it rolls gear. Falls back to the old promo rules without V2Rules.
  var V = window.V2Rules, G = window.GenPetCore || PetCore, LIVE = !!(V && V.hatchArt && V.tierPool && G.renderFrames);
  var NOGEAR = { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none' };
  function liveTip() { try { return (window.V2Mock && V2Mock.state().tip) || null; } catch (e) { return null; } }
  function oddsBlock() { var t = liveTip(), lb = V && V.ACTIVATE_LEG_BOOST_BLOCK; return lb && (t == null || t < lb) ? lb : (t || lb); } // show the post-boost numbers (as pets.html)
  function showLive(canvas, pet, stage) { var frames = G.renderFrames(Object.assign({}, pet, NOGEAR), { stage: stage }), ctx = canvas.getContext('2d'); paint(ctx, frames[0]);
    for (var i = 0; i < animated.length; i++) if (animated[i].canvas === canvas) { animated.splice(i, 1); break; } animated.push({ canvas: canvas, ctx: ctx, frames: frames, f: 0 }); }
  var batch = 0;
  function renderGallery() {
    var box = $('galleryCards'), want = { common: 2, uncommon: 2, rare: 2, legendary: 2 }, found = [], b = oddsBlock();
    box.innerHTML = ''; animated = animated.filter(function (a) { return document.body.contains(a.canvas); });
    for (var n = 0; n < 20000 && found.length < 8; n++) {
      var id = (batch ? 'promo-' + batch + '-' : 'gallery-') + n, p = LIVE ? V.hatchArt(GALLERY_HASH, id, b) : PetCore.generate({ blockHash: GALLERY_HASH, petId: id });
      if (want[p.tier] > 0) { want[p.tier]--; found.push(p); }
    }
    found.sort(function (a, b) { return a.tierIndex - b.tierIndex; });
    found.forEach(function (p, i) {
      var stage = [1, 3, 2, 3, 4, 3, 5, 4][i];
      if (!LIVE) { var d = PetCore.describe(p, stage); box.appendChild(card(p, stage, p.defaultName, PetCore.STAGES[stage] + ' · ' + esc(d.Species) + ' · ' + esc(d.Expression) + '<br>Gear: ' + esc(d.Gear))); return; }
      var dl = G.describe(p, stage), t = G.TIERS[p.tierIndex], el = document.createElement('div'); el.className = 'card';
      var c = canvas32(p.defaultName + ', ' + G.STAGES[stage]); el.appendChild(c);
      el.insertAdjacentHTML('beforeend', '<div class="t"><span>' + esc(p.defaultName) + '</span><span class="pill tier tier-' + t.id + '">' + t.label + '</span></div><div class="m">' + G.STAGES[stage] + ' · ' + esc(V.speciesLabel(p.species)) + ' · ' + esc(dl.Expression || '') + '<br>Pattern: ' + esc(dl.Pattern || '') + ' · Eyes: ' + esc(dl.Eyes || '') + '</div><div class="small muted">example, not a real pet</div>');
      showLive(c, p, stage); box.appendChild(el);
    });
  }
  $('reroll').onclick = function () { batch++; renderGallery(); };

  // -------------------------------------------------------------------- cast
  function liveOdds() { var b = oddsBlock(), k = 776 / 777, out = {}; PetCore.TIERS.forEach(function (t, ti) { var P = V.tierPool(ti, b), tot = P.reduce(function (a, s) { return a + s.w; }, 0);
    P.forEach(function (s) { out[s.id] = (out[s.id] || 0) + t.chance / 10000 * k * s.w / tot; }); }); out.nakamoto = 1 / 777; return out; }
  function speciesOdds() {
    if (LIVE) return liveOdds();
    var odds = {};
    PetCore.TIERS.forEach(function (t, ti) {
      var tot = 0, wt = function (s) { return s.t > ti ? 0 : s.tw ? s.tw[ti] : s.w * (s.t === ti ? 4 : 1); };
      PetCore.SPECIES.forEach(function (s) { tot += wt(s); });
      PetCore.SPECIES.forEach(function (s) { odds[s.id] = (odds[s.id] || 0) + t.chance / 10000 * wt(s) / tot; });
    });
    return odds;
  }
  function pct(x) { return x * 100 >= 1 ? (x * 100).toFixed(1) + '%' : (x * 100).toFixed(2) + '%'; }
  function renderCast(tierId) {
    var odds = speciesOdds(), box = $('castRows'), ti = PetCore.TIERS.map(function (t) { return t.id; }).indexOf(tierId); box.innerHTML = ''; animated = animated.filter(function (a) { return document.body.contains(a.canvas); });
    var list = LIVE ? G.SPECIES.filter(function (sp) { return V.minTierOf(sp.id) <= ti && (sp.id !== 'nakamoto' || ti === 3); }) : PetCore.SPECIES;
    list.forEach(function (sp) {
      var row = document.createElement('div'); row.className = 'cast-row'; row.setAttribute('data-sp', sp.id);
      if (LIVE) { var mt = V.minTierOf(sp.id), lowest = G.TIERS[mt].label;
        var line = sp.id === 'nakamoto' ? 'Always Legendary · no longer hatched, existing ones kept (the 1 in 777 egg is now a Bitcoin Wizard egg)' : (mt === 3 ? 'Legendary only' : 'Hatches at ' + lowest + (mt < 3 ? ' and rarer' : '')) + ' · about ' + pct(odds[sp.id] || 0) + ' of hatches';
        row.innerHTML = '<div><h3 class="ch">' + esc(sp.label) + '</h3><p class="muted">' + line + '</p><p class="muted">' + sp.arc.map(function (a) { return esc(a[0]); }).join(' → ') + '</p></div>';
      } else row.innerHTML = '<div><h3 class="ch">' + esc(sp.label) + '</h3><p class="muted">' + (sp.tw ? 'Found in every tier' : 'Most common in the ' + PetCore.TIERS[sp.t].label + ' tier') + ' · about ' + (odds[sp.id] * 100).toFixed(1) +
        '% of hatches</p><p class="muted">' + sp.arc.map(function (a) { return esc(a[0]); }).join(' → ') + '</p></div>';
      var pet = (LIVE ? G : PetCore).characterPet(sp.id, { tier: tierId });
      var strip = document.createElement('div'); strip.className = 'strip6';
      PetCore.STAGES.forEach(function (name, si) {
        var d = document.createElement('div'), c = canvas32(sp.label + ', ' + name);
        paint(c.getContext('2d'), LIVE ? G.render(Object.assign({}, pet, NOGEAR), { stage: si }) : PetCore.render(pet, { stage: si }));
        d.appendChild(c); d.appendChild(document.createTextNode(name)); strip.appendChild(d);
      });
      row.appendChild(strip); box.appendChild(row);
    });
    if (LIVE) box.insertAdjacentHTML('beforeend', '<p class="muted small">Only species that can hatch at this tier are shown. Odds per egg, as on the <a href="pets.html#odds">Pet Guide</a>. Fresh hatches wear no gear.</p>');
    castOn(tierId);
    window.PromoLiveCast = LIVE;
  }
  /* Home cast row (homepage-cast, 2026-10-19): one fixed-size card per entry, Common .. Legendary, Mythic, then ONE Hybrids link card.
   * Only buttons with data-tier toggle; the Hybrids card is a plain link to hybrids.html (hybrids are never listed inline here). */
  function castOn(id) { Array.prototype.forEach.call($('castTiers').children, function (b) { if (b.getAttribute('data-tier')) b.classList.toggle('on', b.getAttribute('data-tier') === id); }); }
  function castCard(label, sub) { var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span class="ct-l">' + esc(label) + '</span><span class="ct-s">' + esc(sub) + '</span>'; return b; }
  // Mythic tab: every species at Mythic, the sixth and last stage (a stage, not a hatch tier), at Legendary with no gear, in a wrapping grid
  function renderMythic() {
    var box = $('castRows'); box.innerHTML = ''; animated = animated.filter(function (a) { return document.body.contains(a.canvas); });
    var list = LIVE ? G.SPECIES : PetCore.SPECIES, grid = document.createElement('div'); grid.className = 'mythgrid';
    list.forEach(function (sp) { var d = document.createElement('div'); d.className = 'mythcard'; d.setAttribute('data-sp', sp.id);
      var c = canvas32(sp.label + ', Mythic'), pet = (LIVE ? G : PetCore).characterPet(sp.id, { tier: 'legendary' }); d.appendChild(c);
      d.insertAdjacentHTML('beforeend', '<h3 class="ch">' + esc(sp.label) + '</h3><span class="muted small">' + esc(sp.arc && sp.arc.length ? sp.arc[sp.arc.length - 1][0] : 'Mythic') + '</span>');
      if (LIVE) showLive(c, pet, 5); else show(c, pet, 5); grid.appendChild(d); });
    box.appendChild(grid);
    box.insertAdjacentHTML('beforeend', '<p class="muted small">Mythic is the last of the six stages. Every pet that keeps eating grows into it, whatever its tier. Shown at Legendary with no gear.</p>');
    castOn('mythic');
  }
  PetCore.TIERS.forEach(function (t) {
    var b = castCard(t.label, (t.chance / 100) + '% of eggs'); b.setAttribute('data-tier', t.id);
    b.onclick = function () { renderCast(t.id); };
    $('castTiers').appendChild(b);
  });
  (function () { var b = castCard('Mythic', 'final stage'); b.setAttribute('data-tier', 'mythic'); b.onclick = renderMythic; $('castTiers').appendChild(b);
    // ONE fixed-size Hybrids card; js/v2-pages.js fills the count (and a sample sprite) from chain state once the burns are replayed
    var a = document.createElement('a'); a.className = 'hybcard'; a.id = 'castHybCard'; a.href = 'hybrids.html';
    a.innerHTML = '<span class="ct-l"><canvas class="ct-ico" id="castHybIco" width="32" height="32" aria-hidden="true"></canvas>Hybrids</span><span class="ct-s" id="castHybCount">see all →</span>';
    a.setAttribute('aria-label', 'Hybrids: browse every hybrid'); $('castTiers').appendChild(a); })();
  renderCast('legendary');
  renderGallery();
  document.body.setAttribute('data-ready', 'yes');
})();
