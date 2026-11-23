(() => { const w = V2Mock.world(), m = V2UI && V2UI.ME || localStorage.getItem('xcpets-v2-me'); const mine = w.pets.filter(p => p.owner === m); const x = V2Petdex.compute(w, m);
 const own = {}; w.pets.slice(0, 50000).forEach(p => { own[p.owner ? 'o' : 'none'] = (own[p.owner ? 'o' : 'none'] || 0) + 1; });
 return JSON.stringify({ pets: w.pets.length, full: !!w._full, mine: mine.length, sample: Object.keys(w.pets[0] || {}).slice(0, 40), own, got: x.got, total: x.total, rows: x.rows.length, leg: x.legends.length, hyb: x.hybrids.length }); })()
