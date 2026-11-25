/* SPECIES REGISTRY (Nov 25 2026, Jake: "adding a new pet should be a one-place change"). Display only: no rule, stat or replay change.
 *
 * One entry per pet species. The display code (js/v2-render.js, js/v2-zombie-look.js, js/mythic-sig.js, js/v2-pet-tap.js,
 * js/v2-grinder.js, js/v2-pages.js, tg/app.js, hatchbot/art.js, tools/token-meta.js, tools/cross-sheet.js) reads its species
 * lists from here instead of keeping its own copy.
 *
 * The replay rules (js/v2-rules.js, js/pet-core.js, js/v2-fit.js, js/v2-gear.js) stay self-contained and never read this file,
 * and a few places can't read it (the sync server, the Cloudflare HatchBot, the Python sticker maker, per-pet art tables).
 * tools/species-registry-test.js checks every one of those places against this list and names the file to change when a
 * species is missing. A gap that is fine for now is written down on the entry as skip: { <place>: 'why' }.
 *
 * ADDING A NEW PET: add one entry below, then run `node tools/species-registry-test.js` and follow what it prints.
 *
 * Fields
 *   id        species id the rules use (art.species)
 *   name      full display name ("Homer Pepe"); short: casual name where it differs ("White Rabbit")
 *   kind      'egg'       hatches from normal eggs (js/pet-core.js SPECIES)
 *             'community' a community pet (community.no = its number, mythic = its Cold Storage record key on the world, title = name in
 *                         Cold Storage lines when it differs, eggs = its eggs hatch 1 in 777 after its Mythic)
 *             'legend'    a rare hatch (DJ Pepe)
 *             'oneofone'  a 1 of 1 pet (or a 1 of 1 pair's baby)
 *             'contest'   a contest / special egg pet
 *   emoji     one emoji for the pet (Telegram app, raise tip)
 *   sprite    { g: global name, file: script, draw: true when g.draw(stage, frame, gear) returns the 32x32 key grid with eyes marked E / P
 *               and g.frames(stage, bg, gear, opts) draws the pet; pal: extra palette on g (g[pal]) for gear colours; hybGear: false = hybrids
 *               with this body keep the plain hybrid look (no sprite gear layer) }
 *             A new pet with a draw sprite is drawn by js/v2-render.js automatically (pet, gear, hybrid gear layer): no renderer code needed.
 *   sig       Mythic signature effect in js/mythic-sig.js
 *   face      1 = profile body facing right, -1 = facing left (pigeon wing placement in js/v2-render.js)
 *   look      sprite colour keys that are the torso, for the pigeon / Bo looks in js/v2-render.js
 *   tap       what the pet says when tapped on its page (js/v2-pet-tap.js)
 *   skip      { place: 'reason' } for a place this pet deliberately doesn't have yet (see tools/species-registry-test.js PLACES)
 */
