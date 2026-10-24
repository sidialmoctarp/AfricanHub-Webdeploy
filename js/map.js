// Enterprise GIS Map & Geospatial Layer Engine for UHI Analytics

let map;
let drawControl;
let drawnItems;
let simulationLayerGroup;
let layerControl;
let legendControl;

const OPENWEATHER_API_KEY = '79e929462cb11758235cff37ac18493a';
const cartoApiKey = 'cb1_3hoy_1_47b9b0ed893888ee453fd06b';

function fetchWeatherByCoordinates(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  return fetch(url)
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Weather request failed');
      return data;
    })
    .catch(err => {
      console.warn('OpenWeatherMap warning:', err);
      return null;
    });
}

const basemaps = {
  "Dark Canvas (CARTO)": L.tileLayer(`https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${cartoApiKey}`, {
    attribution: '&copy; OpenStreetMap & CARTO', maxZoom: 20
  }),
  "ESRI Satellite World": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; USDA, USGS, GeoEye', maxZoom: 18
  }),
  "Light Canvas (CARTO)": L.tileLayer(`https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${cartoApiKey}`, {
    attribution: '&copy; OpenStreetMap & CARTO', maxZoom: 20
  }),
  "Streets (OSM)": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19
  })
};

// Contour styling for drawn / uploaded AOI
const AOI_CONTOUR_STYLE = {
  color: '#0284c7',
  weight: 2.5,
  dashArray: '6, 6',
  fillColor: 'rgba(2, 132, 199, 0.1)',
  fillOpacity: 0.35
};

function initDashboardMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Initialize map centered at Marrakech default
  map = L.map('map', {
    zoomControl: false
  }).setView([31.6295, -7.9811], 12);

  // Position Zoom control at top-left
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // Set default basemap
  const darkTheme = document.documentElement.classList.contains('dark-theme');
  basemaps[darkTheme ? "Dark Canvas (CARTO)" : "Light Canvas (CARTO)"].addTo(map);

  // Layer control
  layerControl = L.control.layers(basemaps, {}, { position: 'topright', collapsed: true }).addTo(map);

  // FeatureGroup for user AOI (draw / upload)
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // FeatureGroup for thermal simulation heatmap overlays
  simulationLayerGroup = new L.FeatureGroup();
  map.addLayer(simulationLayerGroup);

  // Leaflet Draw Control
  drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: AOI_CONTOUR_STYLE
      },
      rectangle: {
        shapeOptions: AOI_CONTOUR_STYLE
      },
      polyline: false,
      circle: false,
      circlemarker: false,
      marker: false
    }
  });
  map.addControl(drawControl);

  // Track cursor coordinates in HUD
  const coordHud = document.getElementById('map-coord-hud');
  map.on('mousemove', (e) => {
    if (coordHud) {
      const lat = e.latlng.lat.toFixed(4);
      const lng = e.latlng.lng.toFixed(4);
      coordHud.innerHTML = `LAT: <span>${lat}°</span> | LON: <span>${lng}°</span> | ZOOM: <span>${map.getZoom()}</span>`;
    }
  });

  // Handle Draw Created
  map.on(L.Draw.Event.CREATED, function (event) {
    drawnItems.clearLayers();
    const layer = event.layer;
    layer.setStyle(AOI_CONTOUR_STYLE);
    drawnItems.addLayer(layer);

    const geojsonData = layer.toGeoJSON();
    sessionStorage.setItem('aoi_geojson', JSON.stringify(geojsonData));
    sessionStorage.removeItem('hotspots_data');
    sessionStorage.removeItem('sim_data');

    updateAoiLocationMetadata(geojsonData);
  });

  // Handle Draw Deleted
  map.on('draw:deleted', function () {
    if (drawnItems.getLayers().length === 0) {
      resetAOI();
    }
  });

  // AOI Mode Switcher (Africa City | Draw | Upload)
  const radios = document.querySelectorAll('input[name="aoi_mode"]');
  const fileInput = document.getElementById('geojson-upload');
  const africaCityContainer = document.getElementById('africa-city-container');

  // ── Helper: apply an African city as the AOI ───────────────────────────
  function applyAfricanCityAOI(cityData) {
    if (!cityData || !cityData.lat) return;

    const { lat, lon, city, country, iso3, bbox, region } = cityData;

    // Fly map to city
    map.flyTo([lat, lon], 11, { animate: true, duration: 1.2 });

    // Build a bounding-box GeoJSON polygon from the city bbox
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const bboxGeoJSON = {
      type: "Feature",
      properties: { name: city, country, iso3, region },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat]
        ]]
      }
    };

    // Render contour on map
    drawnItems.clearLayers();
    const layer = L.geoJSON(bboxGeoJSON, { style: AOI_CONTOUR_STYLE });
    layer.eachLayer(l => drawnItems.addLayer(l));

    // Persist to session for simulation
    sessionStorage.setItem('aoi_geojson', JSON.stringify(bboxGeoJSON));
    sessionStorage.setItem('aoi_name', `${city}, ${country}`);
    sessionStorage.removeItem('hotspots_data');
    sessionStorage.removeItem('sim_data');

    // Update area display
    const aoiAreaEl = document.getElementById('aoi-area');
    if (aoiAreaEl) {
      aoiAreaEl.innerText = `📍 ${city}, ${country} (${iso3}) | ${region}`;
    }

    // Update top weather badge
    fetchWeatherByCoordinates(lat, lon).then(weather => {
      const topWeatherEl = document.getElementById('top-weather-badge');
      if (weather && weather.main && topWeatherEl) {
        topWeatherEl.innerHTML = `🌤️ ${city}: <span>${Math.round(weather.main.temp)}°C</span>`;
        sessionStorage.setItem('aoi_weather', JSON.stringify(weather));
      }
    });
  }

  if (radios.length > 0 && fileInput) {
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = e.target.value;

        // Hide / show Africa city panel
        if (africaCityContainer) {
          africaCityContainer.style.display = mode === 'africa' ? 'block' : 'none';
        }

        if (mode === 'africa') {
          fileInput.style.display = 'none';
          try { map.removeControl(drawControl); } catch (_) {}

          // Apply currently selected African city immediately
          const citySelect = document.getElementById('african-city-select');
          if (citySelect && citySelect.value) {
            const cityKey = citySelect.value;
            fetch('./african_cities.json')
              .then(r => r.json())
              .then(cities => {
                if (cities[cityKey]) applyAfricanCityAOI(cities[cityKey]);
              })
              .catch(() => console.warn('Could not load african_cities.json'));
          }

        } else if (mode === 'upload') {
          fileInput.style.display = 'block';
          try { map.removeControl(drawControl); } catch (_) {}

        } else { // draw
          fileInput.style.display = 'none';
          try { map.addControl(drawControl); } catch (_) {}
        }
      });
    });

    // ── African city select change ─────────────────────────────────────────
    const citySelect = document.getElementById('african-city-select');
    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        const cityKey = e.target.value;
        if (!cityKey) return;
        fetch('./african_cities.json')
          .then(r => r.json())
          .then(cities => {
            if (cities[cityKey]) applyAfricanCityAOI(cities[cityKey]);
          })
          .catch(() => console.warn('Could not load african_cities.json'));
      });
    }

    // ── File upload handler ────────────────────────────────────────────────
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isZip = file.name.toLowerCase().endsWith('.zip');

      const processGeoJSON = (geojson) => {
        if (!geojson || !geojson.type) {
          throw new Error("Invalid GeoJSON geometry structure.");
        }

        drawnItems.clearLayers();
        const layer = L.geoJSON(geojson, { style: AOI_CONTOUR_STYLE });
        layer.eachLayer(l => drawnItems.addLayer(l));
        map.fitBounds(drawnItems.getBounds(), { padding: [40, 40] });

        const geojsonData = drawnItems.toGeoJSON();
        sessionStorage.setItem('aoi_geojson', JSON.stringify(geojsonData));
        sessionStorage.removeItem('hotspots_data');
        sessionStorage.removeItem('sim_data');

        updateAoiLocationMetadata(geojsonData);
      };

      if (isZip) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof shp !== 'undefined') {
            shp(event.target.result).then(processGeoJSON).catch(err => {
              alert("Error parsing zipped Shapefile. Ensure .shp, .shx, and .dbf files are present.");
              console.error(err);
            });
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const geojson = JSON.parse(event.target.result);
            processGeoJSON(geojson);
          } catch (err) {
            alert("Invalid GeoJSON structure.");
          }
        };
        reader.readAsText(file);
      }
    });
  }
}

