/* ==========================================================================
   AfricaHub – region-aware AI Tree Greening Recommendations
   --------------------------------------------------------------------------
   The area of interest is placed in a bioclimatic region from its centroid
   (lat / lon), and a species palette adapted to that region is returned.
   The same profile feeds the results window, the report preview and the DOCX.

   Notes
   - Region assignment is a coarse lat/lon rule set, not a climate model. Users
     can override it in the "Region profile" selector.
   - Cooling values (°C) are indicative local-ambient estimates from the urban
     canopy literature for mature trees; validate with the local forestry
     service before planting.
   ========================================================================== */

const TreeAdvisor = (() => {

  const ZONES = {
    med: {
      label: 'Mediterranean & North African coast',
      climate: 'hot dry summers with mild, wetter winters',
      water: 'Plant in autumn so winter rain establishes roots; drip-irrigate only the first 2–3 summers.',
      watch: 'Avoid dense pine monocultures near housing: resin-rich foliage raises wildfire risk in heat waves.',
      species: [
        ['Olea europaea', 'Olive tree', 2.8, 'Very High', 'Slow', 'Peripheral belts, parks, dry districts'],
        ['Ceratonia siliqua', 'Carob tree', 2.1, 'High', 'Moderate', 'Street planting on degraded soils'],
        ['Quercus ilex', 'Holm oak', 4.1, 'High', 'Slow', 'Central boulevards and large parks'],
        ['Pinus halepensis', 'Aleppo pine', 3.2, 'High', 'Fast', 'Windbreaks and quick canopy on the periphery'],
        ['Tetraclinis articulata', 'Sandarac cypress (thuya)', 2.2, 'Very High', 'Slow', 'Dry slopes and urban edges (native to Morocco/Algeria)'],
        ['Celtis australis', 'European nettle tree', 3.4, 'High', 'Moderate', 'Shaded avenues and squares'],
      ],
    },
    arid: {
      label: 'Saharan & arid desert margins',
      climate: 'very hot, hyper-arid conditions with little or no reliable rainfall',
      water: 'Rely on treated wastewater or drip lines for the first years; group trees to share shade and reduce evaporation.',
      watch: 'Prefer native thorn trees over thirsty ornamentals; avoid high-water species that stress scarce supplies.',
      species: [
        ['Vachellia tortilis', 'Umbrella thorn', 3.0, 'Very High', 'Moderate', 'Wide shade in open spaces, parking areas, periphery'],
        ['Balanites aegyptiaca', 'Desert date', 2.6, 'Very High', 'Slow', 'Streets and courtyards'],
        ['Ziziphus spina-christi', "Christ's thorn jujube", 2.7, 'Very High', 'Moderate', 'Gardens and boulevards'],
        ['Phoenix dactylifera', 'Date palm', 1.8, 'High', 'Moderate', 'Linear oasis-style plantings along irrigated strips'],
        ['Tamarix aphylla', 'Athel tamarisk', 2.2, 'Very High', 'Fast', 'Windbreaks and saline soils'],
        ['Vachellia nilotica', 'Gum arabic tree', 2.9, 'High', 'Moderate', 'Canal and riverbank avenues'],
      ],
    },
    sahel: {
      label: 'Sahel & semi-arid savanna',
      climate: 'a long dry season, a short intense rainy season and extreme dry-season heat',
      water: 'Plant at the start of the rains and protect saplings from browsing; mulch to hold soil moisture through the dry season.',
      watch: 'Keep a mix of native and naturalised species to limit disease and pest outbreaks in single-species rows.',
      species: [
        ['Khaya senegalensis', 'African mahogany', 3.8, 'High', 'Moderate', 'Main avenues and civic spaces'],
        ['Azadirachta indica', 'Neem', 3.5, 'Very High', 'Fast', 'Streets and schoolyards (naturalised, quick shade)'],
        ['Faidherbia albida', 'Apple-ring acacia', 2.6, 'Very High', 'Moderate', 'Peri-urban belts; improves soil'],
        ['Parkia biglobosa', 'African locust bean', 3.2, 'High', 'Slow', 'Parks and neighbourhood commons'],
        ['Balanites aegyptiaca', 'Desert date', 2.6, 'Very High', 'Slow', 'Peripheral belts and dry plots'],
        ['Adansonia digitata', 'Baobab', 2.0, 'Very High', 'Slow', 'Landmark squares and large open plots'],
      ],
    },
    humid: {
      label: 'Humid tropical (Guinean & Congo basin)',
      climate: 'year-round heat and humidity with high rainfall',
      water: 'Rainfall is usually sufficient; focus on soil volume, drainage and structural pruning before storm seasons.',
      watch: 'Choose strong-wooded species along roads and power lines; avoid shallow-rooted trees on paved corridors.',
      species: [
        ['Milicia excelsa', 'Iroko', 3.9, 'Moderate', 'Moderate', 'Parks and large avenues'],
        ['Khaya ivorensis', 'African mahogany', 3.8, 'Moderate', 'Fast', 'Boulevards and institutional grounds'],
        ['Terminalia catappa', 'Tropical almond', 3.3, 'High', 'Fast', 'Coastal streets and sandy soils'],
        ['Spathodea campanulata', 'African tulip tree', 3.0, 'Moderate', 'Fast', 'Roadsides and medians'],
        ['Samanea saman', 'Rain tree', 4.0, 'Moderate', 'Fast', 'Parks and wide boulevards (introduced)'],
        ['Mangifera indica', 'Mango', 3.4, 'Moderate', 'Moderate', 'Neighbourhood streets and courtyards'],
      ],
    },
    east: {
      label: 'East African highlands & savanna',
      climate: 'moderate temperatures at altitude with distinct wet and dry seasons',
      water: 'Plant with the long rains; mulch and basin-irrigate through the first dry season.',
      watch: 'Reduce reliance on fast-growing exotics (e.g. eucalyptus) that draw heavily on groundwater.',
      species: [
        ['Cordia africana', 'East African cordia', 3.5, 'Moderate', 'Fast', 'Streets and compounds'],
        ['Markhamia lutea', 'Nile tulip tree', 2.8, 'Moderate', 'Fast', 'Narrow streets and medians'],
        ['Croton megalocarpus', 'Broad-leaved croton', 3.3, 'High', 'Fast', 'Parks and windbreaks'],
        ['Podocarpus falcatus', 'Outeniqua yellowwood', 3.6, 'Moderate', 'Slow', 'Parks and institutional grounds'],
        ['Vachellia xanthophloea', 'Fever tree', 2.9, 'Moderate', 'Fast', 'Wetland edges and open spaces'],
        ['Grevillea robusta', 'Silky oak', 3.0, 'Moderate', 'Fast', 'Avenues and windbreaks (introduced)'],
      ],
    },
    islands: {
      label: 'Indian Ocean tropical islands',
      climate: 'warm, humid maritime conditions with cyclone exposure',
      water: 'Rain is generally adequate; prioritise wind-firm root systems and staking in the first two years.',
      watch: 'Favour deep-rooted, wind-tolerant species; avoid brittle trees near buildings in cyclone corridors.',
      species: [
        ['Delonix regia', 'Flamboyant', 3.4, 'Moderate', 'Fast', 'Parks and broad avenues'],
        ['Tamarindus indica', 'Tamarind', 3.6, 'High', 'Slow', 'Squares and large streets'],
        ['Calophyllum inophyllum', 'Alexandrian laurel', 3.0, 'High', 'Moderate', 'Coastal promenades'],
        ['Terminalia catappa', 'Tropical almond', 3.3, 'High', 'Fast', 'Sandy and coastal soils'],
        ['Khaya madagascariensis', 'Madagascar mahogany', 3.5, 'Moderate', 'Slow', 'Avenues and civic grounds'],
        ['Albizia lebbeck', 'Siris tree', 3.1, 'High', 'Fast', 'Streets and car parks'],
      ],
    },
    south: {
      label: 'Southern African highveld & subtropical',
      climate: 'hot wet summers and cool dry winters, with frost risk inland',
      water: 'Plant in early summer rains; use mulch rings and deep, infrequent watering for the first dry winter.',
      watch: 'Keep frost-tender species to sheltered sites; replace invasive exotics with locally native trees.',
      species: [
        ['Celtis africana', 'White stinkwood', 3.4, 'High', 'Fast', 'Streets and parks'],
        ['Searsia lancea', 'Karee', 2.8, 'Very High', 'Moderate', 'Streets and dry gardens'],
        ['Combretum erythrophyllum', 'River bushwillow', 3.0, 'Moderate', 'Fast', 'Riparian corridors and parks'],
        ['Vachellia karroo', 'Sweet thorn', 2.5, 'Very High', 'Fast', 'Pioneer shade on the periphery'],
        ['Peltophorum africanum', 'Weeping wattle', 2.7, 'High', 'Moderate', 'Streets and small public spaces'],
        ['Schotia brachypetala', 'Weeping boer-bean', 3.1, 'High', 'Moderate', 'Parks and large gardens'],
      ],
    },
    semiS: {
      label: 'Southern African semi-arid (Kalahari & Namib margins)',
      climate: 'low, erratic rainfall with very hot summers',
      water: 'Use drip irrigation and deep planting holes; concentrate planting in swales that capture runoff.',
      watch: 'Protect existing large native trees (camel thorn, leadwood): they are slow to replace.',
      species: [
        ['Vachellia erioloba', 'Camel thorn', 3.0, 'Very High', 'Slow', 'Large open spaces and street edges'],
        ['Searsia lancea', 'Karee', 2.8, 'Very High', 'Moderate', 'Streets and gardens'],
        ['Boscia albitrunca', "Shepherd's tree", 2.6, 'Very High', 'Slow', 'Courtyards and compact plots'],
        ['Colophospermum mopane', 'Mopane', 2.8, 'High', 'Moderate', 'Peri-urban belts'],
        ['Combretum imberbe', 'Leadwood', 2.8, 'Very High', 'Slow', 'Parks and civic squares'],
        ['Ziziphus mucronata', 'Buffalo thorn', 2.3, 'Very High', 'Moderate', 'Hedges and informal-settlement edges'],
      ],
    },
  };

  /* Coarse bioclimatic assignment from the AOI centroid */
  function zoneFor(lat, lon) {
    if (lon >= 42 && lat < -3) return 'islands';                                  // Madagascar, Mauritius, Comoros, Seychelles
    if (lat >= 30 && !(lon >= 24 && lat < 31.4)) return 'med';                   // Maghreb & Libyan coast
    if (lat >= 15.5) return 'arid';                                               // Sahara belt, Nile valley, Nouakchott, Khartoum
    if (lon >= 41 && lat >= 0) return 'arid';                                     // Horn of Africa lowlands
    if (lat >= 10) return 'sahel';
    if (lat >= -12) {
      if (lon >= 38.5 && lat <= -3) return 'humid';                               // East African coast
      return lon >= 28 ? 'east' : 'humid';
    }
    if (lon >= 10 && lon <= 28 && lat > -26 && lat < -17) return 'semiS';         // Windhoek, Gaborone
    return 'south';
  }

  function aoiCentroid() {
    try {
      const raw = sessionStorage.getItem('aoi_geojson');
      if (raw && typeof turf !== 'undefined') {
        const c = turf.center(JSON.parse(raw)).geometry.coordinates;
        return { lon: c[0], lat: c[1] };
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  const coolLabel = d => (d >= 3.5 ? 'Very High' : d >= 2.7 ? 'High' : 'Medium') + ` (-${d.toFixed(1)}°C)`;

  /** Profile for the current AOI (or the user-selected override). */
  function profile() {
    const override = sessionStorage.getItem('tree_region_override');
    const c = aoiCentroid();
    const auto = c ? zoneFor(c.lat, c.lon) : 'med';
    const id = override && ZONES[override] ? override : auto;
    const z = ZONES[id];
    return {
      id, auto, overridden: id !== auto, centroid: c, label: z.label, climate: z.climate, water: z.water, watch: z.watch,
      species: z.species.map(([sci, common, dT, drought, growth, use]) => ({ sci, common, dT, cool: coolLabel(dT), drought, growth, use })),
    };
  }

  /** Strategy paragraph + action list, tailored with the analysis figures. */
  function strategy(p, aoiName) {
    let sim = {}; try { sim = JSON.parse(sessionStorage.getItem('sim_data') || '{}'); } catch (e) { /* ignore */ }
    const top = [...p.species].sort((a, b) => b.dT - a.dT);
    const hardy = [...p.species].filter(s => s.drought === 'Very High').sort((a, b) => b.dT - a.dT);
    const fast = p.species.find(s => s.growth === 'Fast') || top[0];
    const facts = [];
    if (sim.maxLst) facts.push(`peak LST ${sim.maxLst} °C`);
    if (sim.uhiIntensity) facts.push(`UHI intensity +${sim.uhiIntensity} °C`);
    if (sim.hotspotArea) facts.push(`${sim.hotspotArea} km² of critical hotspots`);
    const factStr = facts.length ? ` (${facts.join(', ')})` : '';
    return {
      intro: `<b>${aoiName}</b> falls in the <b>${p.label}</b> region, characterised by ${p.climate}. Given the observed thermal anomalies${factStr}, ` +
        `the plan uses species adapted to these conditions. Large-canopy trees such as <b>${top[0].common}</b> and <b>${top[1].common}</b> in Hotspot Cluster #1 can deliver up to <b>${top[0].dT.toFixed(1)}°C</b> of localised ambient cooling.`,
      actions: [
        `<b>Hotspot cores:</b> shade streets and public squares with ${top[0].common} and ${top[1].common}; target 30% canopy cover on exposed paved corridors.`,
        `<b>Fast shade and edges:</b> use ${fast.common} for quick canopy closure${hardy[0] ? `, and ${hardy[0].common} where soils are driest` : ''}.`,
        `<b>Establishment:</b> ${p.water}`,
        `<b>Risk note:</b> ${p.watch}`,
      ],
    };
  }

  /* ----------------------------- results window rendering ------------------ */
  function renderTable(p) {
    const body = document.getElementById('tree-table-body');
    if (!body) return;
    body.innerHTML = '';
    p.species.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><i>${t.sci}</i></td><td><b>${t.common}</b></td><td class="cell-good">${t.cool}</td><td>${t.drought}</td><td>${t.growth}</td><td>${t.use}</td>`;
      body.appendChild(tr);
    });
    const st = strategy(p, sessionStorage.getItem('aoi_name') || 'the selected area');
    const box = document.getElementById('tree-strategy-text');
    if (box) box.innerHTML = `<p>${st.intro}</p><ul class="tree-actions">${st.actions.map(a => `<li>${a}</li>`).join('')}</ul>`;
    const note = document.getElementById('tree-region-note');
    if (note) note.textContent = `${p.overridden ? 'Manual region profile' : 'Auto-detected from the area of interest'}${p.centroid ? ` (${p.centroid.lat.toFixed(2)}°, ${p.centroid.lon.toFixed(2)}°)` : ''}. Cooling values are indicative.`;
  }

  function setup(aoiName) {
    const btn = document.getElementById('btn-open-trees');
    const container = document.getElementById('tree-results-container');
    const sel = document.getElementById('tree-region-select');
    const aiArea = document.getElementById('ai-area-name');
    if (aiArea) aiArea.innerText = aoiName;
    if (!btn || !container) return;

    // fresh state for the (possibly new) area
    container.style.display = 'none';
    btn.innerText = '🌿 Load Native Tree Species & Cooling Plan';
    btn.style.background = '';

    const p = profile();
    if (sel) {
      sel.innerHTML = `<option value="">Auto-detect (${ZONES[p.auto].label})</option>` +
        Object.entries(ZONES).map(([id, z]) => `<option value="${id}">${z.label}</option>`).join('');
      sel.value = p.overridden ? p.id : '';
      sel.onchange = () => {
        if (sel.value) sessionStorage.setItem('tree_region_override', sel.value); else sessionStorage.removeItem('tree_region_override');
        if (container.style.display === 'block') renderTable(profile());
      };
    }
    btn.onclick = () => {
      renderTable(profile());
      container.style.display = 'block';
      btn.innerText = '✅ Species Recommendations Loaded';
      btn.style.background = '#059669';
    };
  }

  /* ------------------------------- report helpers --------------------------- */
  function reportHtml(aoiName) {
    const p = profile(), st = strategy(p, aoiName);
    return `
        <h2 style="color: #EA580C; border-left: 4px solid #EA580C; padding-left: 10px; margin-top: 30px;">Detailed AI Tree Recommendations</h2>
        <p>Region profile: <b>${p.label}</b>. Native and climate-adapted afforestation is the most resilient mitigation strategy for ${aoiName}. Species were selected for drought tolerance, shade-casting canopy and cooling potential under ${p.climate}:</p>
        <ul style="margin-bottom: 15px;">${p.species.map(s => `<li><b>${s.sci} (${s.common}):</b> ${s.use}. Cooling ${s.cool}, drought tolerance ${s.drought}, growth ${s.growth.toLowerCase()}.</li>`).join('')}</ul>
        <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; text-align: left;" border="1" cellpadding="5">
          <tr style="background: #f0f0f0;"><th>Species Name</th><th>Common Name</th><th>Cooling Potential</th><th>Drought Tolerance</th></tr>
          ${p.species.map(s => `<tr><td><i>${s.sci}</i></td><td>${s.common}</td><td>${s.cool}</td><td>${s.drought}</td></tr>`).join('')}
        </table>
        <p><b>Executive Strategy:</b> ${st.intro}</p>
        <ul style="margin-bottom: 15px;">${st.actions.map(a => `<li>${a}</li>`).join('')}</ul>`;
  }
  const stripTags = h => h.replace(/<[^>]+>/g, '');

  return { profile, strategy, setup, reportHtml, stripTags, ZONES, zoneFor };
})();
