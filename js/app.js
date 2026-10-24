// Application Pipeline & In-Dashboard Workflow Orchestrator

// ── Season Date Presets (called from index.html onchange) ──────────────────
function applySeasonPreset(value) {
  const startEl = document.getElementById('start-date-input');
  const endEl   = document.getElementById('end-date-input');
  if (!startEl || !endEl) return;

  const presets = {
    sahel:  { start: '2024-11-01', end: '2025-03-31' },  // Dry season (Sahel)
    med:    { start: '2025-06-01', end: '2025-08-31' },  // Summer (Mediterranean Africa)
    south:  { start: '2024-12-01', end: '2025-02-28' },  // Summer (Southern Africa)
    annual: { start: '2025-01-01', end: '2025-12-31' },  // Full-year
  };

  if (value && presets[value]) {
    startEl.value = presets[value].start;
    endEl.value   = presets[value].end;
  }
}

// ── Light / Dark theme (persisted) ─────────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const paint = () => {
    const dark = root.classList.contains('dark-theme');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
    return dark;
  };
  paint();
  if (!btn) return;
  btn.addEventListener('click', () => {
    root.classList.toggle('dark-theme');
    const dark = paint();
    try { localStorage.setItem('uhi-theme', dark ? 'dark' : 'light'); } catch (e) {}
    if (typeof syncBasemapToTheme === 'function') syncBasemapToTheme(dark);
    if (typeof refreshResultsTheme === 'function') refreshResultsTheme();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  const searchBtn = document.getElementById('search-scenes-btn');
  const sceneSelect = document.getElementById('scene-select');
  const runBtn = document.getElementById('run-sim-btn');
  const loadingOverlay = document.getElementById('loading-overlay');
  const progressFill = document.getElementById('progress-fill');
  const pipelineStepText = document.getElementById('pipeline-step-text');

  // Results Window Elements
  const resultsWindow = document.getElementById('results-window');
  const closeWindowBtn = document.getElementById('close-results-window');
  const minimizeWindowBtn = document.getElementById('minimize-results-window');
  const maximizeWindowBtn = document.getElementById('maximize-results-window');
  const floatingResultsBtn = document.getElementById('floating-results-btn');

  // 1. Scene Search Simulation
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      searchBtn.innerText = 'Searching STAC...';
      searchBtn.disabled = true;

      const satSelect = document.getElementById('satellite-select');
      const cloudSlider = document.getElementById('cloud-slider');
      const sat = satSelect ? satSelect.value : 'Landsat 8/9';
      const maxCloud = cloudSlider ? parseFloat(cloudSlider.value) : 20;

      setTimeout(() => {
        searchBtn.innerText = '🔍 Search Scenes';
        searchBtn.disabled = false;

        let prefix = "LC09_L2SP";
        let res = "30m";
        if (sat.includes("Sentinel")) {
          prefix = "S2A_MSIL2A";
          res = "10/20m";
        } else if (sat.includes("MODIS")) {
          prefix = "MOD11A1";
          res = "1000m";
        }

        const c1 = (Math.random() * (maxCloud * 0.4)).toFixed(1);
        const c2 = (Math.random() * maxCloud).toFixed(1);
        const c3 = (Math.random() * (maxCloud * 0.8)).toFixed(1);

        sceneSelect.innerHTML = `
          <option value="scene1">2025-08-14 | ${prefix} | Cloud: ${c1}% (${res})</option>
          <option value="scene2">2025-07-29 | ${prefix} | Cloud: ${c2}% (${res})</option>
          <option value="scene3">2025-07-13 | ${prefix} | Cloud: ${c3}% (${res})</option>
        `;
        sceneSelect.disabled = false;
      }, 300);
    });
  }

  // 2. Run Simulation Execution (In-Dashboard, Contour Preserved!)
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const geojsonStr = sessionStorage.getItem('aoi_geojson');
      if (!geojsonStr) {
        alert("Please draw an Area of Interest (AOI) on the map or upload a GeoJSON/Shapefile first.");
        return;
      }

      if (!sceneSelect || sceneSelect.value === '') {
        alert("Please search and select a satellite scene first.");
        return;
      }

      // Save selected scene string
      const selectedOption = sceneSelect.options[sceneSelect.selectedIndex];
      sessionStorage.setItem('sim_scene', selectedOption.text);

      // Show high-tech processing HUD
      if (loadingOverlay) loadingOverlay.classList.add('active');

      const stages = [
        { pct: 15, msg: "Connecting to AWS STAC Catalog & Querying Multi-Spectral Tiles..." },
        { pct: 35, msg: "Calibrating Radiometric Thermal Infrared (TIRS Band 10)..." },
        { pct: 55, msg: "Applying Cloud & Cirrus Shadow Mask (QA_PIXEL)..." },
        { pct: 75, msg: "Computing Fractional Vegetation Cover & Split-Window LST..." },
        { pct: 90, msg: "Extracting Hotspot Clusters (μ + 2σ) & Spatial Variance..." },
        { pct: 100, msg: "Statistical Analysis Completed Successfully!" }
      ];

      let currentStage = 0;

      const advancePipeline = () => {
        if (currentStage < stages.length) {
          const s = stages[currentStage];
          if (progressFill) progressFill.style.width = `${s.pct}%`;
          if (pipelineStepText) pipelineStepText.innerText = s.msg;
          currentStage++;
          setTimeout(advancePipeline, 220);
        } else {
          // Completed: Finish simulation in-dashboard!
          setTimeout(() => {
            if (loadingOverlay) loadingOverlay.classList.remove('active');

            // 1. Render spatial thermal raster on map inside the preserved AOI contour
            if (typeof renderSimulationLayersOnMap === 'function') {
              renderSimulationLayersOnMap(geojsonStr);
            }

            // 2. Generate simulated data and open In-Dashboard Results Window
            const simData = {
              meanLst: (37.5 + Math.random() * 2).toFixed(1),
              maxLst: (46.8 + Math.random() * 2).toFixed(1),
              uhiIntensity: (5.8 + Math.random() * 1.5).toFixed(1),
              hotspotArea: (16.5 + Math.random() * 4).toFixed(1),
              hotspotPct: 12.9,
              lst: [3, 8, 16, 32, 54, 88, 118, 142, 126, 94, 65, 42, 28, 16, 9, 4, 2, 1, 0, 0],
              uhi: [12, 25, 48, 65, 58, 41, 25, 12, 5],
              ndbi: [15, 38, 62, 98, 135, 88, 42, 18],
              ndvi: [20, 58, 94, 118, 85, 48, 22, 9],
              urbanLst: (38.2 + Math.random() * 1.5).toFixed(1),
              ruralLst: (32.1 + Math.random() * 1).toFixed(1)
            };
            sessionStorage.setItem('sim_data', JSON.stringify(simData));

            if (typeof renderResultsWindow === 'function') {
              renderResultsWindow(simData);
            }

            // 3. Keep floating results button accessible
            if (floatingResultsBtn) {
              floatingResultsBtn.style.display = 'flex';
            }
          }, 300);
        }
      };

      advancePipeline();
    });
  }

  // 3. Results Window Controls
  if (closeWindowBtn && resultsWindow) {
    closeWindowBtn.addEventListener('click', () => {
      resultsWindow.classList.remove('active');
      if (floatingResultsBtn) floatingResultsBtn.style.display = 'flex';
    });
  }

  if (minimizeWindowBtn && resultsWindow) {
    minimizeWindowBtn.addEventListener('click', () => {
      resultsWindow.classList.toggle('minimized');
      resultsWindow.classList.remove('maximized');
    });
  }

  if (maximizeWindowBtn && resultsWindow) {
    maximizeWindowBtn.addEventListener('click', () => {
      resultsWindow.classList.toggle('maximized');
      resultsWindow.classList.remove('minimized');
    });
  }

  if (floatingResultsBtn && resultsWindow) {
    floatingResultsBtn.addEventListener('click', () => {
      resultsWindow.classList.remove('minimized');
      resultsWindow.classList.add('active');
      floatingResultsBtn.style.display = 'none';
    });
  }
});
