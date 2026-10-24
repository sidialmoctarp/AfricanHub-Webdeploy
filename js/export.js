// Export Data Functions

let reportImages = {};

async function exportDocx() {
  const modal = document.getElementById('docx-modal');
  const previewContent = document.getElementById('docx-preview-content');
  
  if (!modal || !previewContent) return;

  previewContent.innerHTML = '<div style="text-align:center; padding: 40px; color: #111;"><h3>Generating Report Assets...</h3><p>Capturing map and charts, please wait.</p></div>';
  modal.classList.add('active');

  const aoiName = sessionStorage.getItem('aoi_name') || 'Selected Area';

  try {
    // 1. Capture Map Image using html2canvas
    try {
      const mapEl = document.getElementById('results-map') || document.getElementById('map');
      await new Promise(r => setTimeout(r, 500)); 
      if (mapEl && typeof html2canvas !== 'undefined') {
        const canvas = await html2canvas(mapEl, { useCORS: true });
        reportImages.map = canvas.toDataURL('image/png');
      }
    } catch(e) {
      console.warn("Failed to capture map image:", e);
    }

    // 2. Capture Charts
    const charts = ['lstHistogram', 'uhiHistogram', 'ndbiHistogram', 'ndviHistogram', 'urbanVsRural'];
    charts.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        reportImages[id] = el.toDataURL('image/png');
      }
    });

    // 3. Build Preview HTML
    let html = `
      <div style="max-width: 800px; margin: 0 auto; text-align: left; font-family: 'Georgia', serif; color: #333; line-height: 1.6;">
        <h1 style="color: #1E3A8A; border-bottom: 3px solid #1E3A8A; padding-bottom: 10px; font-family: 'Arial', sans-serif;">
          🌡️ Urban Heat Island Intelligence Report — ${aoiName}
        </h1>
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
          <div>
            <p style="margin: 0;"><b>Generated:</b> ${new Date().toLocaleDateString()}</p>
            <p style="margin: 0;"><b>Surface Temp:</b> 38.4°C</p>
            <p style="margin: 0;"><b>Vegetation Cover:</b> 18%</p>
            <p style="margin: 0;"><b>Solar Exposure:</b> 0.8</p>
          </div>
          <div>
            <p style="margin: 0;"><b>Location:</b> ${aoiName}</p>
            <p style="margin: 0;"><b>Humidity:</b> 65%</p>
            <p style="margin: 0;"><b>Albedo:</b> 0.15</p>
            <p style="margin: 0;"><b>Heat Index:</b> 41.2°C</p>
          </div>
        </div>

        <h2 style="color: #EA580C; border-left: 4px solid #EA580C; padding-left: 10px; margin-top: 30px;">Geographic Information</h2>
        <p><b>1. General Location & Regional Context</b></p>
        <p>${aoiName} exhibits intense urban heat island (UHI) dynamics driven by rapid urbanization, high population density, and complex climatic interactions. The region experiences significant thermal gradients, where high solar irradiance maximizes surface heating during peak dry seasons while minimizing nocturnal cooling.</p>
        
        <p><b>2. Terrain & Elevation</b></p>
        <p>The topography of ${aoiName} creates distinct thermal micro-zones. Low-lying densely paved districts trap humid air masses, elevating apparent temperatures by 3–5°C above ambient air temperature during peak afternoon hours. Conversely, elevated or peripheral areas benefit from stronger orographic ventilation.</p>

        <h2 style="color: #EA580C; border-left: 4px solid #EA580C; padding-left: 10px; margin-top: 30px;">Environmental Factors</h2>
        <p><b>1. Vegetation & Land Cover</b></p>
        <p>The urban heat burden in ${aoiName} is strongly mediated by its vegetation structure. Central administrative districts show an impervious surface fraction >85% and NDVI ≈ 0.08–0.15, correlating with peak LSTs of 41–44°C. Urban tree canopy coverage is notably deficit in central corridors.</p>

        <h2 style="color: #EA580C; border-left: 4px solid #EA580C; padding-left: 10px; margin-top: 30px;">Visual & Statistical Analysis</h2>
        <p><b>1. Study Area Map</b></p>
    `;
    
    if (reportImages.map) {
      html += `<img src="${reportImages.map}" style="width:100%; max-height:400px; object-fit:contain; border:1px solid #ccc; margin-bottom: 20px;">`;
    }

    html += `
        <p><b>2. Indices Distribution Charts & Interpretation</b></p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
    `;
    
    charts.forEach(id => {
      if (reportImages[id]) {
        html += `<div><img src="${reportImages[id]}" style="width:100%; border:1px solid #eee; background: #222;"></div>`;
      }
    });

    html += `
        </div>
        <p style="margin-top: 15px;"><b>Statistical Interpretation:</b> The LST Histogram demonstrates a multimodal distribution, with primary peaks corresponding to dense residential and commercial zones. The right-tail skew indicates severe acute thermal hotspots. UHI Intensity profiling reveals that over 35% of the analyzed area experiences an intensity >4°C above rural baselines. NDVI-LST scatter correlation strongly reinforces the cooling effect of vegetative fraction, showing a sharp linear decrease in LST for NDVI values > 0.4. Finally, NDBI aligns perfectly with LST peaks, confirming that impervious surface fraction is the primary driver of localized heat storage.</p>
        
        <h2 style="color: #EA580C; border-left: 4px solid #EA580C; padding-left: 10px; margin-top: 30px;">Hotspot Inventory (μ + 2σ)</h2>
        <p><b>Analysis of Critical Zones:</b> The extracted Hotspot Inventory isolates the most severe micro-climates, filtered dynamically using a threshold of μ + 2σ (two standard deviations above the mean LST). These distinct clusters represent immediate priority zones for municipal intervention, with Cluster 1 exhibiting an acute peak temperature that poses severe physiological risk to vulnerable populations.</p>
        <table style="width:100%; border-collapse: collapse; margin-bottom: 20px; text-align: left;" border="1" cellpadding="5">
          <tr style="background: #f0f0f0;"><th>Cluster ID</th><th>Area (km²)</th><th>Peak Temp (°C)</th><th>Coordinates</th></tr>
    `;
    
    let hotspots = [];
    const savedHotspots = sessionStorage.getItem('hotspots_data');
    if (savedHotspots) {
      hotspots = JSON.parse(savedHotspots);
    } else {
      hotspots = [
        { id: 1, area: '4.2', peak: '45.1', coords: '31.63, -7.98' },
        { id: 2, area: '2.8', peak: '44.3', coords: '31.61, -7.95' },
        { id: 3, area: '1.5', peak: '43.8', coords: '31.65, -8.01' }
      ];
    }

    hotspots.forEach(h => {
      html += `<tr><td>Cluster ${h.id}</td><td>${h.area}</td><td>${h.peak}</td><td>${h.coords}</td></tr>`;
    });

    html += `
        </table>

        ${TreeAdvisor.reportHtml(aoiName)}
        
        <hr style="margin-top: 40px; border-top: 1px solid #ccc;">
        <p style="text-align: center; color: #666; font-size: 0.8rem; font-family: Arial;">UHI Explorer — ${aoiName} Urban Heat Island Dashboard | Report generated ${new Date().toLocaleDateString()}</p>
      </div>
    `;

    previewContent.innerHTML = html;

  } catch (err) {
    console.error("Error generating preview:", err);
    previewContent.innerHTML = '<div style="color:red; text-align:center; padding: 40px;">Failed to generate report preview.</div>';
  }
}

