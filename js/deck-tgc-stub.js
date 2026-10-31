/* pet-decks (PREVIEW): a STUB of The Game Crafter API order steps (https://www.thegamecrafter.com/developer/).
 * It never touches the network and holds no keys: every call is only described and answered with a made-up id, so the
 * order flow can be shown end to end. A real order would run these steps on a server we control (the API key can't live
 * in the browser), after payment. Steps follow TGC's docs: session, game, file, deck, card, twosidedbox, cart, sku, address, checkout. */
(function (root) {
  'use strict';
  var BASE = 'https://www.thegamecrafter.com/api';
  function fakeId(tag, n) { var h = 0, s = tag + ':' + n; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return tag.toUpperCase() + '-STUB-' + h.toString(16).toUpperCase().slice(0, 6); }
  /** The list of API calls a real order would make. deck = { address, pets: [{id,name}], chargeUSD }, ship = shipping form fields. */
  function plan(deck, ship) {
    var n = deck.pets.length, cards = n + 2, steps = [];
    function add(method, path, what) { steps.push({ method: method, url: BASE + path, what: what }); }
    add('POST', '/session', 'sign in to our TGC account (server side; the key never reaches the browser)');
    add('POST', '/game', 'make a private game: "XCPETS pet deck · ' + short(deck.address) + '"');
    add('POST', '/file', 'upload ONE card back (the same back for every card, QR to this deck page)');
    add('POST', '/deck', 'make a deck, identity PokerDeck (2.5 by 3.5 in), back_id = that one back');
    add('POST', '/file', 'upload ' + cards + ' card fronts (' + n + ' pets, a title card, a rules card), 825 by 1125 px at 300 dpi');
    add('POST', '/card', 'add the ' + cards + ' cards to the deck (one call per card)');
    add('POST', '/twosidedbox', 'add the tuck box art, identity PokerTuckBox54');
    add('POST', '/cart', 'open a cart');
    add('POST', '/cart/{cart_id}/sku/{game_sku}', 'put one copy of this deck in the cart');
    add('POST', '/address', 'save the ship-to address: ' + [ship.name, ship.city, ship.country].filter(Boolean).join(', '));
    add('PUT', '/cart/{cart_id}', 'attach that address to the cart');
    add('POST', '/cart/{cart_id}/payment/shopcredit', 'check out with our TGC shop credit (only after the player has paid us); TGC prints and ships it');
    return steps;
  }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 8) + '…' + a.slice(-4) : a; }
  /** Walks the plan; onStep(step, index, result) per step. Resolves with a made-up order record. No request is sent. */
  function run(deck, ship, onStep, delayMs) {
    var steps = plan(deck, ship), i = 0, d = delayMs == null ? 220 : delayMs;
    return new Promise(function (resolve) {
      (function next() {
        if (i >= steps.length) return resolve({ stub: true, sent: false, order: fakeId('order', deck.address + deck.pets.length), cardCount: deck.pets.length + 2, chargeUSD: deck.chargeUSD, steps: steps });
        var s = steps[i], r = { stub: true, sent: false, id: fakeId(s.url.split('/').pop().replace(/[{}]/g, ''), i) };
        if (onStep) onStep(s, i, r); i++; setTimeout(next, d);
      })();
    });
  }
  var api = { STUB: true, BASE: BASE, plan: plan, run: run };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.DeckTGC = api;
})(typeof window !== 'undefined' ? window : this);