// Update Location and Weather Metadata for AOI
function updateAoiLocationMetadata(geojsonData) {
  try {
    let areaKm2 = 0;
    if (typeof turf !== 'undefined') {
      const areaM2 = turf.area(geojsonData);
      areaKm2 = (areaM2 / 1000000).toFixed(2);
      sessionStorage.setItem('aoi_area_km2', areaKm2);
    }

    const aoiAreaEl = document.getElementById('aoi-area');
    if (aoiAreaEl) {
      aoiAreaEl.innerText = `Area: ${areaKm2} km² • Resolving...`;
    }

    const center = turf.center(geojsonData);
    const lon = center.geometry.coordinates[0];
    const lat = center.geometry.coordinates[1];

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(async data => {
        let areaName = 'Custom AOI';
        if (data && data.address) {
          areaName = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || 'Selected Area';
        }
        sessionStorage.setItem('aoi_name', areaName);

        const weather = await fetchWeatherByCoordinates(lat, lon);
        let weatherStr = '';
        if (weather && weather.main) {
          weatherStr = ` • ${Math.round(weather.main.temp)}°C (${weather.weather[0].main})`;
          sessionStorage.setItem('aoi_weather', JSON.stringify(weather));
          const topWeatherEl = document.getElementById('top-weather-badge');
          if (topWeatherEl) {
            topWeatherEl.innerHTML = `🌤️ ${areaName}: <span>${Math.round(weather.main.temp)}°C</span>`;
          }
        }

        if (aoiAreaEl) {
          aoiAreaEl.innerText = `Area: ${areaKm2} km² | ${areaName}${weatherStr}`;
        }
      })
      .catch(() => {
        sessionStorage.setItem('aoi_name', 'Selected AOI');
        if (aoiAreaEl) aoiAreaEl.innerText = `Area: ${areaKm2} km²`;
      });
  } catch (err) {
    console.error("Metadata error:", err);
  }
}

// Reset AOI
function resetAOI() {
  if (drawnItems) drawnItems.clearLayers();
  if (simulationLayerGroup) simulationLayerGroup.clearLayers();
  sessionStorage.removeItem('aoi_geojson');
  sessionStorage.removeItem('aoi_name');
  sessionStorage.removeItem('hotspots_data');
  sessionStorage.removeItem('sim_data');

  const aoiAreaEl = document.getElementById('aoi-area');
  if (aoiAreaEl) aoiAreaEl.innerText = 'Selected Area: 0 km²';

  const resultsWindow = document.getElementById('results-window');
  if (resultsWindow) resultsWindow.classList.remove('active');

  const floatingBtn = document.getElementById('floating-results-btn');
  if (floatingBtn) floatingBtn.style.display = 'none';
}

// Render Simulation Raster Grid inside AOI Contour on the main map
// ── Fine square grid over an AOI (shared by the thermal overlay and the AI prediction overlay) ──
// ~70 cells across the AOI diagonal; smaller cell = smaller map "pixels".
const MAP_GRID_DIVISIONS = 70;
const MAP_MIN_CELL_KM = 0.03;

