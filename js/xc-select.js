/* low-friction-1102 (owner, Nov 2 2026; PREVIEW, display only, no rule change): <xc-select> replaces every native dropdown (select element) on the site.
 * Same API as a one-choice native select element (value, selectedIndex, options, selectedOptions, length, disabled, focus(), 'input' + 'change'
 * events that bubble, <option>/<optgroup> children, selected attrs), so every existing handler, sort, filter and setting keeps working.
 *  - up to 6 short options -> tappable chips (a radio group: Tab in, arrow keys move + pick, Enter/Space pick)
 *  - more options -> one button that opens a searchable bottom sheet (slides up on phones; pet ids get their pet thumbnail).
 *    Keyboard: Enter / Space / Arrow Down opens, type to search, arrows move, Enter picks, Esc closes. No burns, no rules here. */
(function () {
  'use strict';
  if (!window.customElements || window.customElements.get('xc-select')) return;
  var CHIP_MAX = 6, CHIP_CHARS = 64, PAGE = 150, NONE = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function txt(o) { return String(o.textContent || '').replace(/\s+/g, ' ').trim(); }
  var SHADOW_CSS = ':host{display:inline-flex;vertical-align:middle;max-width:100%;font:inherit;color:inherit}:host([hidden]){display:none!important}' +
    '.chips{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}' +
    'button{font:inherit;font-size:inherit;color:var(--ink,#e9fbe9);background:#1f2d23;border:2px solid #000;border-radius:8px;padding:5px 9px;min-height:32px;cursor:pointer;line-height:1.2;text-align:left}' +
    'button:hover{border-color:#3ddc84}button:focus-visible{outline:2px solid #ffc93c;outline-offset:1px}' +
    '.chip[aria-checked="true"]{background:#3ddc84;color:#04130a;font-weight:700}' +
    'button[disabled]{opacity:.5;cursor:not-allowed}.grp{font-size:.8em;opacity:.7;margin:0 2px 0 6px}' +
    '.open{display:inline-flex;align-items:center;gap:6px;max-width:100%}.open .lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(60vw,320px)}.open .ar{opacity:.8}';
  var SHEET_CSS = '.xcs-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99990;display:flex;align-items:flex-end;justify-content:center}' +
    '.xcs-sh{background:#101812;color:var(--ink,#e9fbe9);border:2px solid #3ddc84;border-bottom:0;border-radius:14px 14px 0 0;width:100%;max-width:560px;max-height:78vh;display:flex;flex-direction:column;box-shadow:0 -6px 24px rgba(0,0,0,.6);transform:translateY(0);transition:transform .22s ease-out;font-size:14px}' +
    '.xcs-ov.in .xcs-sh{transform:translateY(100%)}@media (prefers-reduced-motion:reduce){.xcs-sh{transition:none}}' +
    '.xcs-hd{display:flex;gap:8px;align-items:center;padding:10px 12px 6px}.xcs-hd b{flex:1;font-size:13px}.xcs-grab{width:44px;height:5px;border-radius:3px;background:#3ddc84;opacity:.6;margin:8px auto 0}' +
    '.xcs-x{background:#1f2d23;color:inherit;border:2px solid #000;border-radius:8px;min-width:40px;min-height:36px;font:inherit;cursor:pointer}' +
    '.xcs-q{margin:0 12px 6px;padding:9px 10px;background:#0a0f0b;color:inherit;border:1px solid #2c4a36;border-radius:8px;font:inherit}' +
    '.xcs-ls{overflow:auto;padding:0 8px 12px;overscroll-behavior:contain}.xcs-g{font-size:11px;opacity:.7;padding:8px 6px 2px;text-transform:uppercase;letter-spacing:.05em}' +
    '.xcs-o{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;color:inherit;border:2px solid transparent;border-radius:8px;padding:7px 8px;min-height:40px;font:inherit;cursor:pointer}' +
    '.xcs-o:hover,.xcs-o.act{border-color:#3ddc84;background:#16241a}.xcs-o[aria-selected="true"]{background:#3ddc84;color:#04130a;font-weight:700}.xcs-o[disabled]{opacity:.45;cursor:not-allowed}' +
    '.xcs-o canvas{width:32px;height:32px;image-rendering:pixelated;flex:none}.xcs-more{margin:6px auto;display:block}.xcs-none{padding:10px;opacity:.7}' +
    '@media (min-width:700px){.xcs-ov{align-items:center}.xcs-sh{border-radius:14px;border-bottom:2px solid #3ddc84;max-height:70vh}}';
  function sheetCss() { if (document.getElementById('xcsCss')) return; var s = document.createElement('style'); s.id = 'xcsCss'; s.textContent = SHEET_CSS; (document.head || document.documentElement).appendChild(s); }
  function petOf(v, label) { if (!/^\d+$/.test(v) || label.indexOf('#' + v) < 0) return null; var U = window.V2UI, w = null; try { w = U && U.world && U.world(); } catch (e) { w = null; } return w && w.byId ? w.byId[Number(v)] || null : null; }
  function thumb(p) { var U = window.V2UI; try { var d = U && U.cardFor && U.cardFor(p, U.world()), c = d && d.querySelector('canvas'); if (c) { c.removeAttribute('style'); c.className = ''; return c; } } catch (e) { } return null; }

  class XcSelect extends HTMLElement {
    constructor() { super(); this._sel = null; this._sr = this.attachShadow({ mode: 'open' }); this._sr.innerHTML = '<style>' + SHADOW_CSS + '</style><span class="root" part="root"></span>'; this._root = this._sr.querySelector('.root'); this._mo = null; this._t = 0; }
    static get observedAttributes() { return ['disabled', 'aria-label', 'title']; }
    attributeChangedCallback() { this._render(); }
    connectedCallback() { var self = this;
      ['value', 'selectedIndex', 'disabled'].forEach(function (k) { if (Object.prototype.hasOwnProperty.call(self, k)) { var v = self[k]; delete self[k]; self[k] = v; } });
      if (!this._mo) { this._mo = new MutationObserver(function () { self._render(); }); this._mo.observe(this, { childList: true, subtree: true, attributes: true, characterData: true }); }
      this._render(); }
    get type() { return 'select-one'; }
    get options() { var a = Array.prototype.slice.call(this.querySelectorAll('option')); a.item = function (i) { return a[i] || null; }; a.namedItem = function (n) { return a.filter(function (o) { return o.id === n || o.getAttribute('name') === n; })[0] || null; }; return a; }
    get length() { return this.querySelectorAll('option').length; }
    _cur() { var a = this.options; if (this._sel === NONE) return null; if (this._sel && a.indexOf(this._sel) >= 0) return this._sel;
      var s = null; a.forEach(function (o) { if (o.hasAttribute('selected')) s = o; }); if (s) return s;
      for (var i = 0; i < a.length; i++) if (!a[i].disabled && !(a[i].parentNode && a[i].parentNode.disabled)) return a[i]; return a[0] || null; }
    get value() { var o = this._cur(); return o ? o.value : ''; }
    set value(v) { v = String(v == null ? '' : v); var o = this.options.filter(function (x) { return x.value === v; })[0]; this._sel = o || NONE; this._render(); }
    get selectedIndex() { var o = this._cur(); return o ? this.options.indexOf(o) : -1; }
    set selectedIndex(i) { var o = this.options[Number(i)]; this._sel = o || NONE; this._render(); }
    get selectedOptions() { var o = this._cur(); return o ? [o] : []; }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(b) { if (b) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
    get name() { return this.getAttribute('name') || ''; }
    item(i) { return this.options[i] || null; }
    add(o, before) { if (before == null) this.appendChild(o); else this.insertBefore(o, typeof before === 'number' ? this.options[before] || null : before); }
    remove(i) { if (typeof i === 'number') { var o = this.options[i]; if (o) o.remove(); } else HTMLElement.prototype.remove.call(this); }
    checkValidity() { return true; }
    focus(opt) { var b = this._root.querySelector('[tabindex="0"]') || this._root.querySelector('button'); if (b) b.focus(opt); }
    blur() { var a = this._sr.activeElement; if (a) a.blur(); }
    showPicker() { this._open(); }
    _pick(o) { if (this.disabled || !o || o.disabled) return; var was = this._cur(); this._sel = o; this._render(); if (was !== o) { this.dispatchEvent(new Event('input', { bubbles: true, composed: true })); this.dispatchEvent(new Event('change', { bubbles: true })); } }
    _items() { var out = []; this.options.forEach(function (o) { var g = o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode : null; out.push({ o: o, g: g ? g.getAttribute('label') || '' : '', dis: o.disabled || !!(g && g.disabled), label: txt(o) }); }); return out; }
    _chipMode(items) { if (this.hasAttribute('data-sheet')) return false; if (items.length > CHIP_MAX) return false; var n = 0; items.forEach(function (x) { n += x.label.length; }); if (n > CHIP_CHARS) return false; return !items.some(function (x) { return petOf(x.o.value, x.label); }); }
    _render() { var self = this, items = this._items(), cur = this._cur(), dis = this.disabled, al = this.getAttribute('aria-label') || this.getAttribute('title') || '';
      if (this._chipMode(items)) {
        var h = '<span class="chips" role="radiogroup"' + (al ? ' aria-label="' + esc(al) + '"' : '') + '>', lastG = null;
        items.forEach(function (x, i) { if (x.g && x.g !== lastG) h += '<span class="grp">' + esc(x.g) + '</span>'; lastG = x.g; var on = x.o === cur;
          h += '<button type="button" class="chip" role="radio" data-i="' + i + '" aria-checked="' + on + '" tabindex="' + (on || (!cur && i === 0) ? 0 : -1) + '"' + (dis || x.dis ? ' disabled' : '') + '>' + esc(x.label) + '</button>'; });
        this._root.innerHTML = h + '</span>';
        this._root.querySelectorAll('.chip').forEach(function (b) { b.onclick = function () { self._pick(items[+b.dataset.i].o); var n = self._root.querySelector('[data-i="' + b.dataset.i + '"]'); if (n) n.focus(); };
          b.onkeydown = function (e) { var k = e.key, en = items.map(function (x, i) { return x.dis ? -1 : i; }).filter(function (i) { return i >= 0; }), at = en.indexOf(+b.dataset.i), nx = null;
            if (k === 'ArrowRight' || k === 'ArrowDown') nx = en[(at + 1) % en.length]; else if (k === 'ArrowLeft' || k === 'ArrowUp') nx = en[(at - 1 + en.length) % en.length]; else if (k === 'Home') nx = en[0]; else if (k === 'End') nx = en[en.length - 1];
            if (nx == null) return; e.preventDefault(); self._pick(items[nx].o); var n = self._root.querySelector('[data-i="' + nx + '"]'); if (n) n.focus(); }; });
      } else {
        this._root.innerHTML = '<button type="button" class="open" aria-haspopup="listbox"' + (al ? ' aria-label="' + esc(al) + ': ' + esc(cur ? txt(cur) : '') + '"' : '') + ' tabindex="0"' + (dis ? ' disabled' : '') + '><span class="lb">' + esc(cur ? txt(cur) : '—') + '</span><span class="ar" aria-hidden="true">▾</span></button>';
        var b = this._root.querySelector('button'); b.onclick = function () { self._open(); }; b.onkeydown = function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); self._open(); } };
      } }
    _open() { if (this.disabled) return; sheetCss(); var self = this, items = this._items(), cur = this._cur(), opener = this._root.querySelector('button'), shown = PAGE, act = -1, al = this.getAttribute('aria-label') || this.getAttribute('title') || (this.closest('label') ? txt(this.closest('label')).replace(txt(this), '').trim() : '') || 'Choose';
      var ov = document.createElement('div'); ov.className = 'xcs-ov in'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', al);
      ov.innerHTML = '<div class="xcs-sh"><div class="xcs-grab" aria-hidden="true"></div><div class="xcs-hd"><b>' + esc(al) + '</b><button type="button" class="xcs-x" aria-label="Close">✕</button></div>' + (items.length > 8 ? '<input type="search" class="xcs-q" placeholder="Search ' + items.length.toLocaleString('en-US') + '…" aria-label="Search ' + esc(al) + '">' : '') + '<div class="xcs-ls" role="listbox" aria-label="' + esc(al) + '"></div></div>';
      document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.remove('in'); });
      var q = ov.querySelector('.xcs-q'), ls = ov.querySelector('.xcs-ls'), list = [];
      function close(back) { document.removeEventListener('keydown', key, true); ov.remove(); if (back !== false && self.isConnected) self.focus(); }
      function draw() { var s = q ? q.value.trim().toLowerCase().replace(/^#/, '') : ''; list = items.filter(function (x) { return !s || x.label.toLowerCase().indexOf(s) >= 0 || x.o.value.toLowerCase().indexOf(s) === 0 || (x.g && x.g.toLowerCase().indexOf(s) >= 0); });
        var h = '', lastG = null; list.slice(0, shown).forEach(function (x, i) { if (x.g !== lastG && x.g) h += '<div class="xcs-g" role="presentation">' + esc(x.g) + '</div>'; lastG = x.g;
          h += '<button type="button" class="xcs-o' + (i === act ? ' act' : '') + '" role="option" data-k="' + i + '" aria-selected="' + (x.o === cur) + '"' + (x.dis ? ' disabled' : '') + '><span>' + esc(x.label) + '</span></button>'; });
        if (!list.length) h = '<div class="xcs-none">No match</div>'; if (list.length > shown) h += '<button type="button" class="xcs-x xcs-more">Show ' + Math.min(PAGE, list.length - shown).toLocaleString('en-US') + ' more (' + (list.length - shown).toLocaleString('en-US') + ' left)</button>';
        ls.innerHTML = h; ls.querySelectorAll('.xcs-o').forEach(function (b) { var x = list[+b.dataset.k], p = petOf(x.o.value, x.label), c = p && thumb(p); if (c) b.insertBefore(c, b.firstChild); b.onclick = function () { if (x.dis) return; close(); self._pick(x.o); }; });
        var m = ls.querySelector('.xcs-more'); if (m) m.onclick = function () { shown += PAGE; draw(); }; }
      function move(d) { var n = Math.min(list.length, shown); if (!n) return; act = act < 0 ? (d > 0 ? 0 : n - 1) : (act + d + n) % n; ls.querySelectorAll('.xcs-o').forEach(function (b) { b.classList.toggle('act', +b.dataset.k === act); }); var a = ls.querySelector('.xcs-o.act'); if (a) { a.scrollIntoView({ block: 'nearest' }); if (!q) a.focus(); } }
      function key(e) { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && act >= 0 && document.activeElement === q) { e.preventDefault(); var x = list[act]; if (x && !x.dis) { close(); self._pick(x.o); } } else if (e.key === 'Tab') { var f = ov.querySelectorAll('button:not([disabled]),input'); if (f.length && e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (f.length && !e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
        if (ov.isConnected && ov.contains(e.target)) e.stopPropagation(); /* the sheet is modal: page shortcuts (swipe arrows, hovercard keys) must not act behind it */ }
      document.addEventListener('keydown', key, true); ov.addEventListener('click', function (e) { if (e.target === ov) close(); }); ov.querySelector('.xcs-x').onclick = function () { close(); };
      if (q) q.oninput = function () { shown = PAGE; act = -1; draw(); }; draw();
      var ci = list.indexOf(list.filter(function (x) { return x.o === cur; })[0]); if (ci >= 0 && ci < shown) { act = ci; var cb = ls.querySelector('[data-k="' + ci + '"]'); if (cb) { cb.classList.add('act'); cb.scrollIntoView({ block: 'center' }); } }
      setTimeout(function () { if (q) q.focus(); else { var a = ls.querySelector('.xcs-o.act') || ls.querySelector('.xcs-o'); if (a) a.focus(); } }, 30);
      void opener; }
  }
  window.customElements.define('xc-select', XcSelect);
  window.XcSelect = XcSelect;
})();