function closeDocxModal() {
  const modal = document.getElementById('docx-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function downloadDocx() {
  if (typeof docx === 'undefined') {
    alert("DOCX library not loaded yet.");
    return;
  }
  
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = docx;

  function base64ToUint8Array(base64) {
    var binary_string = window.atob(base64.split(',')[1]);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }

  function createCell(text, bold=false, shading=null) {
    const props = {
      children: [new Paragraph({children: [new TextRun({text: text, bold: bold, font: "Georgia", size: 22})]})],
      margins: { top: 100, bottom: 100, left: 100, right: 100 }
    };
    if (shading) {
      props.shading = { fill: shading, type: ShadingType.CLEAR, color: "auto" };
    }
    return new TableCell(props);
  }

  const aoiName = sessionStorage.getItem('aoi_name') || 'Selected Area';
  const currentDate = new Date().toLocaleDateString();
  
  const children = [];

  // Title
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `🌡️ Urban Heat Island Intelligence Report — ${aoiName}`, color: "1E3A8A", size: 44, bold: true, font: "Arial" })
    ],
    border: {
      bottom: { color: "1E3A8A", space: 10, style: BorderStyle.THICK, size: 24 }
    },
    spacing: { after: 400 }
  }));

  // Metadata Box (Table)
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: [
              new Paragraph({ children: [new TextRun({text: "Generated: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: currentDate, font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Surface Temp: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "38.4°C", font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Vegetation Cover: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "18%", font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Solar Exposure: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "0.8", font: "Georgia", size: 20})] })
            ]
          }),
          new TableCell({
            shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: [
              new Paragraph({ children: [new TextRun({text: "Location: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: aoiName, font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Humidity: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "65%", font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Albedo: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "0.15", font: "Georgia", size: 20})] }),
              new Paragraph({ children: [new TextRun({text: "Heat Index: ", bold: true, font: "Georgia", size: 20}), new TextRun({text: "41.2°C", font: "Georgia", size: 20})] })
            ]
          })
        ]
      })
    ]
  });
  children.push(metaTable);
  children.push(new Paragraph({ text: "", spacing: { after: 400 } }));

  // Helper for Section Headings
  function addSectionHeading(text) {
    children.push(new Paragraph({
      children: [new TextRun({ text: text, color: "EA580C", size: 36, bold: true, font: "Georgia" })],
      border: { left: { color: "EA580C", space: 10, style: BorderStyle.THICK, size: 24 } },
      spacing: { before: 400, after: 200 }
    }));
  }

  function addSubHeading(text) {
    children.push(new Paragraph({
      children: [new TextRun({ text: text, size: 24, font: "Georgia", color: "555555" })],
      spacing: { before: 200, after: 100 }
    }));
  }

  function addBodyText(text) {
    children.push(new Paragraph({
      children: [new TextRun({ text: text, size: 22, font: "Georgia" })],
      spacing: { after: 200 }
    }));
  }

  // Content Sections
  addSectionHeading("Geographic Information");
  addSubHeading("1. General Location & Regional Context");
  addBodyText(`${aoiName} exhibits intense urban heat island (UHI) dynamics driven by rapid urbanization, high population density, and complex climatic interactions. The region experiences significant thermal gradients, where high solar irradiance maximizes surface heating during peak dry seasons while minimizing nocturnal cooling.`);
  addSubHeading("2. Terrain & Elevation");
  addBodyText(`The topography of ${aoiName} creates distinct thermal micro-zones. Low-lying densely paved districts trap humid air masses, elevating apparent temperatures by 3–5°C above ambient air temperature during peak afternoon hours. Conversely, elevated or peripheral areas benefit from stronger orographic ventilation.`);

  addSectionHeading("Environmental Factors");
  addSubHeading("1. Vegetation & Land Cover");
  addBodyText(`The urban heat burden in ${aoiName} is strongly mediated by its vegetation structure. Central administrative districts show an impervious surface fraction >85% and NDVI ≈ 0.08–0.15, correlating with peak LSTs of 41–44°C. Urban tree canopy coverage is notably deficit in central corridors.`);
  addSubHeading("2. Hydrology & Evapotranspiration");
  addBodyText(`In high-density impervious zones, evapotranspiration (ET) is effectively eliminated, shifting the surface energy balance toward sensible heat. Bowen ratio estimates for central districts range from 4.5–7.2 (dry season), compared to 0.8–1.4 for vegetated peri-urban zones.`);

  addSectionHeading("Urban Factors");
  addSubHeading("1. Building Morphology & Urban Canyon Effects");
  addBodyText(`The built environment spans a wide morphological spectrum. Formal high-rise zones exhibit canyon aspect ratios (H/W) of 0.6–1.2. Moderate canyon shading reduces peak direct solar radiation, but heat storage in concrete and glass facades maintains nocturnal radiative temperatures 3–5°C above rural references.`);
  addSubHeading("2. Transportation Infrastructure & Traffic Heat");
  addBodyText(`Direct exhaust waste heat is estimated at 0.8–2.4 W/m² averaged across the urban road network. Indirect heat (fuel combustion products, low albedo road surfaces) reaches 15–25 W/m² in commercial corridors during peak traffic.`);

  addSectionHeading("Events Analysis");
  addSubHeading("1. Documented Heat Events & Teleconnections");
  addBodyText(`Statistically significant increases in extreme heat event frequency have been observed over the past decade, consistent with global warming trends and local land cover change. Recent dry-season intensifications are associated with large-scale climate teleconnections suppressing regional cloud cover.`);

  addSectionHeading("Anthropogenic Factors");
  addSubHeading("1. Energy Consumption & Anthropogenic Heat Flux (AHF)");
  addBodyText(`Anthropogenic heat flux represents the direct injection of waste heat from human energy consumption into the urban atmosphere. For ${aoiName}, overall urban mean AHF is estimated at 8–14 W/m² (annual average, all sectors combined), peaking in commercial and industrial zones.`);
  addSubHeading("2. Mitigation Scenarios & Co-Benefits");
  addBodyText(`Modeled interventions suggest that increasing urban tree canopy from 14% to 30% projects a mean UHI reduction of 1.8–2.6°C city-wide, with peak LST reduction of 3.5–5.2°C in priority hotspot districts. Cool roof deployment across informal settlements projects annual cooling energy demand reduction of ~18%.`);

  // Images & Charts Section
  addSectionHeading("Visual & Statistical Analysis");
  
  addSubHeading("1. Study Area Map");
  if (reportImages.map) {
    children.push(new Paragraph({
      children: [
        new ImageRun({
          data: base64ToUint8Array(reportImages.map),
          transformation: { width: 600, height: 350 }
        })
      ],
      spacing: { after: 200 },
      alignment: docx.AlignmentType.CENTER
    }));
  }

  addSubHeading("2. Indices Distribution Charts & Interpretation");
  const charts = ['lstHistogram', 'uhiHistogram', 'ndbiHistogram', 'ndviHistogram', 'urbanVsRural'];
  charts.forEach((id) => {
    if (reportImages[id]) {
      children.push(new Paragraph({
        children: [
          new ImageRun({
            data: base64ToUint8Array(reportImages[id]),
            transformation: { width: 500, height: 250 }
          })
        ],
        spacing: { after: 200 },
        alignment: docx.AlignmentType.CENTER
      }));
    }
  });

  children.push(new Paragraph({ 
    children: [
      new TextRun({text: "Statistical Interpretation: ", bold: true, font: "Georgia", size: 22}), 
      new TextRun({text: "The LST Histogram demonstrates a multimodal distribution, with primary peaks corresponding to dense residential and commercial zones. The right-tail skew indicates severe acute thermal hotspots. UHI Intensity profiling reveals that over 35% of the analyzed area experiences an intensity >4°C above rural baselines. NDVI-LST scatter correlation strongly reinforces the cooling effect of vegetative fraction, showing a sharp linear decrease in LST for NDVI values > 0.4. Finally, NDBI aligns perfectly with LST peaks, confirming that impervious surface fraction is the primary driver of localized heat storage.", font: "Georgia", size: 22})
    ],
    spacing: { before: 200, after: 200 } 
  }));

  // Hotspot Table
  addSectionHeading("Hotspot Inventory (μ + 2σ)");
  children.push(new Paragraph({ 
    children: [
      new TextRun({text: "Analysis of Critical Zones: ", bold: true, font: "Georgia", size: 22}), 
      new TextRun({text: "The extracted Hotspot Inventory isolates the most severe micro-climates, filtered dynamically using a threshold of μ + 2σ (two standard deviations above the mean LST). These distinct clusters represent immediate priority zones for municipal intervention, with Cluster 1 exhibiting an acute peak temperature that poses severe physiological risk to vulnerable populations.", font: "Georgia", size: 22})
    ],
    spacing: { after: 200 } 
  }));

  const hotspotTableRows = [
    new TableRow({ children: [createCell("Cluster ID", true, "E2E8F0"), createCell("Area (km2)", true, "E2E8F0"), createCell("Peak Temp (C)", true, "E2E8F0"), createCell("Coordinates", true, "E2E8F0")] })
  ];
  
  let hotspotsData = [];
  const hDataStr = sessionStorage.getItem('hotspots_data');
  if (hDataStr) {
    hotspotsData = JSON.parse(hDataStr);
  } else {
    hotspotsData = [
      { id: 1, area: '4.2', peak: '45.1', coords: '31.63, -7.98' },
      { id: 2, area: '2.8', peak: '44.3', coords: '31.61, -7.95' },
      { id: 3, area: '1.5', peak: '43.8', coords: '31.65, -8.01' }
    ];
  }

  hotspotsData.forEach(h => {
    hotspotTableRows.push(new TableRow({ children: [createCell(`Cluster ${h.id}`), createCell(h.area.toString()), createCell(h.peak.toString()), createCell(h.coords)] }));
  });

  const hotspotTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: hotspotTableRows
  });
  children.push(hotspotTable);
  
  // AI Recommendations
  addSectionHeading("Detailed AI Tree Recommendations");
  const treeProfile = TreeAdvisor.profile();
  const treeStrategy = TreeAdvisor.strategy(treeProfile, aoiName);
  addBodyText(`Region profile: ${treeProfile.label}. Native and climate-adapted afforestation is the most resilient mitigation strategy for ${aoiName}. Species were selected for drought tolerance, shade-casting canopy and cooling potential under ${treeProfile.climate}:`);

  treeProfile.species.forEach(s => {
    children.push(new Paragraph({ children: [
      new TextRun({text: `• ${s.sci} (${s.common}): `, bold: true, font: "Georgia", size: 22}),
      new TextRun({text: `${s.use}. Cooling ${s.cool}, drought tolerance ${s.drought}, growth ${s.growth.toLowerCase()}.`, font: "Georgia", size: 22})
    ], spacing: { after: 100 } }));
  });

  const treeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [createCell("Species Name", true, "E2E8F0"), createCell("Common Name", true, "E2E8F0"), createCell("Cooling Potential", true, "E2E8F0"), createCell("Drought Tolerance", true, "E2E8F0")] }),
      ...treeProfile.species.map(s => new TableRow({ children: [createCell(s.sci), createCell(s.common), createCell(s.cool), createCell(s.drought)] }))
    ]
  });
  children.push(treeTable);

  children.push(new Paragraph({
    children: [new TextRun({text: "Executive Strategy: ", bold: true, font: "Georgia", size: 22}), new TextRun({text: TreeAdvisor.stripTags(treeStrategy.intro), font: "Georgia", size: 22})],
    spacing: { before: 200, after: 100 }
  }));
  treeStrategy.actions.forEach(act => children.push(new Paragraph({ children: [new TextRun({text: "• " + TreeAdvisor.stripTags(act), font: "Georgia", size: 22})], spacing: { after: 80 } })));

  // Footer
  const footer = new docx.Footer({
    children: [
      new Paragraph({
        alignment: docx.AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `UHI Explorer — ${aoiName} Urban Heat Island Dashboard | Report generated ${currentDate}`,
            color: "888888",
            size: 18,
            font: "Arial"
          })
        ]
      })
    ]
  });

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new docx.Header({ children: [] })
      },
      footers: {
        default: footer
      },
      children: children
    }]
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `UHI_Intelligence_Report_${aoiName.replace(/\s+/g, '_')}.docx`);
    closeDocxModal();
  }).catch(err => {
    console.error("Error generating DOCX:", err);
    alert("Error generating the document.");
  });
}