function buildAoiGrid(aoiFeature) {
  const bbox = turf.bbox(aoiFeature);
  const distance = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]), { units: 'kilometers' });
  const cellSize = Math.max(distance / MAP_GRID_DIVISIONS, MAP_MIN_CELL_KM);
  const grid = turf.squareGrid(bbox, cellSize, { units: 'kilometers' });
  // keep cells whose centre lies inside the AOI (much faster than polygon intersection at this resolution)
  const cells = grid.features.filter(f => {
    const r = f.geometry.coordinates[0];
    const cx = (r[0][0] + r[2][0]) / 2, cy = (r[0][1] + r[2][1]) / 2;
    return turf.booleanPointInPolygon(turf.point([cx, cy]), aoiFeature);
  });
  return { cells, cellSize, bbox };
}

function renderSimulationLayersOnMap(geojsonData) {
  if (!map || !geojsonData) return;

  // Clear previous simulation overlays
  if (simulationLayerGroup) simulationLayerGroup.clearLayers();

  const parsedData = typeof geojsonData === 'string' ? JSON.parse(geojsonData) : geojsonData;
  const aoiFeature = parsedData.features ? parsedData.features[0] : parsedData;
  const maskedGridFeatures = buildAoiGrid(aoiFeature).cells;

  function getStandardColor(val, min, max) {
    let ratio = (val - min) / (max - min);
    ratio = Math.max(0, Math.min(1, ratio));
    let r, g, b;
    if (ratio < 0.5) {
      let r_ratio = ratio * 2;
      r = Math.round(0 + 255 * r_ratio);
      g = Math.round(180 * r_ratio);
      b = Math.round(255 * (1 - r_ratio));
    } else {
      let r_ratio = (ratio - 0.5) * 2;
      r = 255;
      g = Math.round(180 * (1 - r_ratio));
      b = 0;
    }
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Create LST Grid Layer
  const lstGridLayer = L.geoJSON(maskedGridFeatures, {
    renderer: L.canvas({ padding: 0.5 }),   // thousands of fine cells: canvas keeps the map responsive
    style: function (feature) {
      const coords = feature.geometry.coordinates[0][0];
      const noise = Math.sin(coords[0] * 120) * Math.cos(coords[1] * 120);
      let val = 35 + (noise * 6.5) + (Math.random() * 1.2);
      return {
        fillColor: getStandardColor(val, 28, 47),
        fillOpacity: 0.72,
        weight: 0,
        stroke: false
      };
    }
  });

  simulationLayerGroup.addLayer(lstGridLayer);

  // Ensure AOI contour boundary stays on top of heatmap
  drawnItems.bringToFront();

  // Add Legend HUD if not already added
  if (!legendControl) {
    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend-hud');
      div.innerHTML = `
        <div class="legend-title">Thermal LST Overlay (°C)</div>
        <div class="legend-scale">
          <span>28°C</span>
          <div class="legend-bar"></div>
          <span class="legend-max">47°C</span>
        </div>
      `;
      return div;
    };
    legendControl.addTo(map);
  }

  // Zoom to fitted AOI
  map.fitBounds(drawnItems.getBounds(), { padding: [50, 50] });
}

// Interactive Zoom to Hotspot from table
function zoomToCoordinates(lat, lon, label) {
  if (!map) return;
  map.flyTo([lat, lon], 14, { duration: 1.2 });
  const popup = L.popup()
    .setLatLng([lat, lon])
    .setContent(`<div style="color: #0f172a; font-family: Inter, sans-serif; font-size: 0.85rem;"><b>${label}</b><br>Lat: ${lat}, Lon: ${lon}</div>`)
    .openOn(map);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('map')) {
    initDashboardMap();
  }
});


// Swap the CARTO basemap to match the light/dark theme (other basemaps are left alone)
function syncBasemapToTheme(isDark) {
  if (!map) return;
  const from = basemaps[isDark ? "Light Canvas (CARTO)" : "Dark Canvas (CARTO)"];
  const to = basemaps[isDark ? "Dark Canvas (CARTO)" : "Light Canvas (CARTO)"];
  if (map.hasLayer(from)) {
    map.removeLayer(from);
    to.addTo(map);
  }
}
