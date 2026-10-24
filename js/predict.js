/* ==========================================================================
   AfricaHub – AI Heat Prediction & Cooling Scenarios
   --------------------------------------------------------------------------
   Adds, inside the results window:
     1. Heat Stress Zones (5 classes) + continuous LST prediction on the map
     2. Driver analysis (permutation importance, SHAP-style direction)
     3. Cooling Scenario Simulator + budget-constrained optimiser
     4. Model & data-source card, CSV export of predictions

   IMPORTANT – how the numbers are produced:
   This front-end has no satellite back-end. For the area of interest it builds
   a synthetic, spatially coherent feature grid (NDVI, NDBI, air temperature,
   elevation, slope, population density), trains a ridge-regression SURROGATE
   in the browser and evaluates it on a hold-out split. R² / RMSE shown are
   those of this surrogate on synthetic data. The production pipeline
   (Random Forest on a 100 m grid from Landsat / Sentinel-2 / ERA5 / SRTM /
   WorldPop) runs in the Python back-end; wire its output into
   PredictionEngine.run() to replace the synthetic grid.
   ========================================================================== */

const PredictionEngine = (() => {

  /* ------------------------------------------------------------ config -- */
  const FEATURES = [
    { key: 'ndvi',  label: 'NDVI (vegetation)',    src: 'Sentinel-2' },
    { key: 'ndbi',  label: 'NDBI (built-up)',      src: 'Sentinel-2' },
    { key: 'air',   label: 'Air temperature',      src: 'ERA5-Land' },
    { key: 'elev',  label: 'Elevation',            src: 'SRTM' },
    { key: 'slope', label: 'Slope',                src: 'SRTM' },
    { key: 'pop',   label: 'Population density',   src: 'WorldPop' },
  ];
  const CLASSES = [
    { name: 'Cool',           color: '#2563eb' },
    { name: 'Mild',           color: '#22d3ee' },
    { name: 'Moderate',       color: '#facc15' },
    { name: 'High stress',    color: '#f97316' },
    { name: 'Extreme stress', color: '#ef4444' },
  ];
  const Z_CUTS = [-1.0, -0.4, 0.4, 1.0];       // class borders, in σ around the baseline mean
  const HOT_CLASS = 3;                          // classes >= 3 count as "heat-stressed"

  let S = null;            // current analysis state
  let overlay = null;      // Leaflet layer group with the prediction overlay
  let legend = null;       // Leaflet legend control for the overlay

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (v, d = 1) => Number(v).toFixed(d);

  /* ------------------------------------------------------ seeded random -- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeField(rng) {
    const p = Array.from({ length: 4 }, () => rng() * 6.28), f = Array.from({ length: 4 }, () => 2 + rng() * 5);
    return (x, y) => (Math.sin(x * f[0] + p[0]) * Math.cos(y * f[1] + p[1]) + 0.6 * Math.sin((x + y) * f[2] + p[2]) + 0.4 * Math.cos((x - y) * f[3] + p[3])) / 2;
  }

  /* ----------------------------------------------------- grid + dataset -- */
  function buildGrid(aoi) {
    const feat = aoi.features ? aoi.features[0] : aoi;
    const { cells, cellSize, bbox } = buildAoiGrid(feat);          // same fine grid as the thermal overlay (js/map.js)
    return { cells, cs: cellSize, bbox };
  }

  function synthesise(cells, bbox, seedKey, meanLst) {
    const rng = mulberry32(hashStr(seedKey));
    const F = [makeField(rng), makeField(rng), makeField(rng), makeField(rng), makeField(rng)];
    const w = bbox[2] - bbox[0] || 1, h = bbox[3] - bbox[1] || 1;
    const baseAir = meanLst - 6;
    const rows = cells.map(c => {
      const ring = c.geometry.coordinates[0];
      const lon = ring.slice(0, 4).reduce((s, p) => s + p[0], 0) / 4, lat = ring.slice(0, 4).reduce((s, p) => s + p[1], 0) / 4;
      const x = (lon - bbox[0]) / w, y = (lat - bbox[1]) / h;
      const d = Math.hypot(x - 0.5, y - 0.5) * 1.6;
      const u = clamp(0.9 - d + 0.3 * F[0](x, y) + 0.06 * (rng() - 0.5), 0.02, 1);     // urban intensity
      const ndvi = clamp(0.62 - 0.55 * u + 0.08 * F[1](x, y) + 0.04 * (rng() - 0.5), -0.05, 0.85);
      const ndbi = clamp(-0.25 + 0.55 * u + 0.05 * F[2](x, y) + 0.03 * (rng() - 0.5), -0.4, 0.5);
      const air  = baseAir + 1.2 * u + 0.6 * F[3](x, y);
      const elev = 60 + 110 * (F[2](x, y) + 1);
      const slope = 0.8 + 6 * Math.abs(F[4](x, y));
      const pop  = 22000 * u * u * (0.6 + 0.4 * (F[4](x, y) + 1) / 2);                 // people / km²
      const lst  = 24 + 10 * ndbi - 9 * ndvi + 0.35 * (air - 30) - 0.004 * (elev - 100) + 0.12 * slope + 0.8 * (pop / 22000) + 0.35 * (rng() - 0.5) * 2;
      return { lon, lat, ndvi, ndbi, air, elev, slope, pop, lst };
    });
    const shift = meanLst - rows.reduce((s, r) => s + r.lst, 0) / rows.length;           // align with the analysis' mean LST
    rows.forEach(r => { r.lst += shift; });
    return rows;
  }

  /* ----------------------------------------- ridge regression surrogate -- */
  function solve(A, b) {                                  // Gaussian elimination with partial pivoting
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      [M[i], M[p]] = [M[p], M[i]];
      for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]; x[i] = s / M[i][i]; }
    return x;
  }
  const vec = r => FEATURES.map(f => r[f.key]);

  function train(rows, rng) {
    const idx = rows.map((_, i) => i).sort(() => rng() - 0.5);
    const nTrain = Math.floor(rows.length * 0.7);
    const tr = idx.slice(0, nTrain).map(i => rows[i]), te = idx.slice(nTrain).map(i => rows[i]);
    const k = FEATURES.length;
    const mean = Array(k).fill(0), sd = Array(k).fill(0);
    tr.forEach(r => vec(r).forEach((v, j) => mean[j] += v / tr.length));
    tr.forEach(r => vec(r).forEach((v, j) => sd[j] += (v - mean[j]) ** 2 / tr.length));
    sd.forEach((v, j) => sd[j] = Math.sqrt(v) || 1);
    const yMean = tr.reduce((s, r) => s + r.lst, 0) / tr.length;
    const Z = tr.map(r => vec(r).map((v, j) => (v - mean[j]) / sd[j]));
    const A = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => Z.reduce((s, z) => s + z[a] * z[b], 0) + (a === b ? 1e-3 * tr.length : 0)));
    const rhs = Array.from({ length: k }, (_, a) => Z.reduce((s, z, i) => s + z[a] * (tr[i].lst - yMean), 0));
    const beta = solve(A, rhs);
    const model = { mean, sd, beta, yMean, predict(x) { let y = yMean; for (let j = 0; j < k; j++) y += beta[j] * (x[j] - mean[j]) / sd[j]; return y; } };

    const rmseOf = rowsX => Math.sqrt(rowsX.reduce((s, r) => s + (model.predict(vec(r)) - r.lst) ** 2, 0) / rowsX.length);
    const rmse = rmseOf(te);
    const teMean = te.reduce((s, r) => s + r.lst, 0) / te.length;
    const sst = te.reduce((s, r) => s + (r.lst - teMean) ** 2, 0), sse = te.reduce((s, r) => s + (model.predict(vec(r)) - r.lst) ** 2, 0);
    const r2 = 1 - sse / sst;

    // permutation importance on the hold-out set (RMSE increase when a feature is shuffled)
    const imp = FEATURES.map((f, j) => {
      let inc = 0;
      for (let rep = 0; rep < 5; rep++) {
        const col = te.map(r => r[f.key]).sort(() => rng() - 0.5);
        const e = Math.sqrt(te.reduce((s, r, i) => { const x = vec(r); x[j] = col[i]; return s + (model.predict(x) - r.lst) ** 2; }, 0) / te.length);
        inc += (e - rmse) / 5;
      }
      return Math.max(inc, 0);
    });
    const tot = imp.reduce((a, b) => a + b, 0) || 1;
    return { model, r2, rmse, nTrain, nTest: te.length,
      importance: imp.map((v, j) => ({ ...FEATURES[j], pct: 100 * v / tot, dir: beta[j] >= 0 ? 'warming' : 'cooling' })) };
  }

  /* ---------------------------------------------------- classification -- */
  const classify = (v, mu, sg) => { const z = (v - mu) / sg; let c = 0; while (c < Z_CUTS.length && z > Z_CUTS[c]) c++; return c; };

  /* ------------------------------------------------------- scenarios --- */
  function runScenario(p) {
    const { rows, model, mu, sg, cs } = S, cellKm2 = cs * cs;
    const preds = [], cls = [];
    let hot = 0, popHot = 0;
    rows.forEach((r, i) => {
      const eligible = p.target === 'all' || S.baseCls[i] >= HOT_CLASS;
      const x = vec(r);
      if (eligible) {
        x[0] = Math.min(0.85, r.ndvi + p.canopy * 1.2 * (0.8 - r.ndvi));                // tree canopy / green cover
        x[1] = r.ndbi - p.roof * 0.8 * Math.max(0, r.ndbi + 0.1);                       // cool roofs & reflective surfaces
        x[2] = r.air - p.micro;                                                         // shade, water, ventilation (°C)
      }
      const v = model.predict(x);
      preds.push(v);
      const c = classify(v, mu, sg); cls.push(c);
      if (c >= HOT_CLASS) { hot++; popHot += r.pop * cellKm2; }
    });
    const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
    return { preds, cls, mean, hot, popHot };
  }
  const costOf = p => p.canopy * 100 + p.roof * 50 + p.micro * 20;                      // abstract cost index

  /* -------------------------------------------------------------- main -- */
  function run() {
    const aoiStr = sessionStorage.getItem('aoi_geojson');
    const card = $('pred-card');
    if (!card) return;
    if (!aoiStr || typeof turf === 'undefined') { showEmpty(true); return; }
    const sim = JSON.parse(sessionStorage.getItem('sim_data') || '{}');
    const meanLst = parseFloat(sim.meanLst) || 38.4;
    const key = aoiStr.length + ':' + hashStr(aoiStr) + ':' + meanLst;

    if (!S || S.key !== key) {
      const aoi = JSON.parse(aoiStr);
      const { cells, cs, bbox } = buildGrid(aoi);
      if (cells.length < 50) { showEmpty(true); return; }
      const rows = synthesise(cells, bbox, key, meanLst);
      const rng = mulberry32(hashStr(key) ^ 0x9e3779b9);
      const fit = train(rows, rng);
      const base = rows.map(r => fit.model.predict(vec(r)));
      const mu = base.reduce((a, b) => a + b, 0) / base.length;
      const sg = Math.sqrt(base.reduce((a, b) => a + (b - mu) ** 2, 0) / base.length) || 1;
      const baseCls = base.map(v => classify(v, mu, sg));
      cells.forEach((c, i) => { c.properties = { i }; });
      const areaKm2 = parseFloat(sessionStorage.getItem('aoi_area_km2')) || cells.length * cs * cs;
      S = { key, cells, cs, rows, ...fit, base, mu, sg, baseCls, areaKm2, scenario: null };
    }
    showEmpty(false);
    renderAll();
    updateScenario();
  }

  function showEmpty(empty) {
    const body = $('pred-body'), ph = $('pred-empty');
    if (body) body.style.display = empty ? 'none' : '';
    if (ph) ph.style.display = empty ? '' : 'none';
    const badge = $('pred-badge');
    if (badge) { badge.textContent = empty ? 'Awaiting analysis' : 'Model ready'; badge.classList.toggle('ready', !empty); }
  }

  /* --------------------------------------------------------- rendering -- */
  function renderAll() {
    const meanPred = S.base.reduce((a, b) => a + b, 0) / S.base.length;
    const totalCells = Math.round(S.areaKm2 * 100);                       // 100 m × 100 m = 0.01 km²
    $('pr-k-mean').textContent = `${fmt(meanPred)} °C`;
    $('pr-k-r2').textContent = fmt(S.r2, 3);
    $('pr-k-rmse').textContent = `${fmt(S.rmse, 2)} °C`;
    $('pr-k-cells').textContent = totalCells.toLocaleString();
    renderZones(); renderDrivers(); renderModelCard(totalCells);
  }

  function renderZones() {
    const n = S.baseCls.length, counts = CLASSES.map((_, c) => S.baseCls.filter(x => x === c).length);
    $('pr-zones').innerHTML = CLASSES.map((c, i) => {
      const pct = 100 * counts[i] / n, km2 = S.areaKm2 * counts[i] / n;
      return `<div class="zone-row"><span class="zone-dot" style="background:${c.color}"></span><span class="zone-name">${c.name}</span>
        <span class="zone-bar"><i style="width:${pct}%;background:${c.color}"></i></span>
        <span class="zone-val">${fmt(pct)}% · ${fmt(km2)} km²</span></div>`;
    }).join('');
    const hotPct = 100 * (counts[3] + counts[4]) / n;
    $('pr-zone-note').textContent = `${fmt(hotPct)}% of the area falls in High or Extreme heat-stress classes (borders at μ−1σ, μ−0.4σ, μ+0.4σ, μ+1σ of predicted LST).`;
  }

  function renderDrivers() {
    const imp = [...S.importance].sort((a, b) => b.pct - a.pct);
    const c = themeColors();
    createOrUpdateChart('prDriversChart', 'bar', {
      labels: imp.map(f => f.label),
      datasets: [{ data: imp.map(f => +f.pct.toFixed(1)), borderRadius: 6,
        backgroundColor: imp.map(f => f.dir === 'warming' ? '#f97316' : '#22d3ee') }]
    }, {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: true, text: 'Driver importance (% of explained error, permutation)', color: c.text },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.x}% · ${imp[ctx.dataIndex].dir} effect` } } },
      scales: { x: { ticks: { color: c.muted }, grid: { color: c.grid } }, y: { ticks: { color: c.text }, grid: { display: false } } }
    });
    const top = imp.slice(0, 3).map(f => `<li><b>${f.label}</b> — ${fmt(f.pct)}% (${f.dir === 'warming' ? '▲ raises' : '▼ lowers'} LST)</li>`).join('');
    $('pr-driver-list').innerHTML = top;
  }

  function renderModelCard(totalCells) {
    $('pr-model-table').innerHTML = `
      <tr><th>Production algorithm</th><td>Random Forest Regressor (Python back-end)</td></tr>
      <tr><th>In-browser surrogate</th><td>Ridge regression · ${S.nTrain} train / ${S.nTest} hold-out cells</td></tr>
      <tr><th>Target</th><td>Land Surface Temperature (°C)</td></tr>
      <tr><th>Grid resolution</th><td>100 m × 100 m · ${totalCells.toLocaleString()} cells in this AOI</td></tr>
      <tr><th>Hold-out R² / RMSE</th><td>${fmt(S.r2, 3)} / ${fmt(S.rmse, 2)} °C <small>(synthetic grid)</small></td></tr>
      <tr><th>Features</th><td>${FEATURES.map(f => f.label.split(' (')[0]).join(', ')}</td></tr>`;
  }

  /* ------------------------------------------------------ scenario UI --- */
  function readParams() {
    return { canopy: +$('pr-s-canopy').value / 100, roof: +$('pr-s-roof').value / 100, micro: +$('pr-s-micro').value / 10,
             target: $('pr-s-target').value, budget: +$('pr-s-budget').value };
  }
  function updateScenario() {
    if (!S) return;
    const p = readParams();
    $('pr-v-canopy').textContent = `${Math.round(p.canopy * 100)} %`;
    $('pr-v-roof').textContent = `${Math.round(p.roof * 100)} %`;
    $('pr-v-micro').textContent = `${fmt(p.micro)} °C`;
    $('pr-v-budget').textContent = Math.round(p.budget);
    const res = runScenario(p); S.scenario = res;
    const baseMean = S.base.reduce((a, b) => a + b, 0) / S.base.length;
    const baseHot = S.baseCls.filter(c => c >= HOT_CLASS).length;
    const basePop = S.rows.reduce((s, r, i) => s + (S.baseCls[i] >= HOT_CLASS ? r.pop * S.cs * S.cs : 0), 0);
    const d = res.mean - baseMean;
    $('pr-r-delta').textContent = `${d <= 0 ? '' : '+'}${fmt(d, 2)} °C`;
    $('pr-r-mean').textContent = `${fmt(baseMean)} → ${fmt(res.mean)} °C`;
    $('pr-r-hot').textContent = `${baseHot} → ${res.hot} cells (${baseHot ? fmt(100 * (baseHot - res.hot) / baseHot, 0) : 0}% fewer)`;
    $('pr-r-pop').textContent = `${Math.round(basePop).toLocaleString()} → ${Math.round(res.popHot).toLocaleString()}`;
    $('pr-r-cost').textContent = `${Math.round(costOf(p))} / ${Math.round(p.budget)}`;
    $('pr-r-cost').classList.toggle('over', costOf(p) > p.budget);

    const n = S.baseCls.length, c = themeColors();
    createOrUpdateChart('prScenarioChart', 'bar', {
      labels: CLASSES.map(x => x.name),
      datasets: [
        { label: 'Baseline', data: CLASSES.map((_, k) => +(100 * S.baseCls.filter(x => x === k).length / n).toFixed(1)), backgroundColor: 'rgba(148,163,184,0.7)', borderRadius: 5 },
        { label: 'With interventions', data: CLASSES.map((_, k) => +(100 * res.cls.filter(x => x === k).length / n).toFixed(1)), backgroundColor: CLASSES.map(x => x.color), borderRadius: 5 }
      ]
    }, {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text } }, title: { display: true, text: 'Share of area per heat-stress class (%)', color: c.text } },
      scales: { x: { ticks: { color: c.muted }, grid: { display: false } }, y: { ticks: { color: c.muted }, grid: { color: c.grid } } }
    });
    if ($('pr-map-mode').value === 'scenario') paintMap('scenario');
  }

  function optimise() {
    if (!S) return;
    const base = readParams(); let best = null;
    for (let cn = 0; cn <= 40; cn += 5) for (let rf = 0; rf <= 60; rf += 10) for (let mc = 0; mc <= 20; mc += 5) {
      const p = { ...base, canopy: cn / 100, roof: rf / 100, micro: mc / 10 };
      if (costOf(p) > base.budget) continue;
      const m = runScenario(p).mean;
      if (!best || m < best.m) best = { m, p };
    }
    if (!best) return;
    $('pr-s-canopy').value = Math.round(best.p.canopy * 100);
    $('pr-s-roof').value = Math.round(best.p.roof * 100);
    $('pr-s-micro').value = Math.round(best.p.micro * 10);
    updateScenario();
  }

  /* ------------------------------------------------------------- map ---- */
  function thermal(v, lo, hi) {                                     // same blue → red ramp as the thermal overlay
    const r = clamp((v - lo) / (hi - lo), 0, 1);
    return r < 0.5 ? `rgb(${Math.round(510 * r)},${Math.round(360 * r)},${Math.round(255 * (1 - 2 * r))})` : `rgb(255,${Math.round(180 * (1 - 2 * (r - 0.5)))},0)`;
  }
  function paintMap(mode) {
    if (!S || typeof map === 'undefined' || !map) return;
    if (overlay) { overlay.remove(); overlay = null; }
    if (legend) { legend.remove(); legend = null; }
    if (mode === 'off') return;
    const vals = mode === 'scenario' ? S.scenario.preds : S.base;
    const cls = mode === 'scenario' ? S.scenario.cls : S.baseCls;
    const lo = Math.min(...S.base), hi = Math.max(...S.base);
    overlay = L.geoJSON(S.cells, {
      renderer: L.canvas({ padding: 0.5 }),
      style: f => {
        const i = f.properties.i;
        return { fillColor: mode === 'continuous' ? thermal(vals[i], lo, hi) : CLASSES[cls[i]].color, fillOpacity: 0.78, weight: 0, stroke: false };
      },
      onEachFeature: (f, layer) => {
        const i = f.properties.i, r = S.rows[i];
        layer.bindTooltip(`<b>${fmt(vals[i])} °C</b> · ${CLASSES[cls[i]].name}<br>NDVI ${fmt(r.ndvi, 2)} · NDBI ${fmt(r.ndbi, 2)}<br>Pop. ${Math.round(r.pop).toLocaleString()}/km²`, { sticky: true });
      }
    }).addTo(map);
    if (typeof drawnItems !== 'undefined' && drawnItems) drawnItems.bringToFront();
    legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend-hud');
      d.innerHTML = mode === 'continuous'
        ? `<div class="legend-title">Predicted LST (°C)</div><div class="legend-scale"><span>${fmt(lo, 0)}°C</span><div class="legend-bar"></div><span class="legend-max">${fmt(hi, 0)}°C</span></div>`
        : `<div class="legend-title">${mode === 'scenario' ? 'Heat stress · with interventions' : 'Heat stress zones'}</div>` +
          CLASSES.map(c => `<div class="zone-legend-row"><i style="background:${c.color}"></i>${c.name}</div>`).join('');
      return d;
    };
    legend.addTo(map);
  }

  /* ------------------------------------------------------------- CSV ---- */
  function exportCsv() {
    if (!S) return;
    const head = ['lon', 'lat', ...FEATURES.map(f => f.key), 'lst_synthetic_c', 'lst_predicted_c', 'heat_class', 'scenario_lst_c', 'scenario_class'];
    const lines = S.rows.map((r, i) => [r.lon.toFixed(5), r.lat.toFixed(5), ...FEATURES.map(f => r[f.key].toFixed(3)), r.lst.toFixed(2), S.base[i].toFixed(2), CLASSES[S.baseCls[i]].name, S.scenario.preds[i].toFixed(2), CLASSES[S.scenario.cls[i]].name].join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    if (typeof saveAs === 'function') saveAs(blob, 'uhi_predictions.csv');
  }

  /* -------------------------------------------------------------- init -- */
  function init() {
    if (!$('pred-card')) return;
    document.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-ptab]').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('[data-ppane]').forEach(p => p.classList.toggle('active', p.dataset.ppane === b.dataset.ptab));
      if (S) { renderDrivers(); updateScenario(); }         // charts size correctly once their pane is visible
    }));
    ['pr-s-canopy', 'pr-s-roof', 'pr-s-micro', 'pr-s-budget', 'pr-s-target'].forEach(id => $(id).addEventListener('input', updateScenario));
    $('pr-optimise').addEventListener('click', optimise);
    $('pr-reset').addEventListener('click', () => { $('pr-s-canopy').value = 0; $('pr-s-roof').value = 0; $('pr-s-micro').value = 0; updateScenario(); });
    $('pr-map-mode').addEventListener('change', e => paintMap(e.target.value));
    $('pr-export').addEventListener('click', exportCsv);
    showEmpty(true);
  }

  return { init, run, paintMap };
})();

/* Hook: whenever the results window is (re)rendered, refresh the prediction block as well. */
(function hookResults() {
  const original = window.renderResultsWindow;
  if (typeof original !== 'function') return;
  window.renderResultsWindow = function () {
    const out = original.apply(this, arguments);
    try { PredictionEngine.run(); } catch (e) { console.error('Prediction module error:', e); }
    return out;
  };
})();

document.addEventListener('DOMContentLoaded', PredictionEngine.init);

/* Clearing the AOI also clears the overlay */
(function hookReset() {
  const original = window.resetAOI;
  if (typeof original !== 'function') return;
  window.resetAOI = function () {
    const sel = document.getElementById('pr-map-mode');
    if (sel) { sel.value = 'off'; PredictionEngine.paintMap('off'); }
    return original.apply(this, arguments);
  };
})();
