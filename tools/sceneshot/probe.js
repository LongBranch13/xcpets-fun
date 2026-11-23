(async () => { const t0 = Date.now(); while (Date.now() - t0 < 45000 && /Reading/.test((document.getElementById('status') || {}).textContent || '')) await new Promise(r => setTimeout(r, 1000));
  let w = null; try { w = V2Mock.world(); } catch (e) {}
  return JSON.stringify({ status: (document.getElementById('status') || {}).textContent, rows: document.querySelectorAll('#board tr').length, ranked: !!(w && w._ranked), pets: w && w.pets && w.pets.length, waited: Date.now() - t0 }); })()
