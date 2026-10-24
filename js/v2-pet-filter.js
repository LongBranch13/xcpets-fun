/* Shared pet filter drawer (UI only). One component for the Spam City Games binder / My listings / sell picker (js/v2-sales.js) and the
 * pet-gift batch + swap pickers (js/v2-gift.js). Matching + sorting live in V2Rules.petFilter (pure, tested in tools/pet-sales-test.js).
 * Filters persist per browser session (sessionStorage, one key per screen). Phone: everything sits in one "Filters" drawer button. */
(function () {
  var V = window.V2Rules; if (!V || !V.petFilter) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var K = 'xcpets-pf-';
  function load(key) { try { return JSON.parse(sessionStorage.getItem(K + key) || '{}') || {}; } catch (e) { return {}; } }
  function save(key, f) { try { sessionStorage.setItem(K + key, JSON.stringify(f)); } catch (e) { } }
  var TL = V.TIER_LABELS || ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function sel(id, cur, list, all) { return '<select data-pf="' + id + '">' + '<option value="">' + (all || 'All') + '</option>' + list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(cur == null ? '' : cur) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>'; }
  function num(id, cur, ph) { return '<input type="number" min="0" data-pf="' + id + '" value="' + esc(cur == null ? '' : cur) + '" placeholder="' + esc(ph) + '">'; }
  var LBL = { sp: 'Species', tier: 'Rarity', st: 'Stage', badge: 'Badge', cur: 'Currency', min: 'Cost from', max: 'Cost to', pw: 'Power at least', bl: 'Breeds left at least', gear: 'Gear', buy: 'Buyable', state: 'Status', sort: 'Sort' };
  /** html(f, fields, o) o = { species: [[id,label]], count, total, title } */
  function html(f, fields, o) { o = o || {}; var on = fields.filter(function (k) { return k !== 'sort' && f[k] !== undefined && f[k] !== ''; }).length, h = '';
    fields.forEach(function (k) { var c = f[k], in_ = '';
      if (k === 'sp') in_ = sel(k, c, o.species || []); else if (k === 'tier') in_ = sel(k, c, TL.map(function (t, i) { return [String(i), t]; }).concat([['M', 'Mythic']]));
      else if (k === 'st') in_ = sel(k, c, (V.STAGE_NAMES || []).map(function (t, i) { return [String(i), t]; }));
      else if (k === 'badge') in_ = sel(k, c, [['om', (V.OLD_MONEY_LABEL || 'Old Money') + ' only'], ['hyb', 'Hybrids only']], 'Any');
      else if (k === 'cur') in_ = sel(k, c, [['XCPETS', 'XCPETS'], ['XCP', 'XCP']], 'Both');
      else if (k === 'min' || k === 'max') in_ = num(k, c, f.cur === 'XCP' ? 'XCP' : f.cur === 'XCPETS' ? 'XCPETS' : 'XCPETS or XCP');
      else if (k === 'pw' || k === 'bl') in_ = num(k, c, 'any');
      else if (k === 'gear') in_ = sel(k, c, [['1', 'Wears gear']], 'Any');
      else if (k === 'buy') in_ = sel(k, c, [['1', 'Buyable now (fills first)']], 'Any');
      else if (k === 'state') in_ = sel(k, c, [['open', 'Active'], ['expired', 'Expired'], ['sold', 'Sold'], ['void', 'Ended (void)']], 'All');
      else if (k === 'sort') in_ = sel(k, c, [['cost', 'Cost: low first'], ['-cost', 'Cost: high first'], ['power', 'Power'], ['new', 'Newest'], ['rarity', 'Rarity']], 'Default');
      h += '<label><span>' + LBL[k] + '</span>' + in_ + '</label>'; });
    return '<details class="pf"' + (f._open ? ' open' : '') + '><summary>Filters' + (on ? ' · ' + on + ' on' : '') + (o.count != null ? ' · showing ' + o.count + (o.total != null ? ' of ' + o.total : '') : '') + '</summary><div class="pf-grid">' + h +
      '</div>' + (on ? '<button type="button" class="pf-clear" data-pfclear>Clear filters</button>' : '') + '</details>'; }
  /** bind(root, f, key, redraw): wires the drawer in root; every change saves f and calls redraw(f). */
  function bind(root, f, key, redraw) { if (!root) return; var d = root.querySelector('details.pf'); if (!d) return;
    d.addEventListener('toggle', function () { f._open = d.open; save(key, f); });
    d.querySelectorAll('[data-pf]').forEach(function (el) { el.addEventListener('change', function () { var k = el.getAttribute('data-pf'); if (el.value === '') delete f[k]; else f[k] = el.value; f._open = true; save(key, f); redraw(f); }); });
    var c = d.querySelector('[data-pfclear]'); if (c) c.onclick = function () { Object.keys(f).forEach(function (k) { if (k !== '_open') delete f[k]; }); save(key, f); redraw(f); }; }
  function species(pets) { var m = {}; pets.forEach(function (p) { if (!m[p.species]) { try { m[p.species] = V.speciesLabel(p.species); } catch (e) { m[p.species] = p.species; } } }); return Object.keys(m).sort().map(function (k) { return [k, m[k]]; }); }
  if (typeof document !== 'undefined' && !document.getElementById('pfCss')) { var st = document.createElement('style'); st.id = 'pfCss';
    st.textContent = '.pf{margin:8px 0;border:3px solid #E8B33A;background:#100E14;color:#FAFAF5;padding:0}.pf summary{cursor:pointer;padding:8px 10px;font:10px "Press Start 2P",monospace}' +
      '.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 12px;padding:4px 10px 10px}.pf label{display:flex;flex-direction:column;font-size:12px;gap:2px}.pf select,.pf input{font:inherit;padding:4px;width:100%;box-sizing:border-box}' +
      '.pf-clear{margin:0 10px 10px;font:inherit;cursor:pointer}@media (max-width:640px){.pf-grid{grid-template-columns:1fr 1fr}}' +
      '.om-badge{display:inline-block;background:#1d3b1f;color:#ffe08a;border:2px solid #E8B33A;padding:1px 5px;font-size:11px;font-weight:700;white-space:nowrap;border-radius:3px}';
    document.head.appendChild(st); }
  /** badge(p): the Old Money chip (display only) or ''. */
  function badge(p) { return V.oldMoney && V.oldMoney(p) ? '<span class="om-badge" title="Bred while breeding cost 690">' + esc(V.OLD_MONEY_LABEL) + '</span>' : ''; }
  window.V2PetFilter = { load: load, save: save, html: html, bind: bind, species: species, badge: badge };
})();
