// In-Dashboard Statistical Analytics & Chart Visualizations

let chartInstances = {};

function createOrUpdateChart(canvasId, type, dataConfig, optionsConfig) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const ctx = canvas.getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: type,
    data: dataConfig,
    options: optionsConfig
  });
}

// Theme-aware chart colours, read from the CSS design tokens
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    text: get('--text-primary'),
    muted: get('--text-muted'),
    grid: get('--chart-grid')
  };
}

// Re-render charts after a light/dark switch
function refreshResultsTheme() {
  const saved = sessionStorage.getItem('sim_data');
  const win = document.getElementById('results-window');
  if (saved && win && win.classList.contains('active')) renderResultsWindow(JSON.parse(saved));
}

function renderResultsWindow(simData) {
  const windowEl = document.getElementById('results-window');
  if (!windowEl) return;

  // Make window active
  windowEl.classList.remove('minimized');
  windowEl.classList.add('active');

  const floatingBtn = document.getElementById('floating-results-btn');
  if (floatingBtn) floatingBtn.style.display = 'none';

  // Fallback / default data generation if not provided
  if (!simData) {
    let saved = sessionStorage.getItem('sim_data');
    if (saved) {
      simData = JSON.parse(saved);
    } else {
      simData = {
        meanLst: 38.4,
        maxLst: 47.2,
        uhiIntensity: 6.1,
        hotspotArea: 18.3,
        hotspotPct: 12.9,
        lst: [2, 5, 12, 25, 45, 80, 110, 140, 120, 90, 60, 40, 25, 15, 8, 4, 2, 1, 0, 0],
        uhi: [14, 28, 45, 62, 55, 38, 22, 11, 4],
        ndbi: [12, 35, 60, 95, 130, 85, 40, 15],
        ndvi: [18, 55, 90, 115, 80, 45, 20, 8],
        urbanLst: 38.4,
        ruralLst: 32.3
      };
      sessionStorage.setItem('sim_data', JSON.stringify(simData));
    }
  }

  // Update Header Info
  const aoiName = sessionStorage.getItem('aoi_name') || 'Selected Area';
  const sceneName = sessionStorage.getItem('sim_scene') || '2025-08-14 | Landsat 9 OLI-2';
  const sceneInfoEl = document.getElementById('scene-info-text');
  if (sceneInfoEl) {
    sceneInfoEl.innerText = `Scene: ${sceneName} • Location: ${aoiName}`;
  }

  // Update KPI Cards
  const kpiMeanEl = document.getElementById('kpi-mean-lst');
  if (kpiMeanEl) kpiMeanEl.innerText = `${simData.meanLst || '38.4'} °C`;

  const kpiMaxEl = document.getElementById('kpi-max-lst');
  if (kpiMaxEl) kpiMaxEl.innerText = `${simData.maxLst || '47.2'} °C`;

  const kpiUhiEl = document.getElementById('kpi-uhi-intensity');
  if (kpiUhiEl) kpiUhiEl.innerText = `+${simData.uhiIntensity || '6.1'} °C`;

  const kpiAreaEl = document.getElementById('kpi-hotspot-area');
  if (kpiAreaEl) kpiAreaEl.innerText = `${simData.hotspotArea || '18.3'} km²`;

  // Chart Global Options
  const colors = themeColors();
  Chart.defaults.font.family = "'Inter', sans-serif";
  const baseChartOptions = (titleText) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: titleText,
        color: colors.text,
        font: { size: 12, weight: '600' }
      }
    },
    scales: {
      x: {
        grid: { color: colors.grid },
        ticks: { color: colors.muted, font: { size: 10 } }
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.muted, font: { size: 10 } }
      }
    }
  });

  // 1. LST Histogram
  createOrUpdateChart(
    'lstHistogram',
    'bar',
    {
      labels: Array.from({ length: 20 }, (_, i) => `${25 + i}°`),
      datasets: [{
        label: 'Pixel Count',
        data: simData.lst,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    baseChartOptions('LST Distribution (°C)')
  );

  // 2. UHI Histogram
  createOrUpdateChart(
    'uhiHistogram',
    'bar',
    {
      labels: Array.from({ length: 9 }, (_, i) => `+${i}°`),
      datasets: [{
        label: 'Pixel Count',
        data: simData.uhi,
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    baseChartOptions('UHI Anomaly Distribution (°C)')
  );

  // 3. NDBI Histogram
  createOrUpdateChart(
    'ndbiHistogram',
    'bar',
    {
      labels: ['-1.0', '-0.5', '0.0', '0.2', '0.4', '0.6', '0.8', '1.0'],
      datasets: [{
        label: 'Impervious Built-up',
        data: simData.ndbi,
        backgroundColor: 'rgba(148, 163, 184, 0.7)',
        borderColor: 'rgba(148, 163, 184, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    baseChartOptions('NDBI (Built-up Index)')
  );

  // 4. NDVI Histogram
  createOrUpdateChart(
    'ndviHistogram',
    'bar',
    {
      labels: ['-0.2', '0.0', '0.2', '0.4', '0.5', '0.6', '0.7', '0.8+'],
      datasets: [{
        label: 'Vegetation Fraction',
        data: simData.ndvi,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    baseChartOptions('NDVI (Vegetation Index)')
  );

  // 5. Urban vs Rural
  createOrUpdateChart(
    'urbanVsRural',
    'bar',
    {
      labels: ['Urban Core LST', 'Rural Reference LST'],
      datasets: [{
        label: 'Temperature (°C)',
        data: [simData.urbanLst, simData.ruralLst],
        backgroundColor: ['rgba(239, 68, 68, 0.75)', 'rgba(13, 148, 136, 0.75)'],
        borderColor: ['#ef4444', '#0d9488'],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    {
      ...baseChartOptions('Urban Core vs. Rural Baseline (°C)'),
      scales: {
        y: { min: 20, grid: { color: colors.grid }, ticks: { color: colors.muted } },
        x: { grid: { display: false }, ticks: { color: colors.text } }
      }
    }
  );

  // Populate Hotspots Table
  populateHotspotTable();

  // Setup AI Tree Recommendations
  setupAiTreeRecommendations(aoiName);
}

function populateHotspotTable() {
  const tbody = document.getElementById('hotspot-table-body');
  if (!tbody) return;

  let hotspots = [];
  const savedHotspots = sessionStorage.getItem('hotspots_data');
  if (savedHotspots) {
    hotspots = JSON.parse(savedHotspots);
  } else {
    let baseLat = 31.63;
    let baseLon = -7.98;
    const aoiGeojsonStr = sessionStorage.getItem('aoi_geojson');
    if (aoiGeojsonStr && typeof turf !== 'undefined') {
      try {
        const aoi = JSON.parse(aoiGeojsonStr);
        const center = turf.center(aoi);
        baseLon = center.geometry.coordinates[0];
        baseLat = center.geometry.coordinates[1];
      } catch (e) {}
    }

    hotspots = [
      { id: 1, area: '4.8', peak: '46.8', lat: (baseLat + 0.008).toFixed(4), lon: (baseLon - 0.005).toFixed(4) },
      { id: 2, area: '3.2', peak: '44.5', lat: (baseLat - 0.006).toFixed(4), lon: (baseLon + 0.007).toFixed(4) },
      { id: 3, area: '2.1', peak: '42.9', lat: (baseLat + 0.004).toFixed(4), lon: (baseLon + 0.009).toFixed(4) }
    ];
    sessionStorage.setItem('hotspots_data', JSON.stringify(hotspots));
  }

  tbody.innerHTML = '';
  hotspots.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>Cluster #${h.id}</b></td>
      <td>${h.area} km²</td>
      <td class="cell-hot">${h.peak} °C</td>
      <td style="font-family: monospace; font-size: 0.8rem;">${h.lat}, ${h.lon}</td>
      <td>
        <button class="btn-locate" onclick="zoomToCoordinates(${h.lat}, ${h.lon}, 'Cluster #${h.id}')">
          📍 Locate
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Region-aware species plan: see js/trees.js (TreeAdvisor)
function setupAiTreeRecommendations(aoiName) {
  TreeAdvisor.setup(aoiName);
}
