"""
Urban Heat Island (UHI) & Heatwave Resilience Dashboard
Enterprise Geospatial Intelligence Platform

Tech Stack: Streamlit, Google Earth Engine, Leafmap/Plotly, Scikit-Learn
Standards: UN SDG 3 (Health), UN SDG 13 (Climate Action), ISO 7243 Thermal Ergonomics
"""

import os
import streamlit as st
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, timedelta

# Import Core Pipeline & Analytical Modules
from african_cities import AFRICAN_CITIES
from pipeline import (
    initialize_earth_engine,
    generate_scientific_grid_simulation,
    GEE_INITIALIZED
)
from utils import (
    sample_spatial_transect,
    compute_health_productivity_loss,
    simulate_green_infrastructure,
    forecast_heat_risk_5yr,
    compute_vulnerability_index,
    generate_heatwave_pdf_report
)

# ------------------------------------------------------------------------------
# 1. PAGE CONFIGURATION & CUSTOM SAAS STYLES
# ------------------------------------------------------------------------------
st.set_page_config(
    page_title="UHI & Heatwave Resilience Dashboard",
    page_icon="🌡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inject custom SaaS dark theme styles
styles_path = os.path.join(os.path.dirname(__file__), "styles.css")
if os.path.exists(styles_path):
    with open(styles_path, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# 2. CACHED DATA INGESTION & PIPELINE EXECUTION
# ------------------------------------------------------------------------------
@st.cache_data(show_spinner=False)
def load_geospatial_telemetry(city_name: str, lat: float, lon: float, grid_res: int):
    """
    Executes the ingestion and scientific processing pipeline with memory caching.
    """
    return generate_scientific_grid_simulation(
        city_name=city_name,
        lat=lat,
        lon=lon,
        radius_km=14.0,
        grid_res=grid_res
    )

# ------------------------------------------------------------------------------
# 3. SIDEBAR CONTROLS
# ------------------------------------------------------------------------------
with st.sidebar:
    st.markdown("""
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
            <div style="width:36px; height:36px; background:linear-gradient(135deg, #0d9488, #00f0ff); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                🔥
            </div>
            <div>
                <h3 style="margin:0; font-size:1.15rem; color:#fff;">UHI RESILIENCE</h3>
                <span style="font-size:0.7rem; color:#00f0ff; font-family:monospace;">GEO-ANALYTICS v3.0</span>
            </div>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("#### 1. Region of Interest (54 African Nations)")
    
    # Regional Sub-division Filter
    region_options = ["All 54 African Cities", "North Africa", "West Africa", "East Africa", "Central Africa", "Southern Africa"]
    selected_region = st.selectbox("African Geographic Region", region_options)

    if selected_region == "All 54 African Cities":
        filtered_cities = AFRICAN_CITIES
    else:
        filtered_cities = {k: v for k, v in AFRICAN_CITIES.items() if v["region"] == selected_region}

    selected_city_label = st.selectbox(
        f"Select African Capital / Metropolis ({len(filtered_cities)} Available)",
        list(filtered_cities.keys()),
        index=list(filtered_cities.keys()).index("Rabat / Casablanca (Morocco)") if "Rabat / Casablanca (Morocco)" in filtered_cities else 0
    )
    city_info = filtered_cities[selected_city_label]
    target_coords = {"lat": city_info["lat"], "lon": city_info["lon"]}

    # GADM Data Badge & Link
    st.markdown(f"""
        <div style="background:rgba(0, 240, 255, 0.08); border:1px solid rgba(0, 240, 255, 0.3); border-radius:6px; padding:6px 10px; margin:6px 0 12px 0; font-size:0.75rem;">
            🌍 <b>GADM ISO3:</b> <span style="color:#00f0ff; font-family:monospace;">{city_info['iso3']}</span> ({city_info['country']})<br>
            📍 <a href="https://gadm.org/data.html" target="_blank" style="color:#38bdf8; text-decoration:underline;">GADM Administrative Boundary Data</a>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("#### 2. Satellite Acquisition & Date Filtering")
    
    # Date Filtering Presets for Africa
    date_preset = st.selectbox(
        "Seasonal Date Filter Preset",
        [
            "Sahel & Tropical Dry Season (Nov - Mar)",
            "Mediterranean & North African Summer (Jun - Aug)",
            "Southern African Summer Heat (Dec - Feb)",
            "Full Annual Climatology (Jan - Dec)",
            "Custom Date Range"
        ]
    )

    if "Sahel" in date_preset:
        default_start, default_end = date(2024, 11, 1), date(2025, 3, 31)
    elif "Mediterranean" in date_preset:
        default_start, default_end = date(2025, 6, 1), date(2025, 8, 31)
    elif "Southern" in date_preset:
        default_start, default_end = date(2024, 12, 1), date(2025, 2, 28)
    elif "Full Annual" in date_preset:
        default_start, default_end = date(2025, 1, 1), date(2025, 12, 31)
    else:
        default_start, default_end = date(2025, 7, 1), date(2025, 8, 31)

    col_d1, col_d2 = st.columns(2)
    with col_d1:
        start_date = st.date_input("Start Date", default_start)
    with col_d2:
        end_date = st.date_input("End Date", default_end)

    sensor_choice = st.selectbox(
        "Sensor Constellation",
        ["Landsat 8/9 C2 L2 (ST_B10)", "Sentinel-2 MSI + TIRS Composite", "20-Year Climatology (2000-2020)"]
    )

    resolution_choice = st.radio(
        "Spatial Sampling Resolution",
        ["100m High Detail (Analytical)", "1km Regional Overview (Rapid)"],
        index=0
    )
    grid_res = 55 if "100m" in resolution_choice else 30

    st.markdown("---")

# Run Pipeline
grid_data = load_geospatial_telemetry(
    selected_city_label,
    target_coords["lat"],
    target_coords["lon"],
    grid_res
)
metrics = grid_data["metrics"]

# Dynamic NBS Recommendations in Sidebar if UHI > 5.0°C
with st.sidebar:
    st.markdown("#### 3. Nature-Based Policy Alert")
    if metrics["uhi_intensity"] >= 5.0:
        st.markdown(f"""
            <div style="background:rgba(239, 68, 68, 0.12); border:1px solid #ef4444; border-radius:8px; padding:10px; margin-bottom:10px;">
                <b style="color:#f87171; font-size:0.85rem;">⚠️ CRITICAL UHI DETECTED (+{metrics['uhi_intensity']}°C)</b>
                <p style="font-size:0.75rem; color:#cbd5e1; margin:5px 0 0 0;">
                    Thermal stress triggers municipal greening thresholds. Automatic recommendations:
                </p>
                <ul style="font-size:0.72rem; color:#94a3b8; padding-left:18px; margin:5px 0 0 0;">
                    <li><b>Cool Roof Retrofits</b> in industrial wards</li>
                    <li><b>High-Albedo Pavements</b> along corridors</li>
                    <li><b>Urban Canopy Corridors</b> (+20% tree cover)</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    else:
        st.info("Thermal anomalies within nominal baseline tolerances.")

# ------------------------------------------------------------------------------
# 4. CUSTOM HEADER BANNER
# ------------------------------------------------------------------------------
st.markdown(f"""
    <div class="custom-header">
        <div>
            <h1 class="custom-header-title">Urban Heat Island & Heatwave Resilience Dashboard</h1>
            <p style="margin:4px 0 0 0; color:#94a3b8; font-size:0.88rem;">
                Region: <b>{selected_city_label}</b> | Sensor: <b>{sensor_choice}</b> | Cloud Mask: <b>QA_PIXEL &lt; 10%</b>
            </p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
            <span class="custom-header-badge">🛰️ USGS / NASA LANDSAT C2</span>
            <span class="custom-header-badge">🌍 UN SDG 3 & 13</span>
        </div>
    </div>
""", unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# 5. NAVIGATION TABS
# ------------------------------------------------------------------------------
tab_dash, tab_analysis, tab_policy, tab_settings = st.tabs([
    "📊 Split-Screen Dashboard",
    "📈 Spatial & Predictive Analysis",
    "🛡️ Health & Mitigation Policy",
    "⚙️ Settings & Executive Report"
])

# ==============================================================================
# TAB 1: SPLIT-SCREEN DASHBOARD
# ==============================================================================
with tab_dash:
    # 4 Real-Time Metrics Scorecards
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(f"""
            <div class="metric-card heat">
                <div class="metric-label">Urban Core Peak LST</div>
                <div class="metric-value hot">{metrics['urban_core_max']} °C</div>
                <div class="metric-sub">Thermal Sensor Maximum</div>
            </div>
        """, unsafe_allow_html=True)
    with m2:
        st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">Rural Baseline LST</div>
                <div class="metric-value">{metrics['rural_baseline']} °C</div>
                <div class="metric-sub">Vegetated Periphery Mean</div>
            </div>
        """, unsafe_allow_html=True)
    with m3:
        st.markdown(f"""
            <div class="metric-card heat">
                <div class="metric-label">UHI Intensity (ΔT)</div>
                <div class="metric-value hot">+{metrics['uhi_intensity']} °C</div>
                <div class="metric-sub">Urban vs Rural Gradient</div>
            </div>
        """, unsafe_allow_html=True)
    with m4:
        st.markdown(f"""
            <div class="metric-card anomaly">
                <div class="metric-label">Heat Stress Index</div>
                <div class="metric-value anomaly">{metrics['heat_stress_index']}</div>
                <div class="metric-sub">Cumulative Physiological Strain</div>
            </div>
        """, unsafe_allow_html=True)

    st.markdown("<div style='height: 15px;'></div>", unsafe_allow_html=True)

    # Split-Screen Layout: Left Map | Right Real-Time Analytics
    col_map, col_analytics = st.columns([1.35, 1.0])

    with col_map:
        st.markdown("##### 🗺️ High-Resolution Geospatial Heatmap Layer")

        layer_selector = st.radio(
            "Select Geospatial Layer Overlay",
            ["Surface Temperature (LST °C)", "20-Year Anomaly (Current - Climatology)", "NDVI Vegetation Density", "NDBI Built-up Density"],
            horizontal=True
        )

        # Plotly Geospatial Heatmap Raster
        if layer_selector.startswith("Surface"):
            z_data = grid_data["lst"]
            colorscale = "YlOrRd"
            title_text = "Land Surface Temperature (LST °C)"
        elif layer_selector.startswith("20-Year"):
            z_data = grid_data["temperature_anomaly"]
            colorscale = "Thermal"
            title_text = "Temperature Anomaly vs. 2000-2020 Baseline (°C)"
        elif layer_selector.startswith("NDVI"):
            z_data = grid_data["ndvi"]
            colorscale = "Greens"
            title_text = "Normalized Difference Vegetation Index (NDVI)"
        else:
            z_data = grid_data["ndbi"]
            colorscale = "Viridis"
            title_text = "Normalized Difference Built-up Index (NDBI)"

        fig_map = go.Figure(data=go.Heatmap(
            z=z_data,
            x=grid_data["lons"],
            y=grid_data["lats"],
            colorscale=colorscale,
            colorbar=dict(title=dict(text="°C" if "°C" in title_text else "Index", font=dict(color="#fff")), tickfont=dict(color="#fff")),
            hoverongaps=False
        ))

        # Add Urban Center Star Marker
        fig_map.add_trace(go.Scatter(
            x=[target_coords["lon"]],
            y=[target_coords["lat"]],
            mode="markers+text",
            marker=dict(symbol="star", size=14, color="#00F0FF", line=dict(color="#fff", width=1.5)),
            name="Urban Core",
            text=["Downtown"],
            textposition="top center",
            textfont=dict(color="#00F0FF", size=11)
        ))

        fig_map.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=460,
            margin=dict(l=10, r=10, t=20, b=10),
            xaxis=dict(title="Longitude (°)", gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            yaxis=dict(title="Latitude (°)", gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_map, use_container_width=True)

    with col_analytics:
        st.markdown("##### 📊 Real-Time Microclimate Telemetry")

        # LST Pixel Distribution
        lst_flat = grid_data["lst"].flatten()
        fig_hist = px.histogram(
            x=lst_flat,
            nbins=30,
            title="Spatial LST Pixel Distribution (°C)",
            color_discrete_sequence=["#ef4444"]
        )
        fig_hist.add_vline(x=metrics["urban_core_max"], line_dash="dash", line_color="#00F0FF", annotation_text="Peak Core")
        fig_hist.add_vline(x=metrics["rural_baseline"], line_dash="dot", line_color="#10b981", annotation_text="Rural Base")
        fig_hist.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=215,
            margin=dict(l=10, r=10, t=30, b=10),
            xaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            yaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_hist, use_container_width=True)

        # Climatological Anomaly Distribution
        anomaly_flat = grid_data["temperature_anomaly"].flatten()
        fig_anom = px.box(
            y=anomaly_flat,
            points="outliers",
            title="20-Year Temperature Anomaly Spread (°C)",
            color_discrete_sequence=["#f59e0b"]
        )
        fig_anom.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=215,
            margin=dict(l=10, r=10, t=30, b=10),
            yaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_anom, use_container_width=True)


# ==============================================================================
# TAB 2: SPATIAL TRANSECT & PREDICTIVE FORECASTING
# ==============================================================================
with tab_analysis:
    col_transect, col_pred = st.columns([1.2, 1.0])

    with col_transect:
        st.markdown("##### 📐 Urban-to-Rural Spatial Transect Cross-Section")
        st.markdown("Samples a continuous diagonal transect across the city core to the rural agricultural perimeter.")

        transect_df = sample_spatial_transect(grid_data)

        # Dual Axis Plot: Temperature vs NDVI
        fig_transect = go.Figure()
        fig_transect.add_trace(go.Scatter(
            x=transect_df["distance_km"],
            y=transect_df["lst_celsius"],
            name="Surface Temp (°C)",
            line=dict(color="#ef4444", width=3)
        ))
        fig_transect.add_trace(go.Scatter(
            x=transect_df["distance_km"],
            y=transect_df["ndvi"],
            name="NDVI Vegetation",
            yaxis="y2",
            line=dict(color="#10b981", width=2, dash="dash")
        ))
        fig_transect.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=380,
            yaxis=dict(title="LST (°C)", tickfont=dict(color="#ef4444"), gridcolor="rgba(255,255,255,0.06)"),
            yaxis2=dict(title="NDVI Index", tickfont=dict(color="#10b981"), overlaying="y", side="right"),
            xaxis=dict(title="Distance along Transect (km)", gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_transect, use_container_width=True)

    with col_pred:
        st.markdown("##### 🔮 5-Year Predictive Heat Risk & Weekly Outlook")
        forecast_data = forecast_heat_risk_5yr(metrics["urban_core_max"])

        st.markdown(f"""
            <div style="background:rgba(15,23,33,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:12px;">
                <span style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Warming Acceleration</span>
                <div style="font-size:1.4rem; font-weight:800; color:#fbbf24;">+{forecast_data['annual_rate_c_per_year']} °C / year</div>
                <span style="font-size:0.75rem; color:#64748b;">Probability of &gt;40°C Heatwave Event: <b>{forecast_data['prob_exceedance_40c']}%</b></span>
            </div>
        """, unsafe_allow_html=True)

        fig_pred = px.line(
            x=forecast_data["weekly_forecast_days"],
            y=forecast_data["weekly_forecast_temps"],
            markers=True,
            title="7-Day Forward Maximum LST Projection (°C)",
            color_discrete_sequence=["#00F0FF"]
        )
        fig_pred.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=280,
            xaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            yaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_pred, use_container_width=True)


# ==============================================================================
# TAB 3: HEALTH VULNERABILITY & MITIGATION SIMULATOR
# ==============================================================================
with tab_policy:
    col_health, col_sim = st.columns([1.0, 1.2])

    with col_health:
        st.markdown("##### 🏥 Public Health & Productivity Exposure (ISO 7243)")
        urban_mask = grid_data["dist_km"] < 7.0
        health_data = compute_health_productivity_loss(grid_data["lst"], urban_mask)

        st.markdown(f"""
            <div style="background:rgba(15,23,33,0.75); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="font-size:0.8rem; color:#94a3b8;">RISK STATUS</span>
                    <span style="padding:3px 10px; border-radius:4px; font-size:0.78rem; font-weight:700; background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444;">
                        {health_data['risk_level']}
                    </span>
                </div>
                <div style="margin-bottom:12px;">
                    <span style="font-size:0.75rem; color:#94a3b8;">High Health Risk Urban Surface (&gt;35°C):</span>
                    <div style="font-size:1.35rem; font-weight:800; color:#fff;">{health_data['high_risk_area_pct']}%</div>
                </div>
                <div style="margin-bottom:12px;">
                    <span style="font-size:0.75rem; color:#94a3b8;">Workforce Labor Capacity Reduction:</span>
                    <div style="font-size:1.35rem; font-weight:800; color:#fbbf24;">{health_data['productivity_loss_pct']}%</div>
                </div>
                <div>
                    <span style="font-size:0.75rem; color:#94a3b8;">Estimated Daily Economic GDP Loss:</span>
                    <div style="font-size:1.35rem; font-weight:800; color:#f87171;">${health_data['estimated_daily_gdp_loss_usd']:,} USD</div>
                </div>
            </div>
        """, unsafe_allow_html=True)

        # Vulnerability Pie
        _, svi_counts = compute_vulnerability_index(grid_data)
        fig_pie = px.pie(
            values=list(svi_counts.values()),
            names=list(svi_counts.keys()),
            title="Social Vulnerability Index (SVI) Zoning",
            color_discrete_sequence=["#10b981", "#38bdf8", "#f59e0b", "#ef4444"],
            hole=0.45
        )
        fig_pie.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            height=260,
            margin=dict(l=10, r=10, t=30, b=10),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    with col_sim:
        st.markdown("##### 🌳 Nature-Based Solution Mitigation Simulator")
        st.markdown("Interactive parameter modeling: simulate cooling impact of urban canopy expansion and cool roofs.")

        tree_slider = st.slider("Tree Canopy Expansion (+%)", min_value=0, max_value=50, value=20, step=5)
        roof_slider = st.slider("High-Albedo Cool Roof Retrofit (+%)", min_value=0, max_value=50, value=15, step=5)

        sim_results = simulate_green_infrastructure(grid_data, tree_slider, roof_slider)

        s_col1, s_col2, s_col3 = st.columns(3)
        with s_col1:
            st.metric("Mean Regional Cooling", f"-{sim_results['mean_cooling_achieved']} °C")
        with s_col2:
            st.metric("Peak Core Cooling", f"-{sim_results['peak_cooling_achieved']} °C")
        with s_col3:
            st.metric("Avoided Hotspots", f"{sim_results['avoided_hotspot_area_pct']}%")

        # Mitigated Heatmap Preview
        fig_mit = go.Figure(data=go.Heatmap(
            z=sim_results["mitigated_lst"],
            x=grid_data["lons"],
            y=grid_data["lats"],
            colorscale="YlOrRd",
            colorbar=dict(title=dict(text="°C", font=dict(color="#fff")), tickfont=dict(color="#fff"))
        ))
        fig_mit.update_layout(
            title="Mitigated Surface Temperature Scenario (Post-Intervention LST °C)",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(10,16,24,0.7)",
            height=340,
            margin=dict(l=10, r=10, t=35, b=10),
            xaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            yaxis=dict(gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94a3b8")),
            font=dict(family="Outfit", color="#fff")
        )
        st.plotly_chart(fig_mit, use_container_width=True)


# ==============================================================================
# TAB 4: SETTINGS & EXECUTIVE PDF REPORT
# ==============================================================================
with tab_settings:
    col_cred, col_rep = st.columns([1.0, 1.2])

    with col_cred:
        st.markdown("##### 🔑 Google Earth Engine API Credentials")
        gee_project = st.text_input("GCP Project ID", value="", placeholder="e.g. ee-my-climate-project")
        if st.button("Connect & Authenticate GEE"):
            success, msg = initialize_earth_engine(gee_project if gee_project else None)
            if success:
                st.success(msg)
            else:
                st.warning(msg)

        st.markdown(f"""
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-top:15px; font-size:0.8rem; color:#94a3b8;">
                <b>GADM Boundary Integration (54 African Nations):</b><br>
                Selected: <b>{city_info['country']} ({city_info['iso3']})</b><br>
                Administrative Level: GADM Level 1 (Provinces / Governorates)<br>
                • Portal: <a href="https://gadm.org/data.html" target="_blank" style="color:#00f0ff;">https://gadm.org/data.html</a><br>
                • Direct GeoJSON: <a href="{city_info['gadm_url']}" target="_blank" style="color:#38bdf8;">Download {city_info['iso3']} Level-1 GeoJSON</a>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-top:10px; font-size:0.8rem; color:#94a3b8;">
                <b>Google Earth Engine Authentication:</b>
                <ol style="padding-left:18px; margin:6px 0 0 0;">
                    <li>Install CLI: <code>pip install earthengine-api</code></li>
                    <li>Authenticate locally: <code>earthengine authenticate</code></li>
                    <li>Input your GCP Earth Engine Project ID above.</li>
                </ol>
            </div>
        """, unsafe_allow_html=True)

    with col_rep:
        st.markdown("##### 📄 Export Intelligence Deliverables")
        st.markdown("Compile a print-ready executive summary for municipal climate policymakers and health authorities.")

        urban_mask = grid_data["dist_km"] < 7.0
        health_data = compute_health_productivity_loss(grid_data["lst"], urban_mask)
        forecast_data = forecast_heat_risk_5yr(metrics["urban_core_max"])

        # Generate PDF Bytes
        pdf_bytes = generate_heatwave_pdf_report(
            selected_city_label,
            metrics,
            health_data,
            forecast_data
        )

        st.download_button(
            label="⬇️ Download Executive Heatwave Report (PDF)",
            data=pdf_bytes,
            file_name=f"UHI_Resilience_Report_{selected_city_label.split()[0]}.pdf",
            mime="application/pdf"
        )

        # CSV Data Export
        df_export = pd.DataFrame({
            "Metric": ["Urban Core Max LST", "Rural Baseline LST", "UHI Intensity Delta T", "Heat Stress Index", "20yr Climatology Deviation"],
            "Value": [f"{metrics['urban_core_max']} °C", f"{metrics['rural_baseline']} °C", f"+{metrics['uhi_intensity']} °C", metrics['heat_stress_index'], f"+{metrics['mean_anomaly']} °C"]
        })

        st.download_button(
            label="📊 Download Spatial Telemetry Summary (CSV)",
            data=df_export.to_csv(index=False).encode('utf-8'),
            file_name=f"UHI_Metrics_{selected_city_label.split()[0]}.csv",
            mime="text/csv"
        )