(function (root, factory) { var R = factory(); if (typeof module === 'object' && module.exports) module.exports = R; if (root) root.XcpSpecies = R; })(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var CONTEST = { g: 'ContestSprite', file: 'js/contest-sprite.js' };
  var LIST = [
    /* ---- egg species (js/pet-core.js SPECIES) ---- */
    { id: 'pepe', name: 'Pepe', kind: 'egg', emoji: '🐸', tap: ['feels good man', 'rare pepe energy'] },
    { id: 'wojak', name: 'Wojak', kind: 'egg', emoji: '😐', tap: ['i know that feel bro', 'it’s over... jk we’re so back'] },
    { id: 'chud', name: 'Chud', kind: 'egg', emoji: '🤓', tap: ['YES.', 'built different'] },
    { id: 'bobo', name: 'Bobo', kind: 'egg', emoji: '🐻', tap: ['ok but have you considered: bear', 'ngmi (affectionate)'] },
    { id: 'mumu', name: 'Mumu', kind: 'egg', emoji: '🐮', tap: ['moooon', 'green candles only'] },
    { id: 'snibby', name: 'Snibby', kind: 'egg', emoji: '🐌', tap: ['slow and steady', 'shell yeah'] },
    { id: 'dodo', name: 'Dodo', kind: 'egg', emoji: '🦤', face: 1, tap: ['not extinct, just early', 'squawk'] },
    { id: 'kevin', name: 'KEVIN', kind: 'egg', emoji: '🧑', tap: ['kevin.', 'it’s kevin'] },
    { id: 'peepo', name: 'Peepo', kind: 'egg', emoji: '🥲', tap: ['peepoHappy', 'hehe'] },
    { id: 'sarutobi', name: 'Sarutobi', kind: 'egg', emoji: '🐵', tap: ['ninja mode', 'sneaky'] },
    { id: 'doge', name: 'Doge', kind: 'egg', emoji: '🐶', face: -1, tap: ['much pet. very wow.', 'such tap'] },
    { id: 'lenny', name: 'Lenny', kind: 'egg', emoji: '😏', tap: ['( ͡° ͜ʖ ͡°)', 'heh'] },
    { id: 'chad', name: 'Chad', kind: 'egg', emoji: '🗿', tap: ['yes.', 'average chad enjoyer'],
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet' } },

    /* ---- community pets, in order (#1 Nakamoto lives in js/pet-core.js SPECIES too) ---- */
    { id: 'nakamoto', name: 'Nakamoto', kind: 'community', community: { no: 1 }, emoji: '₿', sig: 'matrix', face: -1, tap: ['i am not satoshi', 'read the whitepaper'],
      skip: { clownHair: 'no Honk hair fitting yet' } },
    { id: 'wizard', name: 'Bitcoin Wizard', kind: 'community', community: { no: 2, mythic: 'wizardMythic', title: 'The Bitcoin Wizard' }, emoji: '🧙', sig: 'arcane',
      sprite: { g: 'WizardSprite', file: 'js/wizard-sprite.js', draw: true }, look: { k: 'RrhX', min: 4 }, tap: ['magic internet money', 'abracadabra, ser'] },
    { id: 'kek', name: 'Lord Kek', kind: 'community', community: { no: 3, mythic: 'kekMythic' }, emoji: '🐸', sig: 'kekglow',
      sprite: { g: 'KekSprite', file: 'js/kek-sprite.js', draw: true }, look: { k: 'Ggho', below: 'l', min: 3 }, tap: ['KEK', 'shadilay'] },
    { id: 'funtrump', name: 'FUNTRUMP', kind: 'community', community: { no: 4, mythic: 'funtrumpMythic', eggs: true }, emoji: '🍔', sig: 'goldshine', face: 1,
      sprite: { g: 'FuntrumpSprite', file: 'js/funtrump-sprite.js', draw: true }, look: { k: 'NvwB', min: 3 }, tap: ['tremendous pat. the best.', 'many people are saying this is a great pat'] },
    { id: 'homer', name: 'Homer Pepe', kind: 'community', community: { no: 5, mythic: 'homerMythic', eggs: true }, emoji: '🍩', sig: 'donut', face: 1,
      sprite: { g: 'HomerSprite', file: 'js/homer-sprite.js', draw: true }, look: { k: 'wWC', min: 3 }, tap: ['mmm... XCPETS', 'woohoo!'] },
    { id: 'rabbit', name: 'The White Rabbit', short: 'White Rabbit', kind: 'community', community: { no: 6, mythic: 'rabbitMythic', eggs: true }, emoji: '🐇', sig: 'clockwork', face: 1,
      sprite: { g: 'RabbitSprite', file: 'js/rabbit-sprite.js', draw: true, pal: 'WRC' }, look: { k: 'cCB', min: 3 }, tap: ['follow the white rabbit', 'late for a very important block'],
      skip: { crossLook: 'no 1 of 1 cross look yet' } },
    { id: 'groyper', name: 'Groyper', kind: 'community', community: { no: 7, mythic: 'groyperMythic', eggs: true }, emoji: '🐸', sig: 'pond', face: 1,
      sprite: { g: 'GroyperSprite', file: 'js/groyper-sprite.js', draw: true, pal: 'GPC' }, look: { k: 'cC', min: 3 }, tap: ['comfy', 'just vibing in the pond'],
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet', stickers: 'not in the Telegram packs yet' } },

    /* ---- rare hatch legends ---- */
    { id: 'djpepe', name: 'DJ Pepe', kind: 'legend', emoji: '🎧', sprite: { g: 'DjPepeSprite', file: 'js/djpepe-sprite.js', draw: true }, tap: ['drop the beat', 'one more track'],
      skip: { sig: 'no Mythic signature yet', clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet' } },

    /* ---- 1 of 1 pets ---- */
    { id: 'bojackson', name: 'Bo Jackson', kind: 'oneofone', emoji: '🏈', sig: 'bo', sprite: { g: 'BoSprite', file: 'js/bo-sprite.js' },
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'is a 1 of 1 cross body itself', hybridName: 'breeds into 1 of 1 crosses, not syllable hybrids' } },
    { id: 'rarepigeon', name: 'Rarepigeon', kind: 'oneofone', emoji: '🐦', sig: 'feathers', sprite: { g: 'RarepigeonSprite', file: 'js/rarepigeon-sprite.js' },
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'is a 1 of 1 cross body itself', hybridName: 'breeds into 1 of 1 crosses, not syllable hybrids' } },
    { id: 'borp', name: 'Bo Pigeon', kind: 'oneofone', emoji: '🐦', sprite: CONTEST,
      skip: { sig: 'no Mythic signature yet', clownHair: 'no Honk hair fitting yet', crossLook: 'is a 1 of 1 cross body itself', hybridName: 'Bo x Rarepigeon baby, does not breed into syllable hybrids', stickers: 'not in the Telegram packs yet' } },
    { id: 'jacksonpepe', name: 'Old Hickory Pepe', kind: 'oneofone', emoji: '🎩', sprite: { g: 'JacksonSprite', file: 'js/jackson-sprite.js' },
      skip: { sig: 'no Mythic signature yet', clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet' } },
    { id: 'viking', name: 'Viking', kind: 'oneofone', emoji: '🪓', sig: 'frost', sprite: { g: 'VikingSprite', file: 'js/viking-sprite.js', draw: true },
      skip: { clownHair: 'no Honk hair fitting yet' } },
    { id: 'orangedragon', name: 'Orange Dragon', kind: 'oneofone', emoji: '🐉', sprite: { g: 'DragonSprite', file: 'js/dragon-sprite.js', draw: true, hybGear: false },
      skip: { sig: 'no Mythic signature yet', clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet' } },

    /* ---- contest / special egg pets (drawn by ContestSprite) ---- */
    /* Aspie (Nov 25 2026, Jake): the Meat Grinder's own pet and host. Pure Aspies only come out of the Grinder (rules ACTIVATE_ASPIE_BLOCK); her babies are Aspie hybrids. */
    { id: 'aspie', name: 'Aspie', kind: 'contest', emoji: '🥩', sprite: { g: 'AspieSprite', file: 'js/aspie-sprite.js', draw: true }, look: { k: 'BbDd', min: 3 },
      tap: ['...hi.', 'no refunds.', 'ok fine. one pat.'],
      skip: { sig: 'no Mythic signature yet', clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet', stickers: 'not in the Telegram packs yet' } },
    { id: 'starlordkek', name: 'Star-Lord Kek', kind: 'contest', emoji: '🌌', sig: 'cosmic', sprite: CONTEST,
      skip: { clownHair: 'no Honk hair fitting yet', hybridName: 'special pair hybrids are not in the rules yet' } },
    { id: 'gooby', name: 'Gooby', kind: 'contest', emoji: '🟢', sig: 'goo', sprite: CONTEST,
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet', hybridName: 'special pair hybrids are not in the rules yet' } },
    { id: 'lukespam', name: 'Luke Spam Junior', kind: 'contest', emoji: '🥫', sig: 'spam', sprite: CONTEST,
      skip: { clownHair: 'no Honk hair fitting yet', crossLook: 'no 1 of 1 cross look yet', hybridName: 'special pair hybrids are not in the rules yet' } }
  ];

  var BY = {}; LIST.forEach(function (s) { BY[s.id] = s; });
  function get(id) { return BY[id] || null; }
  function ids(test) { return LIST.filter(function (s) { return !test || test(s); }).map(function (s) { return s.id; }); }
  function name(id) { var s = BY[id]; return s ? s.name : String(id || ''); }
  function shortName(id) { var s = BY[id]; return s ? (s.short || s.name) : String(id || ''); }
  function emoji(id) { var s = BY[id]; return (s && s.emoji) || ''; }
  /** community pets in their order (#1, #2, ...) */
  function community() { return LIST.filter(function (s) { return s.community; }).sort(function (a, b) { return a.community.no - b.community.no; }); }
  /** community pets with a Cold Storage (Mythic) record: [{ id, no, key: 'homerMythic', name }] in order */
  function coldOrder() { return community().filter(function (s) { return s.community.mythic; }).map(function (s) { return { id: s.id, no: s.community.no, key: s.community.mythic, name: s.community.title || s.name }; }); }
  /** { id: true } for every species that isn't a normal egg species (special eggs, community pets, 1 of 1s, legends) */
  function specialMap() { var o = {}; LIST.forEach(function (s) { if (s.kind !== 'egg' && s.id !== 'nakamoto') o[s.id] = 1; }); return o; }
  /** { id: 'GlobalName' } for every species whose own sprite file draws a key grid (sprite.draw) */
  function drawSprites() { var o = {}; LIST.forEach(function (s) { if (s.sprite && s.sprite.draw) o[s.id] = s.sprite.g; }); return o; }
  /** the sprite script files every page that draws pets loads, in a safe load order (js/contest-sprite.js reads the Bo / pigeon / Jackson data, so it goes last) */
  function scripts() { var seen = {}, out = []; LIST.forEach(function (s) { var f = s.sprite && s.sprite.file; if (f && !seen[f]) { seen[f] = 1; out.push(f); } });
    return out.filter(function (f) { return f !== CONTEST.file; }).concat(seen[CONTEST.file] ? [CONTEST.file] : []); }
  /** a field per species: map('sig') -> { kek: 'kekglow', ... } (only species that have it) */
  function map(field) { var o = {}; LIST.forEach(function (s) { if (s[field] != null) o[s.id] = s[field]; }); return o; }

  return { LIST: LIST, get: get, ids: ids, name: name, shortName: shortName, emoji: emoji, community: community, coldOrder: coldOrder,
    specialMap: specialMap, drawSprites: drawSprites, scripts: scripts, map: map };
});
