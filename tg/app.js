/* XCPETS mini app for Telegram (tg/index.html), Nov 23 2026. Plan doc upgrade 5: "A HatchBot mini app where players see their pets
 * and the live feed, and tap to open their own wallet to sign."
 * VIEW ONLY. It reads public files: the published world (node.xcpets.fun/xp/v1/world: summary + this wallet's owner pages, the same
 * files the site's fast load uses) and the Counterparty read API (newest XCPETS burns, mempool, balance). It never signs, never
 * burns, never asks for keys, and never changes a game rule. Every action opens xcpets.fun in the player's browser / wallet app.
 * Pet art: js/pet-core.js + js/v2-art.js (the same seed -> pixels code the site uses), loaded after the first paint. Gear and hybrid
 * parts are drawn by the full site only, so hybrids show their species icon here. Works in a normal browser too (no Telegram needed). */
(function () {
  'use strict';
  var W = window, D = document;
  var TGW = W.Telegram && W.Telegram.WebApp, TG = TGW && TGW.platform && TGW.platform !== 'unknown' ? TGW : null;
  var NODE = 'https://node.xcpets.fun', READS = [NODE + '/v2', 'https://api.counterparty.io:4000/v2'];
  var SITE = /(^|\.)xcpets\.fun$/.test(location.hostname) ? location.origin + '/' : new URL('../', location.href).href;
  var ASSET = 'XCPETS', UNIT = 1e8, DAY = 144;
  var TIER = ['Common', 'Uncommon', 'Rare', 'Legendary'], STAGE = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var CM_T = [0, 69000, 834900, 2214900, 4146900, 6906900]; /* community pet thresholds (V2Rules.COMMUNITY_THRESHOLDS) */
  var BOSS = { burnschild: 'Baron Von Burnschild', moloch: 'Moloch', nightking: 'Night King', kekdragon: 'Dragonkek', harvester: 'Grim Reaper', frogfather: 'Infernal Frogfather', mash: 'The Tower of Terrors', titan: 'Titan', colossus: 'The Grinning Colossus', bailiff: 'The Night Shift Grinner', pyramid: 'The All-Seeing Kek', necrofrog: 'Necrofrog the Undying', vader: 'Dark Pepe the Endless Coil', blockschild: 'Lord Blockschild' };
  var COMM = {}; /* species-registry (Nov 25 2026): every community pet's name + emoji from js/species-registry.js */
  if (window.XcpSpecies) XcpSpecies.community().forEach(function (s) { COMM[s.id] = [XcpSpecies.shortName(s.id), s.emoji]; });
  var SP_ICON = { pepe: 1, wojak: 1, chud: 1, bobo: 1, mumu: 1, snibby: 1, dodo: 1, kevin: 1, peepo: 1, sarutobi: 1, doge: 1, lenny: 1, kek: 1, wizard: 1 };
  var KEY = 'xcpets-tg-addr';

  var S = { tip: 0, sum: null, folder: null, addr: '', page: null, pets: [], nextPage: 1, pages: 0, hex: '', seen: {}, feedTimer: 0, artP: null };

  /* ---------------------------------------------------------------- small helpers */
  function $(id) { return D.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function amt(n) { n = Number(n) || 0; return n >= 100 ? fmt(n) : n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }
  function ago(blocks) { var m = Math.max(0, blocks) * 10; return m < 1 ? 'now' : m < 90 ? '~' + m + ' min' : m < 60 * 36 ? '~' + Math.round(m / 60) + ' h' : '~' + Math.round(m / 1440) + ' d'; }
  function haptic(kind) { try { if (!TG || !TG.HapticFeedback) return; if (kind === 'sel') TG.HapticFeedback.selectionChanged(); else if (kind === 'ok') TG.HapticFeedback.notificationOccurred('success'); else TG.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {} }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function getJson(url, ms) {
    var ctl = W.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 12000) : 0;
    return fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(t); if (r.status === 404) return null; if (!r.ok) throw new Error(url + ' ' + r.status); return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }
  /* The Counterparty read API: the game's own cache first, then the public Core node. */
  function read(path) {
    var i = 0;
    return (function next() { var b = READS[i++]; return getJson(b + path, 8000).then(function (j) { if (!j) throw new Error('empty'); return j; }, function (e) { if (i < READS.length) return next(); throw e; }); })();
  }
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    });
  }
  function validAddr(a) { return /^bc1[ac-hj-np-z02-9]{11,87}$/.test(a) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a); }
  function siteUrl(path) { return SITE + path; }
  /* Opens xcpets.fun outside Telegram (the player's browser or wallet app), where the wallet can sign. */
  function openSite(path) {
    var u = siteUrl(path); haptic('medium');
    try { if (TG && TG.openLink) { TG.openLink(u); return; } } catch (e) {}
    W.open(u, '_blank', 'noopener');
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} try { if (TG && TG.CloudStorage && TG.isVersionAtLeast && TG.isVersionAtLeast('6.9')) TG.CloudStorage.setItem(k, v, function () {}); } catch (e) {} }
  function recall(cb) {
    var v = ''; try { v = localStorage.getItem(KEY) || ''; } catch (e) {}
    if (v || !TG || !TG.CloudStorage || !TG.isVersionAtLeast || !TG.isVersionAtLeast('6.9')) return cb(v);
    try { TG.CloudStorage.getItem(KEY, function (err, val) { cb(!err && val ? val : ''); }); } catch (e) { cb(''); }
  }

  /* ---------------------------------------------------------------- Telegram chrome */
  function setupTelegram() {
    if (!TG) return;
    try { TG.ready(); TG.expand(); } catch (e) {}
    try { TG.setHeaderColor && TG.setHeaderColor('#0e0b16'); TG.setBackgroundColor && TG.setBackgroundColor('#0e0b16'); } catch (e) {}
    try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('7.7') && TG.disableVerticalSwipes) TG.disableVerticalSwipes(); } catch (e) {}
    try { if (TG.BackButton) TG.BackButton.onClick(function () { if (!$('sheet').hidden) closeSheet(); else tab('now'); }); } catch (e) {}
  }

  /* ---------------------------------------------------------------- tabs */
  function tab(name) {
    Array.prototype.forEach.call(D.querySelectorAll('.tabs button'), function (b) { var on = b.getAttribute('data-tab') === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    Array.prototype.forEach.call(D.querySelectorAll('.tab'), function (s) { s.classList.toggle('on', s.id === 'tab-' + name); });
    W.scrollTo(0, 0);
    backBtn();
  }
  function backBtn() {
    if (!TG || !TG.BackButton) return;
    var away = !$('sheet').hidden || !$('tab-now').classList.contains('on');
    try { away ? TG.BackButton.show() : TG.BackButton.hide(); } catch (e) {}
  }

  /* ---------------------------------------------------------------- the published world (same files as the site's fast load) */
  function world() {
    return getJson(NODE + '/xp/v1/world/latest.json', 10000).then(function (latest) {
      var path = latest && (latest.manifest || latest.url);
      if (!path) throw new Error('no published world');
      var man = /^https?:/.test(path) ? path : NODE + path;
      S.folder = man.replace(/[^/]+$/, '');
      return getJson(S.folder + 'view/summary.json', 15000);
    }).then(function (sum) { S.sum = sum; if (sum && sum.tip > S.tip) S.tip = sum.tip; return sum; });
  }
  function tipNow() {
    return read('/').then(function (j) { var r = j && j.result, b = r && (r.counterparty_height || (r.last_block && r.last_block.block_index)); if (b > S.tip) S.tip = b; return S.tip; }, function () { return S.tip; });
  }

  /* ---------------------------------------------------------------- NOW tab */
  function paintTip() { if (S.tip) $('tipChip').textContent = '⛓ ' + fmt(S.tip); }
  function paintDay() {
    var b = S.tip; if (!b) return;
    var day = Math.floor(b / DAY), into = b % DAY, left = DAY - into;
    $('dayCard').innerHTML = '<div class="row"><div><div class="sub" style="margin:0">Chain day</div><div class="big">Day ' + fmt(day) + '</div></div>' +
      '<div class="left">' + left + ' block' + (left === 1 ? '' : 's') + ' left<br>' + ago(left) + '</div></div>' +
      '<div class="bar"><i style="width:' + Math.round(100 * into / DAY) + '%"></i></div>' +
      '<div class="meta">A new day starts every ' + DAY + ' blocks. Feed your pets once each day so they keep growing. 🍖</div>';
  }
  function paintCommunity() {
    var c = S.sum && S.sum.community; if (!c) { $('commCard').hidden = true; return; }
    var id = c.current || c.nextPet, fed = Number(c[id + 'Fed'] != null ? c[id + 'Fed'] : c.burned) || 0, st = c.petStage != null ? c.petStage : (c[id + 'Stage'] || 0);
    var info = COMM[id] || [c.petName || 'Community pet', '🥚'], name = c.petName || info[0];
    var lo = CM_T[st] || 0, hi = st < 5 ? CM_T[st + 1] : null, pct = hi ? Math.max(0, Math.min(100, 100 * (fed - lo) / (hi - lo))) : 100;
    $('commCard').hidden = false;
    $('commCard').innerHTML = '<div class="sub" style="margin:0 0 8px">Community pet · everyone feeds it together</div>' +
      '<div class="who"><div class="emo">' + info[1] + '</div><div><div class="nm">' + esc(name) + '</div><div class="st">' + esc(STAGE[st] || '') + (hi ? ' → ' + STAGE[st + 1] : ' · maxed') + '</div></div></div>' +
      '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="meta">' + fmt(fed) + ' XCPETS fed' + (hi ? ' · ' + fmt(hi - fed) + ' more to ' + STAGE[st + 1] + ' (' + pct.toFixed(1) + '%)' : '') + '</div>';
  }
  function paintRaid() {
    var rs = S.sum && S.sum.raids, r = rs && rs.length ? rs[rs.length - 1] : null, b = S.tip;
    if (!r || r.settled || r.killBlock || (r.end && b > r.end)) { $('raidCard').hidden = true; return; }
    var hp = r.hp || 1, left = r.left == null ? hp : r.left, pct = Math.max(0, Math.min(100, 100 * left / hp));
    var open = !r.open || b >= r.open, hitters = (r.order || []).length;
    $('raidCard').hidden = false;
    $('raidCard').innerHTML = '<h2>🐉 Raid #' + r.n + ': ' + esc(BOSS[r.boss] || r.boss) + '</h2>' +
      '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="meta">' + fmt(left) + ' / ' + fmt(hp) + ' HP left · ' + (open ? (r.end ? 'ends in ' + fmt(r.end - b) + ' blocks (' + ago(r.end - b) + ')' : 'open now') : 'opens in ' + fmt(r.open - b) + ' blocks') +
      ' · ' + (hitters ? hitters + ' pet' + (hitters === 1 ? '' : 's') + ' hit it' : 'no hits yet, be first!') + '</div>' +
      '<button class="ghost" data-open="raid.html?cc=1">⚔️ Hit the boss</button>';
  }
  function paintBoard() {
    var lb = (S.sum && (S.sum.leaderboard || (S.sum.community && S.sum.community.leaderboard))) || [];
    $('lb').innerHTML = lb.slice(0, 5).map(function (x) {
      return '<li><span class="a">' + esc(short(x.address)) + (S.addr && x.address === S.addr ? ' <b class="c3">(you)</b>' : '') + '</span><span class="v">' + amt(x.amount) + '</span></li>';
    }).join('') || '<li><span class="a">No burns yet</span></li>';
  }

  /* burn tags -> one plain line. Display only: the rules decide what a burn did; this only names the move. */
  function tagText(h) {
    h = String(h || '');
    if (!/^([0-9a-f]{2})+$/i.test(h)) return h;
    try { return decodeURIComponent(h.replace(/(..)/g, '%$1')); } catch (e) { return h; }
  }
  function pid(n) { return '<b>#' + esc(n) + '</b>'; }
  function describe(tag, q) {
    var t = String(tag || ''), p = t.split(':'), v = p[1] || '', a = p[2], b = p[3], m;
    if (!/^pet:/.test(t)) return null;
    if (v === 'hatchzap') return ['⚡', 'ripped an <b>Electric Shock Box</b> (1,000 eggs)'];
    if (v === 'hatchwiz') return ['🧙', 'cracked a <b>Wizard egg</b>'];
    if ((m = /^hatch(\d*)$/.exec(v))) { var n = +(m[1] || 1); return ['🥚', 'hatched <b>' + fmt(n) + ' egg' + (n === 1 ? '' : 's') + '</b>']; }
    if (v === 'feed' && a) return ['🍖', 'fed ' + pid(a)];
    if (v === 'fa') return ['🍖', 'fed <b>all</b> their pets'];
    if (v === 'fl' || v === 'fm' || v === 'fr' || v === 'feedr' || v === 'feedm' || v === 'feedl' || v === 'feeda') return ['🍖', 'fed a bunch of pets'];
    if (v === 'zfeed' || v === 'zfm') return ['🧟', 'fed zombie ' + pid(a)];
    if (v === 'breed' && a && b) return ['💞', 'sent ' + pid(a) + ' × ' + pid(b) + ' to the Motel'];
    if (v === 'accept') return ['💞', 'said yes to a breed'];
    if (v === 'ad') return ['💌', 'posted ' + pid(a) + ' for breeding'];
    if (v === 'fight' && a && b) return ['⚔️', pid(a) + ' fought ' + pid(b)];
    if (v === 'rumble') return ['🤼', pid(a) + ' jumped into a rumble'];
    if (v === 'raid') return ['🐉', pid(a) + ' hit the raid boss'];
    if (v === 'wagmi') return ['🫡', 'said <b>WAGMI</b>'];
    if (v === 'spin' || v === 'usespin') return ['🎰', 'spun the wheel'];
    if (v === 'roll' || v === 'froll' || v === 'oroll' || (v === 'c' && a === 'roll')) return ['🎲', 'rolled for gear' + (v === 'roll' && a ? ' on ' + pid(a) : '')];
    if (v === 'quest') return ['🗺️', 'sent ' + pid(a) + ' on a quest'];
    if (v === 'resurrect' || v === 'raise' || v === 'rpl' || v === 'rplg') return ['✨', 'brought ' + pid(a) + ' back from the grave'];
    if (v === 'seance' || v === 'alt' || v === 'altg') return ['🕯️', 'held a seance'];
    if (v === 'unleash') return ['🧟', 'unleashed zombie ' + pid(a)];
    if (v === 'dip') return ['🏊', pid(a) + ' took a Pool Dip'];
    if (v === 'pantry') return ['🥫', 'stocked the Pantry'];
    if (v === 'rug') return ['🪤', 'played Rug Me'];
    if (v === 'hd') return ['👋', 'let some pets go'];
    if (v === 'give' || v === 'gives' || v === 'swap' || v === 'swapok') return ['🎁', 'gifted or swapped pets'];
    if (v === 'look' || v === 'aura') return ['💅', 'changed a look'];
    if (v === 'deed' || v === 'sign' || v === 'ut' || v === 'sk' || v === 'su' || v === 'rw' || v === 'rel' || v === 'wsign') return null; /* bookkeeping */
    return q >= 1 ? ['✨', 'made a move'] : null;
  }
  /* One player doing the same kind of move many times (a 30-burn seance run) is one row with a count, at its newest spot. */
  function group(rows) {
    var out = [], by = {};
    rows.forEach(function (r) {
      var q = r.quantity_normalized != null ? Number(r.quantity_normalized) : Number(r.quantity) / UNIT, d = describe(tagText(r.tag), q);
      if (!d) return;
      var k = r.source + '|' + d[0], g = by[k];
      if (g) { g.n++; g.q += q; return; }
      out.push(by[k] = { n: 1, q: q, r: r });
    });
    return out.map(function (g) { return Object.assign({}, g.r, { _n: g.n, _q: g.q }); });
  }
  function feedRow(r, pending) {
    var tag = tagText(r.tag), q = r.quantity_normalized != null ? Number(r.quantity_normalized) : Number(r.quantity) / UNIT, d = describe(tag, q);
    if (!d) return '';
    var who = r.source || '', you = S.addr && who === S.addr;
    var when = pending ? 'in mempool' : ('block ' + fmt(r.block_index) + '<br>' + ago(S.tip - r.block_index));
    if (r._n > 1) { q = r._q; d = [d[0], (d[1].replace(/<b>#\d+<\/b>( × <b>#\d+<\/b>)?/, 'pets').replace(/^pets /, '')) + ' <b class="c3">×' + r._n + '</b>']; }
    var burn = q >= 0.01 ? ' · 🔥' + amt(q) : '';
    return '<li class="' + (pending ? 'pend' : '') + (S.seen[r.tx_hash] || pending ? '' : ' new') + '"><div class="ic">' + d[0] + '</div><div class="tx"><span class="' + (you ? 'you' : '') + '">' + (you ? 'You' : esc(short(who))) + '</span> ' + d[1] + '<span class="meta">' + burn + '</span></div><div class="tm">' + when + '</div></li>';
  }
  function loadFeed(first) {
    return Promise.all([
      read('/assets/' + ASSET + '/destructions?limit=40'),
      read('/mempool/events/ASSET_DESTRUCTION?limit=50').catch(function () { return null; })
    ]).then(function (res) {
      var rows = (res[0] && res[0].result) || [], pend = ((res[1] && res[1].result) || []).map(function (e) { var p = e.params || {}; return { tx_hash: e.tx_hash || p.tx_hash, source: p.source, tag: p.tag, quantity: p.quantity, asset: p.asset, status: p.status }; })
        .filter(function (r) { return r.asset === ASSET; });
      rows = rows.filter(function (r) { return !r.status || String(r.status).toLowerCase() === 'valid'; });
      rows.sort(function (a, b) { return b.block_index - a.block_index || (b.tx_index || 0) - (a.tx_index || 0); });
      if (rows[0] && rows[0].block_index > S.tip) S.tip = rows[0].block_index;
      var html = pend.map(function (r) { return feedRow(r, true); }).join('') + group(rows).slice(0, 14).map(function (g) { return feedRow(g, false); }).join('');
      $('feed').innerHTML = html || '<li><div class="tx">Quiet right now. Be the first move of the block!</div></li>';
      if (first) rows.forEach(function (r) { S.seen[r.tx_hash] = 1; });
      else { var fresh = rows.filter(function (r) { return !S.seen[r.tx_hash]; }).length; rows.forEach(function (r) { S.seen[r.tx_hash] = 1; }); if (fresh) haptic('sel'); }
      if (first) { var el = $('feed').querySelectorAll('li.new'); Array.prototype.forEach.call(el, function (x) { x.classList.remove('new'); }); }
      paintTip(); paintDay();
    }, function () {
      if (first) $('feed').innerHTML = '<li><div class="tx">The chain is not answering right now. Pull down or try again in a minute.</div></li>';
    });
  }

  /* ---------------------------------------------------------------- pet art (lazy) */
  function loadScript(src) { return new Promise(function (ok, no) { var s = D.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; D.head.appendChild(s); }); }
  function art() {
    if (!S.artP) S.artP = loadScript(siteUrl('js/pet-core.js?v=e6db15afb2')).then(function () { return loadScript(siteUrl('js/v2-art.js?v=a543bcdc56')); }).then(function () { return !!(W.PetCore && W.XcpArt && XcpArt.buildArt); }, function () { return false; });
    return S.artP;
  }
  var artCache = {};
  function petFrames(p, hashes) {
    if (artCache[p.id]) return artCache[p.id];
    if (isHybrid(p) || p.community) return null;
    try {
      var a = p.art && p.art.dna ? p.art : XcpArt.buildArt(p, p.__hs || hashes, PetCore, {});
      var st = Math.max(0, Math.min(5, p.stage | 0));
      /* gearOverride {}: the old v1 kit is not drawn (v2 gear lives on the full site), the same choice js/v2-gravestone.js makes */
      return (artCache[p.id] = PetCore.renderFrames(a, { stage: st, gearOverride: {} }));
    } catch (e) { return null; }
  }
  var anims = [];
  function draw(cv, frames) {
    var c = cv.getContext('2d'), f = frames[0], img = c.createImageData(f.width, f.height);
    cv.width = f.width; cv.height = f.height; img.data.set(f.data); c.putImageData(img, 0, 0);
    anims.push({ cv: cv, fr: frames, i: 0 });
  }
  setInterval(function () {
    anims = anims.filter(function (a) { return a.cv.isConnected; });
    anims.forEach(function (a) { a.i = (a.i + 1) % a.fr.length; var c = a.cv.getContext('2d'), f = a.fr[a.i], img = c.createImageData(f.width, f.height); img.data.set(f.data); c.putImageData(img, 0, 0); });
  }, 260);
  function isHybrid(p) { return !!(p.hybrid || /^hyb/.test(String(p.species || ''))); }
  function baseSpecies(p) { var s = String(p.species || ''); if (/^hyb/.test(s)) s = s.split(':')[1] || ''; return s; }
  function iconFor(p) { var s = baseSpecies(p); return SP_ICON[s] ? siteUrl('img/theme/sp-' + s + '.png') : siteUrl('img/theme/egg.png'); }
  /* a pet's shown species: cross pets (1 of 1 mixes like Star-Lord Pigeon) carry their name in the summary (made by the rules' petSpeciesLabel) */
  function petSp(p) { var c = p && S.sum && S.sum.crossNames; return (c && c[p.id]) || spLabel(p && p.species); }
  function spLabel(s) { s = String(s || ''); if (/^hyb/.test(s)) return s.split(':').slice(1).map(spLabel).join(' × ') + ' hybrid'; return s === 'kevin' ? 'KEVIN' : s === 'funtrump' ? 'FUNTRUMP' : s.charAt(0).toUpperCase() + s.slice(1); }
  function fillArt(root, list, hashes) {
    art().then(function (ok) {
      if (!ok) return;
      var byId = {}; list.forEach(function (p) { byId[p.id] = p; });
      var slots = root.querySelectorAll('[data-art]'), i = 0;
      (function chunk() { /* a few at a time so the list stays scrollable on old phones */
        var end = Math.min(slots.length, i + 6);
        for (; i < end; i++) { var el = slots[i], p = byId[el.getAttribute('data-art')], fr = p && petFrames(p, hashes); if (!fr) continue; var cv = D.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); draw(cv, fr); el.replaceWith(cv); }
        if (i < slots.length) setTimeout(chunk, 16);
      })();
    });
  }

  /* ---------------------------------------------------------------- MY PETS tab */
  function petCard(p) {
    var t = p.tier | 0, st = p.stage | 0;
    return '<button class="pet t' + t + (st === 5 ? ' myth' : '') + '" data-pet="' + p.id + '">' +
      '<img class="ph" data-art="' + p.id + '" src="' + esc(iconFor(p)) + '" alt="">' +
      '<span class="tg c' + t + '">' + (st === 5 ? 'MYTH' : esc((STAGE[st] || '').slice(0, 5).toUpperCase())) + '</span>' +
      (p.zombie ? '<span class="hz" title="Zombie">🧟</span>' : p.hungry ? '<span class="hz" title="Hungry">😋</span>' : p.fedToday ? '<span class="hz" title="Fed today">✅</span>' : '') +
      '<div class="n">' + esc(p.name || ('#' + p.id)) + '</div><div class="i">#' + p.id + '</div></button>';
  }
  function openPage(hex, n) { return getJson(S.folder + 'view/own/' + hex + (n ? '.' + n : '') + '.json', 15000); }
  function living(list) { return (list || []).filter(function (p) { return p && p.id && !p.dead && !p.released; }); }
  function showWallet(addr) {
    addr = String(addr || '').trim(); if (/^bc1/i.test(addr)) addr = addr.toLowerCase();
    $('walletErr').hidden = true;
    if (!validAddr(addr)) { $('walletErr').textContent = 'That does not look like a Bitcoin address. Copy it from your wallet and paste it here.'; $('walletErr').hidden = false; haptic('rigid'); return; }
    S.addr = addr; store(KEY, addr);
    $('walletCard').hidden = true; $('mine').hidden = false;
    $('meAddr').textContent = short(addr);
    $('meStats').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>';
    $('pets').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>'; $('meSpecies').innerHTML = ''; $('riseCard').hidden = true; $('more').hidden = true;
    var balP = read('/addresses/' + addr + '/balances/' + ASSET).then(function (j) { var r = j && j.result, s = 0; (Array.isArray(r) ? r : r ? [r] : []).forEach(function (x) { s += x.quantity_normalized != null ? Number(x.quantity_normalized) : Number(x.quantity || 0) / UNIT; }); return s; }, function () { return null; });
    (S.folder ? Promise.resolve() : world()).then(function () { return sha256(addr); }).then(function (hex) {
      S.hex = hex;
      return openPage(hex, 0).then(function (pg) {
        S.page = pg; S.pages = pg ? pg.pages || 1 : 0; S.nextPage = 1;
        S.pets = pg ? living(pg.pets) : [];
        return balP.then(function (bal) { paintMine(pg, bal); });
      });
    }).catch(function () {
      $('meStats').innerHTML = ''; $('pets').innerHTML = '<p class="sub">Could not load the published pets right now. Try again in a minute.</p>';
    });
    paintBoard();
  }
  function wagmiStreak() {
    var wm = S.sum && S.sum.wagmi && S.sum.wagmi[S.addr], day = Math.floor(S.tip / DAY), n = 0;
    if (!wm) return 0;
    if (!wm[day]) day--; /* today not said yet: the streak is still alive until the day ends */
    while (wm[day]) { n++; day--; }
    return n;
  }
  function paintMine(pg, bal) {
    var ro = pg && pg.roster || {}, alive = pg ? pg.alive : 0, dead = pg ? pg.dead : 0, hungry = S.pets.filter(function (p) { return p.hungry; }).length;
    var stats = [[fmt(alive), 'alive'], [fmt(dead), 'in graves'], [bal == null ? '…' : amt(bal), 'XCPETS'], [String(wagmiStreak()), 'WAGMI days'], [fmt(ro.hybrid || 0), 'hybrids'], [fmt(ro.tokenized || 0), 'pet tokens'], [fmt(ro.zombies || 0), 'zombies'], [String(Object.keys(ro.species || {}).length), 'species']];
    $('meStats').innerHTML = stats.map(function (s) { return '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('');
    var sp = ro.species || {}, keys = Object.keys(sp).sort(function (a, b) { return sp[b] - sp[a]; }).slice(0, 12);
    $('meSpecies').innerHTML = keys.map(function (k) { return '<span class="sp">' + (SP_ICON[k] ? '<img src="' + esc(siteUrl('img/theme/sp-' + k + '.png')) + '" alt="">' : '') + esc(spLabel(k)) + ' <b>' + fmt(sp[k]) + '</b></span>'; }).join('');
    if (!pg) {
      $('petsTitle').textContent = 'No pets yet';
      $('petsSub').textContent = 'This wallet has no published pets. Hatch your first egg in the Play tab!';
      $('pets').innerHTML = ''; return;
    }
    var rise = living(pg.rise || []);
    if (rise.length) { $('riseCard').hidden = false; $('rise').innerHTML = rise.map(petCard).join(''); fillArt($('rise'), rise, pg.hashes); }
    $('petsTitle').textContent = 'Your pets';
    $('petsSub').textContent = alive > S.pets.length ? 'Oldest first. Showing ' + fmt(S.pets.length) + ' of ' + fmt(alive) + '.' + (hungry ? ' 😋 = hungry.' : '') : 'Oldest first.' + (hungry ? ' 😋 = hungry.' : '');
    $('pets').innerHTML = S.pets.map(petCard).join('');
    fillArt($('pets'), S.pets, pg.hashes);
    $('more').hidden = S.nextPage >= S.pages;
  }
  /* Later owner pages hold only ids. Their pets live in the shared pet shards (view/p/<id / 2000>.json), like the site's own paging. */
  var shardP = {};
  function shard(name) { if (!shardP[name]) shardP[name] = getJson(S.folder + 'view/p/' + name + '.json', 20000).catch(function () { delete shardP[name]; return null; }); return shardP[name]; }
  function petsByIds(ids) {
    var need = {}, names;
    (ids || []).forEach(function (id) { var nm = ('00000' + Math.floor((id | 0) / 2000)).slice(-5); (need[nm] = need[nm] || []).push(id | 0); });
    names = Object.keys(need);
    return Promise.all(names.map(function (nm) {
      return shard(nm).then(function (pack) {
        var map = pack && pack.pets || {};
        return need[nm].map(function (id) { var src = map[String(id)]; if (!src) return null; var q = Object.assign({}, src); q.__hs = pack.hashes || null; return q; }).filter(Boolean);
      });
    })).then(function (groups) { var all = []; groups.forEach(function (g) { all = all.concat(g); }); all.sort(function (a, b) { return a.id - b.id; }); return all; });
  }
  function more() {
    if (S.nextPage >= S.pages) return;
    var n = S.nextPage++, btn = $('more'); btn.disabled = true; btn.textContent = 'Loading…';
    openPage(S.hex, n).then(function (pg) {
      if (!pg) return [];
      return pg.pets ? living(pg.pets).map(function (q) { q.__hs = pg.hashes || null; return q; }) : petsByIds(pg.ids).then(living);
    }).then(function (add) {
      if (!add.length) return;
      S.pets = S.pets.concat(add);
      var wrap = D.createElement('div'); wrap.innerHTML = add.map(petCard).join('');
      var frag = D.createDocumentFragment(); while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      $('pets').appendChild(frag);
      fillArt($('pets'), add, null);
      $('petsSub').textContent = 'Oldest first. Showing ' + fmt(S.pets.length) + ' of ' + fmt(S.page.alive) + '.';
    }).catch(function () { toast('Could not load more pets. Try again.'); S.nextPage--; }).then(function () { btn.disabled = false; btn.textContent = 'Show 24 more'; btn.hidden = S.nextPage >= S.pages; });
  }

  /* ---------------------------------------------------------------- pet sheet */
  function findPet(id) { id = +id; var all = S.pets.concat(living(S.page && S.page.rise)); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function openSheet(p) {
    var t = p.tier | 0, st = p.stage | 0, s = p.stats || {}, pow = 0;
    ['vigor', 'spark', 'grit', 'zoom', 'luck'].forEach(function (k) { pow += s[k] || 0; });
    var bars = ['vigor', 'spark', 'grit', 'zoom', 'luck'].map(function (k) { var v = s[k] || 0; return '<div class="sbar"><span>' + k.charAt(0).toUpperCase() + k.slice(1) + '</span><div class="bar"><i style="width:' + Math.min(100, v) + '%"></i></div><b>' + v + '</b></div>'; }).join('');
    var food = p.zombie ? '🧟 Zombie' : p.hungry ? '😋 Hungry: feed today' : p.fedToday ? '✅ Fed today' : st === 5 ? '🌕 Mythic' : '🍖 Fed ' + (p.fedDays || 0) + ' days';
    $('sheetBody').innerHTML = '<div class="hero"><img class="ph" data-art="' + p.id + '" src="' + esc(iconFor(p)) + '" alt=""><div><div class="nm" id="sheetName">' + esc(p.name || 'Pet') + '</div><div class="id">#' + p.id + '</div>' +
      '<div class="pills"><span class="pill c' + t + '">' + TIER[t] + '</span><span class="pill">' + esc(STAGE[st] || '') + '</span><span class="pill">' + esc(petSp(p)) + '</span></div></div></div>' +
      '<div class="pills" style="margin-top:12px"><span class="pill">' + food + '</span><span class="pill">🍖 ' + amt(p.care || 0) + ' fed</span><span class="pill">⚔️ ' + (p.wins || 0) + '-' + (p.losses || 0) + '</span><span class="pill">💪 power ' + pow + '</span>' + ((p.worn || []).length ? '<span class="pill">🎒 ' + p.worn.length + ' gear</span>' : '') + '</div>' +
      '<div class="sbars">' + bars + '</div>' +
      '<div class="acts"><button class="pri" data-open="play.html?cc=1">' + (p.hungry ? '🍖 Feed it' : '🎮 Play') + '</button><button data-open="pet.html?id=' + p.id + '">🔍 Full pet page</button>' +
      '<button data-open="breed.html?cc=1">💞 Breed</button><button data-share="' + p.id + '">📣 Brag in chat</button></div>';
    $('sheet').hidden = false; backBtn(); haptic('light');
    fillArt($('sheetBody'), [p], S.page && S.page.hashes);
  }
  function closeSheet() { $('sheet').hidden = true; backBtn(); }
  /* Nov 24 2026: the shared link is the game server's pet page (https://node.xcpets.fun/xp/v1/pet/<id>), whose preview in the chat is
   * that pet's own card picture. Until the server answers it, the link is the pet page on xcpets.fun. */
  var cardOk = {};
  function cardLink(id) {
    var c = 'https://node.xcpets.fun/xp/v1/pet/' + id, plain = siteUrl('pet.html?id=' + id);
    if (cardOk[id] != null) return Promise.resolve(cardOk[id] ? c : plain);
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; res(plain); } }, 4000);
      fetch(c + '.png', { cache: 'no-cache' }).then(function (r) { var ok = r.ok && /image\/png/.test(r.headers.get('content-type') || '') && !/\/img\/og\.png/.test(r.url || ''); cardOk[id] = ok; if (!done) { done = true; clearTimeout(t); res(ok ? c : plain); } },
        function () { if (!done) { done = true; clearTimeout(t); res(plain); } });
    });
  }
  function share(id) {
    var p = findPet(id), txt = p ? 'Check out my ' + TIER[p.tier | 0] + ' ' + petSp(p) + ' ' + (p.name || '') + ' (#' + id + ') on XCPETS 🐸' : 'XCPETS #' + id;
    cardLink(id).then(function (u) {
      var link = 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(txt);
      try { if (TG && TG.openTelegramLink) { TG.openTelegramLink(link); return; } } catch (e) {}
      if (navigator.share) navigator.share({ title: 'XCPETS', text: txt, url: u }).catch(function () {}); else W.open(link, '_blank', 'noopener');
    });
  }

  /* ---------------------------------------------------------------- PLAY tab */
  var TILES = [
    ['hot', '🥚', 'Hatch', 'Burn for eggs. Every one is a surprise.', 'play.html?cc=1'],
    ['feed', '🍖', 'Feed', 'One meal a day. Grow to Mythic.', 'play.html?cc=1'],
    ['love', '💞', 'Breed', "Gooby's No-Tail Motel", 'breed.html?cc=1'],
    ['war', '⚔️', 'Fight', 'X Circus Kekimus', 'fight.html?cc=1'],
    ['', '🐉', 'Raid', 'Hit the boss together', 'raid.html?cc=1'],
    ['', '🪦', 'Cemetery', 'Seances and zombies', 'cemetery.html?cc=1'],
    ['', '🛒', 'Spam City', 'Shop and pet tokens', 'shop.html?cc=1'],
    ['', '🏆', 'Ranking', 'Who is on top', 'ranking.html']
  ];
  function paintTiles() {
    $('tiles').innerHTML = TILES.map(function (t) { return '<button class="tile ' + t[0] + '" data-open="' + t[4] + '"><span class="e">' + t[1] + '</span><span class="t">' + t[2] + '</span><span class="d">' + esc(t[3]) + '</span></button>'; }).join('');
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    D.addEventListener('click', function (e) {
      var el = e.target.closest('[data-tab],[data-open],[data-pet],[data-close],[data-share]'); if (!el) return;
      if (el.hasAttribute('data-tab')) { haptic('sel'); tab(el.getAttribute('data-tab')); }
      else if (el.hasAttribute('data-open')) openSite(el.getAttribute('data-open'));
      else if (el.hasAttribute('data-pet')) { var p = findPet(el.getAttribute('data-pet')); if (p) openSheet(p); }
      else if (el.hasAttribute('data-share')) share(el.getAttribute('data-share'));
      else if (el.hasAttribute('data-close')) closeSheet();
    });
    $('walletForm').addEventListener('submit', function (e) { e.preventDefault(); showWallet($('walletIn').value); });
    $('meChange').addEventListener('click', function () { $('mine').hidden = true; $('walletCard').hidden = false; $('walletIn').value = S.addr; $('walletIn').focus(); });
    $('more').addEventListener('click', more);
    $('feedFull').addEventListener('click', function () { openSite('live.html'); });
    D.addEventListener('visibilitychange', function () { if (!D.hidden) loadFeed(false); });
  }

  function start() {
    setupTelegram(); wire(); paintTiles();
    var want = (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || new URLSearchParams(location.search).get('tab') || '';
    if (/^(pets|play)$/.test(want)) tab(want);
    recall(function (a) {
      var q = new URLSearchParams(location.search).get('addr');
      if (q && validAddr(q)) a = q;
      if (a) { $('walletIn').value = a; showWallet(a); }
    });
    tipNow().then(function () { paintTip(); paintDay(); });
    loadFeed(true);
    world().then(function () { paintTip(); paintDay(); paintCommunity(); paintRaid(); paintBoard(); }, function () { $('commCard').hidden = true; $('lb').innerHTML = '<li><span class="a">Leaderboard is loading slowly. Try again soon.</span></li>'; });
    S.feedTimer = setInterval(function () { if (!D.hidden) loadFeed(false); }, 60000);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
