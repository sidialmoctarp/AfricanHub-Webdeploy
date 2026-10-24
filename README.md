# 🌡️ Urban Heat Island (UHI) & Heatwave Resilience Dashboard

> **Production-grade geospatial intelligence platform transforming multi-spectral and thermal satellite observations into actionable public health and climate policy insights.**  
> Aligned with **UN SDG 3 (Good Health and Well-being)** and **UN SDG 13 (Climate Action)**.

---

## 🏗️ Architecture & Modular File Structure

```text
UrbanHeatIsland_Dashboard/
├── app.py              # Main Streamlit UI, split-screen layout, navigation tabs, metrics HUD
├── pipeline.py         # Google Earth Engine ingestion, Landsat calibration, Climatology comparator
├── utils.py            # Spatial transect profiler, health risk & productivity loss, PDF report generator
├── styles.css          # Custom SaaS dark theme, glassmorphic card styles, glowing telemetry
├── requirements.txt    # Production Python dependencies
└── README.md           # Setup instructions, Earth Engine API credential guide, and scientific citations
```

---

## 🔬 Scientific Methodology & Remote-Sensing Pipeline

This dashboard implements an end-to-end 6-stage remote sensing workflow:

| Stage | Process | Scientific Formulation |
| :--- | :--- | :--- |
| **1. Cloud Masking** | Dilated cloud, cirrus, cloud & shadow screening | Bitwise masking on Landsat `QA_PIXEL` band (bits 1, 2, 3, 4). |
| **2. Radiometric Calibration** | Converting raw DN to Surface Reflectance & TOA | Optical bands scaled by $0.0000275$ with offset $-0.2$. |
| **3. Spectral Indices** | Vegetation fraction & impervious surface mapping | $\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$ & $\text{NDBI} = \frac{\text{SWIR} - \text{NIR}}{\text{SWIR} + \text{NIR}}$. |
| **4. Emissivity Correction** | Estimating surface emissivity via Fractional Vegetation Cover | $\text{FVC} = \left(\frac{\text{NDVI} - 0.1}{0.65 - 0.1}\right)^2$, $\varepsilon = 0.004 \cdot \text{FVC} + 0.986$ (Sobrino et al.). |
| **5. LST Retrieval** | USGS Landsat Collection 2 Level-2 thermal calibration | $\text{LST (°C)} = (\text{ST\_B10} \times 0.00341802 + 149.0) - 273.15$. |
| **6. UHI Quantification** | 20-Year Climatology baseline comparator & anomaly | $\Delta T_{\text{UHI}} = \text{LST}_{\text{urban}} - \text{LST}_{\text{rural}}$, $\Delta T_{\text{anomaly}} = \text{LST}_{\text{current}} - \text{LST}_{\text{clim (2000-2020)}}$. |

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
* **Python**: 3.10+ (tested on Python 3.10 – 3.14)
* **Google Cloud Project** (with Earth Engine API enabled)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Authenticate Google Earth Engine
Authenticate your Earth Engine credentials:
```bash
earthengine authenticate
```
*Note: If GEE credentials are not yet configured, the system gracefully activates an intelligent scientific simulation engine, allowing immediate local testing of all mapping, transect, health risk, and PDF features.*

### 4. Launch the Dashboard
```bash
streamlit run app.py
```
The application will launch at `http://localhost:8501`.

---

## 🌟 Core Functional Features

### 1. Split-Screen Layout (`app.py`)
* **Left:** Interactive high-resolution heatmap canvas with layer controls (`LST (°C)`, `20-Year Anomaly`, `NDVI`, `NDBI`) and urban core marker.
* **Right:** Real-time microclimate analytics panel with 4 telemetry scorecards:
  * **Urban Core Max Temp (°C)**
  * **Rural Baseline Temp (°C)**
  * **UHI Intensity ($\Delta T$)**
  * **Cumulative Heat Stress Index**

### 2. Spatial Profile Transect Tool (`utils.py`)
Samples an urban-to-rural cross-sectional transect line across the city, generating dual-axis profiles comparing thermal gradients directly with vegetation fraction.

### 3. Public Health & Workforce Productivity Loss (ISO 7243)
Calculates active workforce labor capacity reduction and estimated daily economic GDP loss based on thermal work thresholds (>35°C high hazard).

### 4. Nature-Based Solution Mitigation Simulator
Interactive sliders simulating the cooling benefits of expanding urban tree canopy (+% Tree Cover) and deploying high-albedo cool roofs (+% Albedo):
$$\Delta T_{\text{cooling}} = -0.052 \cdot \Delta\text{TreeCover\%} - 0.031 \cdot \Delta\text{CoolRoof\%}$$

### 5. 5-Year Predictive Heat Risk
Employs empirical linear regression on historic summertime peaks to forecast a 7-day forward thermal trajectory and the probability of extreme heatwave exceedance (>40°C).

### 6. Executive Deliverables Export
* **Downloadable PDF Report**: Print-ready executive heatwave briefing summarizing satellite diagnostics, health vulnerability, and nature-based policy guidance.
* **CSV Telemetry Data**: Raw tabular metrics for GIS analysts and municipal planners.

---

## 📚 References & Scientific Citations
1. **USGS**: *Landsat 8-9 Collection 2 Level 2 Science Product Guide*, USGS EROS, 2021.
2. **Sobrino, J. A., et al.**: *Surface temperature retrieval from Landsat optical and thermal infrared sensors*, Remote Sensing of Environment, 2004.
3. **ISO 7243:2017**: *Ergonomics of the thermal environment — Assessment of heat stress using the WBGT (wet bulb globe temperature) index*.
4. **Akbari, H., Pomerantz, M., & Taha, H.**: *Cool surfaces and shade trees to reduce energy use and improve air quality in urban areas*, Solar Energy, 2001.