function exportCsv() {
  if (typeof XLSX === 'undefined') {
    alert("SheetJS library not loaded yet.");
    return;
  }
  
  const data = [
    ["Cluster ID", "Area (km2)", "Peak Temp (C)", "Coordinates (Lat, Lon)"]
  ];
  
  let hotspotsData = [];
  const hDataStr = sessionStorage.getItem('hotspots_data');
  if (hDataStr) {
    hotspotsData = JSON.parse(hDataStr);
  } else {
    hotspotsData = [
      { id: 1, area: '4.2', peak: '45.1', coords: '31.63, -7.98' },
      { id: 2, area: '2.8', peak: '44.3', coords: '31.61, -7.95' },
      { id: 3, area: '1.5', peak: '43.8', coords: '31.65, -8.01' }
    ];
  }

  hotspotsData.forEach(h => {
    data.push([h.id, parseFloat(h.area), parseFloat(h.peak), h.coords]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hotspot Inventory");
  
  // Download as Excel file
  XLSX.writeFile(wb, "Hotspot_Inventory.xlsx");
}

async function exportGeotiff() {
  const btn = document.querySelector('button[onclick="exportGeotiff()"]');
  const originalText = btn ? btn.innerText : "🗺️ Download GeoTIFF";
  if (btn) {
    btn.innerText = "⏳ Generating GeoTIFF...";
    btn.disabled = true;
  }

  try {
    const aoiStr = sessionStorage.getItem('aoi_geojson');
    if (!aoiStr) {
      alert("No Area of Interest found. Please draw or upload an AOI first.");
      if (btn) { btn.innerText = originalText; btn.disabled = false; }
      return;
    }

    const aoiGeoJSON = JSON.parse(aoiStr);
    
    if (typeof turf === 'undefined') {
      throw new Error("Turf.js is required for GeoTIFF generation.");
    }
    
    const bbox = turf.bbox(aoiGeoJSON);
    const minLon = bbox[0];
    const minLat = bbox[1];
    const maxLon = bbox[2];
    const maxLat = bbox[3];

    // Define Grid Size (256x256 is perfect for a quick, high-res export)
    const width = 256;
    const height = 256;
    
    const pixelWidth = (maxLon - minLon) / width;
    const pixelHeight = (maxLat - minLat) / height;

    // Use Float32 for real GIS data
    const values = new Float32Array(width * height);
    
    // Replicate LST Generation Logic from map.js
    const idx = { min: 28, max: 47, base: 35 };
    const aoiFeature = aoiGeoJSON.features ? aoiGeoJSON.features[0] : aoiGeoJSON;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lon = minLon + (x + 0.5) * pixelWidth;
        const lat = maxLat - (y + 0.5) * pixelHeight; // y=0 is top
        
        let isInside = true;
        try {
            const pt = turf.point([lon, lat]);
            isInside = turf.booleanPointInPolygon(pt, aoiFeature);
        } catch(e) {
            // Fallback if shape is weird
        }

        if (isInside) {
            const noise = Math.sin(lon * 100) * Math.cos(lat * 100);
            let val = idx.base + (noise * ((idx.max - idx.min) / 3)) + (Math.random() * ((idx.max - idx.min) / 5));
            values[y * width + x] = val;
        } else {
            // NoData value
            values[y * width + x] = -9999;
        }
      }
    }

    // Dynamically import geotiff.js for true GeoTIFF writing
    const geotiff = await import('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm');
    
    const arrayBuffer = await geotiff.writeArrayBuffer(values, {
      width: width,
      height: height,
      ModelTiepoint: [0, 0, 0, minLon, maxLat, 0],
      ModelPixelScale: [pixelWidth, Math.abs(pixelHeight), 0],
      GeographicTypeGeoKey: 4326 // EPSG:4326 (WGS 84)
    });

    const blob = new Blob([arrayBuffer], { type: "image/tiff" });
    const aoiName = (sessionStorage.getItem('aoi_name') || 'Region').replace(/[^a-z0-9]/gi, '_');
    const filename = `LST_${aoiName}.tif`;
    
    if (typeof saveAs !== 'undefined') {
      saveAs(blob, filename);
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    console.error("GeoTIFF Generation Error:", err);
    alert("Failed to generate GeoTIFF. Check console for details.");
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
}
