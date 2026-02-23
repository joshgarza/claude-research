---
date: 2026-02-22
topic: WiFi signal strength heat map application
status: complete
tags: [wifi, heatmap, mesh-network, desktop-app, signal-strength, visualization]
---

# WiFi Signal Strength Heat Map Application

## Context
The user has a mesh network and wants to build an application to identify WiFi cold zones in their house. This research covers platform choices, APIs for reading signal strength, heat map rendering, floor plan integration, data collection workflow, mesh network considerations, existing open-source projects, and a recommended tech stack.

## Findings

### 1. Platform Options

| Platform | WiFi Access | Bundle Size | Verdict |
|----------|-------------|-------------|---------|
| **Web App** | None — browsers have zero RSSI access | N/A | Not viable standalone |
| **Electron** | Full via Node.js (`node-wifi`, `child_process`) | ~150MB | Viable, heavy |
| **Tauri 2.0** | Full via Rust backend (shell out to OS tools) | ~8MB | Best choice |
| **Native Desktop** | Full OS APIs (CoreWLAN, wlanapi, nl80211) | Varies | Overkill for cross-platform |
| **Android** | `WifiManager.startScan()` — full access, throttled (4/2min) | N/A | Viable but awkward UX |
| **iOS** | Dead end — no general RSSI API, `CNCopyCurrentNetworkInfo` deprecated | N/A | Not viable |

**Recommendation:** Tauri 2.0 — tiny bundles (~8MB vs 150MB Electron), low memory (~30MB vs ~200MB), TypeScript frontend + Rust backend for system access. Community [`tauri-plugin-network`](https://github.com/HuakunShen/tauri-plugin-network) exists. Electron is the pragmatic fallback if Rust is a dealbreaker.

---

### 2. Accessing WiFi Signal Strength Data

#### Linux
- `iw dev wlan0 link` — current connection RSSI, BSSID, frequency
- `iw dev wlan0 scan` — full AP scan (requires root)
- `nmcli -t -f SSID,BSSID,SIGNAL,FREQ dev wifi list` — NetworkManager, signal as 0-100%
- **[PyRIC](https://github.com/wraith-wireless/PyRIC)** — Python nl80211/netlink interface, no subprocess parsing
- **Note:** `iw` project warns "Do NOT screenscrape this tool, we don't consider its output stable"

#### macOS
- `airport -s` — lists visible networks with RSSI (undocumented Apple utility)
- `wdutil info` — macOS 13+ diagnostics
- **[CoreWLAN](https://developer.apple.com/documentation/corewlan)** — `CWInterface.rssiValue()` returns dBm, `scanForNetworks()` finds APs. Requires code signing.

#### Windows
- `netsh wlan show interfaces` — current connection (signal as 0-100%)
- `netsh wlan show networks mode=bssid` — all visible networks
- **Native Wifi API** (`wlanapi.dll`) — `WlanGetAvailableNetworkList()`
- **Note:** Windows reports 0-100% quality, not dBm. Approximate: dBm ≈ (quality / 2) - 100

#### Node.js Libraries (Cross-Platform)

| Package | Method | Returns |
|---------|--------|---------|
| **[node-wifi](https://github.com/friedrith/node-wifi)** | Wraps `airport`/`netsh`/`nmcli` | `signal_level` (dBm), `quality` (%), `bssid`, `channel` |
| **[node-wifi-scanner](https://github.com/ancasicolica/node-wifi-scanner)** | Wraps `airport`/`netsh`/`iwlist` | `rssi`, `ssid`, `mac` |

All Node.js libraries shell out and parse — fragile but functional. For Tauri, the Rust backend does the same via `std::process::Command`.

---

### 3. Heat Map Generation

#### Interpolation: IDW (Inverse Distance Weighting)

The standard for WiFi heatmaps — every open-source project uses it.

- Formula: value(x) = Σ(wi × vi) / Σ(wi), where wi = 1/distance(x, xi)^p
- Power p=2 to p=5 typical for WiFi
- Simple, fast, no assumptions about data distribution
- Weakness: "bull's-eye" effect around isolated points, can't extrapolate
- Kriging is statistically better but overkill for 20-50 measurement points in a home

#### Visualization Libraries

**WebGL (recommended):**

| Library | Size | Approach |
|---------|------|----------|
| [temperature-map-gl](https://github.com/ham-systems/temperature-map-gl) | ~3KB | Multi-pass WebGL shaders, pure IDW per pixel. Best fit. |
| [webgl-heatmap](https://github.com/pyalot/webgl-heatmap) | ~10KB | Additive blending (Gaussian, not IDW) |

**Canvas fallback:** [simpleheat](https://github.com/mourner/simpleheat) (~1KB, by Leaflet creator) or [heatmap.js](https://github.com/pa7/heatmap.js).

**D3:** [d3-contour](https://d3js.org/d3-contour) for topographic-style contour lines.

#### How wifi-heatmapper Renders (Reference Implementation)

1. Per-pixel IDW in WebGL fragment shader
2. Two-channel texture accumulation: R = weighted value (ui × wi), G = weight sum (wi). Final = R/G
3. Color lookup table texture maps values to gradient (green → blue → yellow → red)
4. Floor plan rendered separately, heatmap overlaid with transparency
5. Adjustable radius slider — GPU handles real-time updates

---

### 4. Floor Plan Integration

**Image upload + calibration** is the universal approach (Ekahau, NetSpot, all open-source tools):

1. User uploads floor plan image (photo, screenshot, export)
2. Displayed as canvas background
3. Click positions to record measurements
4. Optional: two-point scale calibration (click two points, enter real-world distance)

No need for drawing tools or smart home integration — just accept PNG/JPG/SVG.

---

### 5. Data Collection Workflow

#### Click-to-Record (Standard)

1. Load floor plan image
2. Walk to a location in house
3. Click corresponding position on floor plan
4. App records: RSSI, BSSID, SSID, channel, frequency (optionally iperf3 throughput)
5. Colored dot appears (green=strong, red=weak)
6. Repeat for 25-40 points (~15-30 minutes for a whole house)
7. Generate interpolated heatmap

#### Commercial Reference

- **Ekahau** (~$3K/yr): Stop & Go, Continuous Walk, Autopilot (ARKit + LiDAR)
- **NetSpot**: Desktop click-to-record. Good UX reference. Free tier available.

#### Speed Testing

Running **iperf3** at each point adds throughput data — often more useful than raw RSSI since strong signal ≠ fast speeds. Requires iperf3 server on a wired machine. Both wifi-heatmapper and python-wifi-survey-heatmap support this.

---

### 6. Mesh Network Specifics

#### Identifying Connected Mesh Node

Every WiFi scan returns the **BSSID** (MAC address per radio). Each mesh node has unique BSSIDs (one per band: 2.4/5/6 GHz). Record BSSID with each measurement to:
- Group measurements by access point
- Show per-node heatmaps
- Identify roaming boundaries

Mesh nodes typically have sequential MACs sharing the same OUI — group by OUI + MAC proximity.

#### Mesh Controller APIs

| System | API Quality | Details |
|--------|-------------|---------|
| **UniFi** | Best | Official REST API: `/api/s/{site}/stat/sta` (client signal), `/api/s/{site}/stat/device` (APs). [Docs](https://help.ui.com/hc/en-us/articles/30076656117655). Libraries: [PHP](https://github.com/Art-of-WiFi/UniFi-API-client), [Python](https://unificontrol.readthedocs.io/), Node.js |
| **eero** | None official | Unofficial [eero-api](https://pypi.org/project/eero-api/) Python package |
| **Google Wifi** | Unofficial | [GHLocalApi](https://rithvikvibhu.github.io/GHLocalApi/), [googlewifi-api](https://pypi.org/project/googlewifi/) Python |
| **TP-Link Deco** | None | App-only management |

**Key insight:** You don't need the mesh controller API to build a heatmap. OS-level WiFi scanning gives you signal from ALL visible APs regardless of mesh vendor.

#### Useful Heatmap Views for Mesh

1. **Overall signal** — strongest signal at each point from any AP
2. **Per-AP heatmaps** — individual coverage per mesh node (reveals gaps)
3. **Roaming map** — color-coded by connected AP at each point
4. **Signal delta** — difference between strongest and 2nd-strongest AP (low = good overlap)

---

### 7. Open-Source Projects

| Project | Stack | Platforms | Rendering | Speed Test | Active |
|---------|-------|-----------|-----------|------------|--------|
| **[wifi-heatmapper](https://github.com/hnykda/wifi-heatmapper)** | TypeScript/Next.js/React/Tailwind | All | WebGL IDW | iperf3 | 2025 |
| **[python-wifi-survey-heatmap](https://github.com/jantman/python-wifi-survey-heatmap)** | Python/wxPython/scipy | Linux | matplotlib RBF | iperf3 | Maintained |
| **[WiFiSurveyor](https://github.com/ecoAPM/WiFiSurveyor)** | C#/ASP.NET/Vue.js | All | WebGL | No | Maintained |
| **[wifi-heat-mapper](https://github.com/Nischay-Pro/wifi-heat-mapper)** | Python (pip: `whm`) | Linux | matplotlib | iperf3 | Moderate |
| **[wifi-heatmap](https://github.com/benmwebb/wifi-heatmap)** | Python (~200 lines) | Linux | scipy/matplotlib | No | Reference |

**wifi-heatmapper (hnykda)** is the most relevant — 98.5% TypeScript, modern stack, cross-platform, WebGL IDW rendering, iperf3 support. Closest to what you'd build from scratch.

---

### 8. Recommended Tech Stack

#### Option A: Fork wifi-heatmapper (Fastest Path)

Already TypeScript/Next.js/React/Tailwind with WebGL IDW. Extend with:
- BSSID tracking for per-mesh-node heatmaps
- Per-AP views and roaming visualization
- Scale calibration, multi-floor support
- Mesh controller API integration (if using UniFi)

#### Option B: Build with Tauri 2.0 (Clean Architecture)

**Frontend (TypeScript):**
- React 19 + Vite + Tailwind CSS
- WebGL IDW shaders (port from wifi-heatmapper or use [temperature-map-gl](https://github.com/ham-systems/temperature-map-gl))
- Canvas for floor plan + click overlay
- Zustand for state

**Backend (Rust via Tauri):**
- WiFi scanning: `std::process::Command` → `iw` (Linux), `airport` (macOS), `netsh` (Windows)
- Speed testing: spawn iperf3 as subprocess
- Data storage: local JSON files via Tauri filesystem API
- Mesh API: HTTP client for UniFi controller (optional)

**Why Tauri:** 10-20x smaller bundle, 5-8x lower memory, opt-in security model. The Rust code is simple `Command::new("iw")` calls, not complex Rust.

#### Option C: Electron + node-wifi (Pragmatic)

Electron + React 19 + Vite + `node-wifi` for scanning. Same WebGL rendering. Simpler to build, larger to ship.

#### Data Model

```typescript
interface Survey {
  id: string;
  name: string;
  floorPlanImage: string;
  scaleReference?: {
    point1: { x: number; y: number };
    point2: { x: number; y: number };
    realWorldDistance: number; // meters
  };
  measurements: Measurement[];
}

interface Measurement {
  id: string;
  position: { x: number; y: number }; // pixel coords on floor plan
  timestamp: string;
  networks: NetworkReading[];
  speedTest?: SpeedTestResult;
}

interface NetworkReading {
  ssid: string;
  bssid: string;       // identifies specific AP/mesh node
  signalLevel: number;  // dBm (-30 to -90)
  quality: number;      // 0-100%
  channel: number;
  frequency: number;    // MHz
  security: string;
}

interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
}
```

#### RSSI Color Scale

| dBm | Quality | Color |
|-----|---------|-------|
| > -40 | Excellent | Green |
| -40 to -60 | Good | Light Green |
| -60 to -70 | Fair | Yellow |
| -70 to -80 | Weak | Orange |
| < -80 | Poor/Dead | Red |

#### MVP Features

1. Upload floor plan image
2. Click-to-record: walk, click, auto-scan WiFi
3. Record RSSI + BSSID at each point
4. IDW heatmap overlay (WebGL)
5. Filter by SSID (your network only)
6. Save/load survey as JSON

#### Post-MVP

1. Per-AP heatmaps (filter by BSSID/mesh node)
2. iperf3 throughput testing + throughput heatmap
3. Multi-floor support
4. Mesh controller API integration (UniFi)
5. Before/after comparison
6. Export as PNG/PDF

## Open Questions

1. **Tauri WebView + WebGL:** Do IDW shaders work in Tauri's system WebView (WKWebView macOS, WebView2 Windows, WebKitGTK Linux)?
2. **Mesh roaming during survey:** Should the app detect/warn about BSSID changes mid-measurement?
3. **Wall attenuation modeling:** Worth drawing walls for better interpolation, or does dense measurement data make it unnecessary?
4. **WiFi 6E (6GHz band):** Do 6GHz scans require different system calls or permissions?
5. **iperf3 server placement:** For mesh networks, should the server run on the main router, a wired device, or somewhere else?

## Extracted Principles

No new reusable principles extracted — this is application-specific research.
