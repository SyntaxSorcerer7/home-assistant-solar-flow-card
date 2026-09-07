(() => {
"use strict";

// Reusable, dependency-free Web Component for the solar house / grid graphic.
// Power values passed as numbers are interpreted as watts and formatted automatically.
// Strings are rendered verbatim, e.g. "1,54 kW".

const DEFAULT_SOLAR_FLOW_DATA = Object.freeze({
  pvDirectTotal: null,
  pvDirect1: null,
  pvDirect2: null,
  pvDirect3: null,
  pvBatteryTotal: null,
  pvBattery1: null,
  pvBattery2: null,
  inverterPower: null,
  batteryPower: null,
  batterySoc: null,
  housePower: null,
  autarky: null,
  gridImport: null,
  gridExport: null
});

const ATTRIBUTE_TO_KEY = Object.freeze({
  "pv-direct-total": "pvDirectTotal",
  "pv-direct-1": "pvDirect1",
  "pv-direct-2": "pvDirect2",
  "pv-direct-3": "pvDirect3",
  "pv-battery-total": "pvBatteryTotal",
  "pv-battery-1": "pvBattery1",
  "pv-battery-2": "pvBattery2",
  "inverter-power": "inverterPower",
  "battery-power": "batteryPower",
  "battery-soc": "batterySoc",
  "house-power": "housePower",
  "autarky": "autarky",
  "grid-import": "gridImport",
  "grid-export": "gridExport"
});

const POWER_KEYS = new Set([
  "pvDirectTotal", "pvDirect1", "pvDirect2", "pvDirect3",
  "pvBatteryTotal", "pvBattery1", "pvBattery2",
  "inverterPower", "batteryPower", "housePower", "gridImport", "gridExport"
]);
const PERCENT_KEYS = new Set(["batterySoc", "autarky"]);

const template = document.createElement("template");
template.innerHTML = `
  <style>:host{
  --solar-orange:#ff8a00;
  --solar-green:#41c45a;
  --solar-purple:#9b5de5;
  --solar-blue:#1786ff;
  --solar-red:#ef5a45;
  --solar-battery:#14b8a6;
  display:block;
  width:100%;
  min-width:0;
  font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}
.wrap{width:100%;line-height:1}
svg{width:100%;height:auto;display:block;overflow:visible}
.softShadow{filter:url(#shadow)}
.title{font-size:20px;font-weight:700;fill:#111827}
.big{font-size:31px;font-weight:800;fill:#111827}
.small{font-size:16px;font-weight:600;fill:#111827}
.tiny{font-size:13px;font-weight:600;fill:#374151}
.white{fill:#fff}
.valueBadge text{font-weight:800}
.roomStroke{fill:none;stroke:var(--solar-red);stroke-width:4}
.flow-orange{fill:none;stroke:var(--solar-orange);stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.flow-green{fill:none;stroke:var(--solar-green);stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.flow-purple{fill:none;stroke:var(--solar-purple);stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.flow-blue{fill:none;stroke:var(--solar-blue);stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.flow-battery{fill:none;stroke:var(--solar-battery);stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.flow-pulse{
  fill:none;
  stroke-width:4 !important;
  stroke-linejoin:round;
  stroke-linecap:round;
  stroke-dasharray:22 48;
  stroke-dashoffset:0;
  opacity:.72;
  pointer-events:none;
  animation:energyFlow 2.6s linear infinite;
  filter:drop-shadow(0 0 2px rgba(255,255,255,.18));
}
.flow-orange.flow-pulse{stroke:#ffa43d !important}
.flow-green.flow-pulse{stroke:#69cf78 !important}
.flow-purple.flow-pulse{stroke:#ad7ae9 !important}
.flow-blue.flow-pulse{stroke:#4a9cff !important}
.flow-battery.flow-pulse{stroke:#42c8bc !important}
.flow-pulse.flow-inactive{animation:none;opacity:0}
@keyframes energyFlow{to{stroke-dashoffset:-70}}
@media (prefers-reduced-motion:reduce){.flow-pulse{animation:none;opacity:0}}
.panel-dark{fill:#0d2942;stroke:#1f2937;stroke-width:2}</style>
  <div class="wrap">
<svg part="svg" role="img" aria-label="Energiefluss einer Solaranlage mit Haus, PV-Modulen, Wechselrichter, Batterie und Stromnetz" viewBox="350 70 1180 710" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#64748b" flood-opacity=".20"/>
          </filter>

          <linearGradient id="roofGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#2d3941"/>
            <stop offset="1" stop-color="#202a31"/>
          </linearGradient>
          <linearGradient id="roomGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#f5efe8"/>
            <stop offset="1" stop-color="#e7dfd6"/>
          </linearGradient>
          <linearGradient id="basementGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#e7e7e5"/>
            <stop offset="1" stop-color="#d8d9db"/>
          </linearGradient>

          <marker id="arrowOrange" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="#ff8a00"/>
          </marker>
          <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="#41c45a"/>
          </marker>
          <marker id="arrowPurple" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="#9b5de5"/>
          </marker>
          <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="#1786ff"/>
          </marker>
          <marker id="arrowBattery" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="#14b8a6"/>
          </marker>
        </defs>
<!-- HOUSE -->
        <g class="softShadow">
          <!-- outer body -->
          <rect x="430" y="270" width="790" height="510" rx="2" fill="#f3f4f6" stroke="#99a2aa" stroke-width="2"/>
          <!-- roof -->
          <polygon points="390,272 525,103 1160,103 1252,272" fill="url(#roofGrad)" stroke="#1f2937" stroke-width="3"/>
          <polygon points="1160,103 1252,272 1212,272 1138,124" fill="#1b252c"/>
          <rect x="919" y="75" width="40" height="34" fill="#69747b" stroke="#1f2937" stroke-width="2"/>
          <!-- rooms -->
          <rect x="445" y="282" width="750" height="220" fill="url(#roomGrad)"/>
          <rect x="445" y="522" width="750" height="238" fill="url(#basementGrad)"/>
          <line x1="778" y1="282" x2="778" y2="502" stroke="#c5bcb3" stroke-width="5"/>
          <line x1="430" y1="510" x2="1220" y2="510" stroke="#b7bcc2" stroke-width="8"/>
        </g>

        <!-- Simple furniture -->
        <g opacity=".95">
          <!-- sofa -->
          <rect x="500" y="425" width="128" height="38" rx="10" fill="#e9e4dd" stroke="#b6aea5"/>
          <rect x="490" y="447" width="148" height="40" rx="7" fill="#ddd7d0" stroke="#b6aea5"/>
          <rect x="505" y="388" width="30" height="56" rx="10" fill="#dfdad2"/>
          <rect x="605" y="388" width="30" height="56" rx="10" fill="#dfdad2"/>
          <rect x="649" y="381" width="70" height="48" rx="2" fill="#17191b"/>
          <rect x="659" y="433" width="56" height="9" fill="#756f69"/>
          <!-- table / kitchen -->
          <rect x="807" y="431" width="92" height="8" fill="#9b6a40"/>
          <rect x="824" y="439" width="7" height="47" fill="#6f543e"/>
          <rect x="884" y="439" width="7" height="47" fill="#6f543e"/>
          <rect x="947" y="383" width="88" height="103" fill="#d7cec5" stroke="#bdb3a9"/>
          <rect x="1038" y="409" width="88" height="77" fill="#dfd7cf" stroke="#bdb3a9"/>
          <!-- lamps -->
          <line x1="592" y1="296" x2="592" y2="355" stroke="#4b5563" stroke-width="2"/>
          <path d="M577 355 Q592 339 607 355 L604 367 L580 367 Z" fill="#7c8388"/>
          <ellipse cx="592" cy="368" rx="14" ry="4" fill="#ffb347"/>
          <line x1="918" y1="296" x2="918" y2="355" stroke="#4b5563" stroke-width="2"/>
          <path d="M903 355 Q918 339 933 355 L930 367 L906 367 Z" fill="#7c8388"/>
          <ellipse cx="918" cy="368" rx="14" ry="4" fill="#ffb347"/>
          <!-- plant -->
          <rect x="495" y="448" width="20" height="40" rx="4" fill="#f0eee9" stroke="#bfb7ae"/>
          <ellipse cx="506" cy="417" rx="12" ry="24" fill="#738f3a"/>
          <ellipse cx="492" cy="425" rx="9" ry="20" fill="#82994d"/>
          <ellipse cx="516" cy="432" rx="10" ry="20" fill="#667f36"/>
        </g>

        <!-- Dünne Gruppenrahmen um die PV-Felder -->
        <rect x="538" y="120" width="382" height="98" rx="10"
              fill="none" stroke="#ff8a00" stroke-width="2"/>
        <rect x="924" y="120" width="258" height="98" rx="10"
              fill="none" stroke="#41c45a" stroke-width="2"/>

        <!-- Roof PV panels -->
        <g class="softShadow">
          <!-- orange group -->
          <g>
            <rect class="panel-dark" x="548" y="130" width="112" height="78" rx="6" stroke="#ff8a00" stroke-width="4"/>
            <rect class="panel-dark" x="673" y="130" width="112" height="78" rx="6" stroke="#ff8a00" stroke-width="4"/>
            <rect class="panel-dark" x="798" y="130" width="112" height="78" rx="6" stroke="#ff8a00" stroke-width="4"/>
            <g stroke="#5d7fa0" stroke-width="1" opacity=".7">
              <path d="M566 130v78M585 130v78M604 130v78M623 130v78M642 130v78"/>
              <path d="M691 130v78M710 130v78M729 130v78M748 130v78M767 130v78"/>
              <path d="M816 130v78M835 130v78M854 130v78M873 130v78M892 130v78"/>
              <path d="M548 149h112M548 169h112M548 189h112"/>
              <path d="M673 149h112M673 169h112M673 189h112"/>
              <path d="M798 149h112M798 169h112M798 189h112"/>
            </g>
          </g>

          <!-- green group -->
          <g>
            <rect class="panel-dark" x="934" y="130" width="112" height="78" rx="6" stroke="#64d26f" stroke-width="4"/>
            <rect class="panel-dark" x="1060" y="130" width="112" height="78" rx="6" stroke="#64d26f" stroke-width="4"/>
            <g stroke="#5d7fa0" stroke-width="1" opacity=".7">
              <path d="M952 130v78M971 130v78M990 130v78M1009 130v78M1028 130v78"/>
              <path d="M1078 130v78M1097 130v78M1116 130v78M1135 130v78M1154 130v78"/>
              <path d="M934 149h112M934 169h112M934 189h112"/>
              <path d="M1060 149h112M1060 169h112M1060 189h112"/>
            </g>
          </g>
        </g>

        <!-- panel labels: Wattwerte direkt über den jeweiligen Modulen -->
        <g class="valueBadge">
          <rect x="570" y="111" width="68" height="27" rx="12" fill="#fff" stroke="#ff8a00" stroke-width="1.8"/>
          <text x="604" y="130" text-anchor="middle" class="tiny" fill="#ff8a00"><tspan font-weight="800">E1</tspan> <tspan id="pvDirect1">343 W</tspan></text>

          <rect x="695" y="111" width="68" height="27" rx="12" fill="#fff" stroke="#ff8a00" stroke-width="1.8"/>
          <text x="729" y="130" text-anchor="middle" class="tiny" fill="#ff8a00"><tspan font-weight="800">E2</tspan> <tspan id="pvDirect2">406 W</tspan></text>

          <rect x="820" y="111" width="68" height="27" rx="12" fill="#fff" stroke="#ff8a00" stroke-width="1.8"/>
          <text x="854" y="130" text-anchor="middle" class="tiny" fill="#ff8a00"><tspan font-weight="800">E3</tspan> <tspan id="pvDirect3">354 W</tspan></text>

          <rect x="956" y="111" width="68" height="27" rx="12" fill="#fff" stroke="#41c45a" stroke-width="1.8"/>
          <text x="990" y="130" text-anchor="middle" class="tiny" fill="#22a83d"><tspan font-weight="800">PV 1</tspan> <tspan id="pvBattery1">263 W</tspan></text>

          <rect x="1082" y="111" width="68" height="27" rx="12" fill="#fff" stroke="#41c45a" stroke-width="1.8"/>
          <text x="1116" y="130" text-anchor="middle" class="tiny" fill="#22a83d"><tspan font-weight="800">PV 2</tspan> <tspan id="pvBattery2">273 W</tspan></text>
        </g>


        <!-- orange PV direct: connected lines, no arrowheads at panel joins -->
        <path d="M604 208 V227 H625" class="flow-orange" data-flow-key="pvDirect1"/>
        <path d="M729 208 V227 H625" class="flow-orange" data-flow-key="pvDirect2"/>
        <path d="M854 208 V227 H625" class="flow-orange" data-flow-key="pvDirect3"/>
        <path d="M625 227 V495 H580 V560" class="flow-orange" data-flow-key="pvDirectTotal" marker-end="url(#arrowOrange)"/>

        <!-- Orange total on the line -->
        <g class="valueBadge">
          <rect x="581" y="309" width="88" height="34" rx="15" fill="#fff" stroke="#ff8a00" stroke-width="2"/>
          <text x="625" y="333" text-anchor="middle" class="small" fill="#ff8a00" id="pvDirectTotalFlow">1,10 kW</text>
        </g>

        <!-- green PV battery: connected to downward trunk, no useless arrow above -->
        <path d="M990 208 V227 H1022" class="flow-green" data-flow-key="pvBattery1"/>
        <path d="M1116 208 V227 H1022" class="flow-green" data-flow-key="pvBattery2"/>
        <path d="M1022 227 V708 H842" class="flow-green" data-flow-key="pvBatteryTotal" marker-end="url(#arrowGreen)"/>

        <!-- House load outline -->
        <rect x="444" y="280" width="752" height="225" rx="16" class="roomStroke"/>
        <g>
          <rect x="1035" y="287" width="124" height="100" rx="16" fill="#ef5a45"/>
          <text x="1097" y="317" text-anchor="middle" class="title white">Haus</text>
          <text x="1097" y="354" text-anchor="middle" class="big white" id="housePower">798 W</text>
          <text x="1097" y="379" text-anchor="middle" class="small white">Autarkie <tspan id="autarky">100 %</tspan></text>
        </g>

        <!-- Inverter -->
        <g class="softShadow">
          <rect x="540" y="566" width="92" height="95" rx="12" fill="#f3f4f6" stroke="#9b5de5" stroke-width="2"/>
          <text x="586" y="592" text-anchor="middle" class="tiny">Wechselrichter</text>
          <circle cx="618" cy="576" r="4" fill="#14a44d"/>
          <text x="586" y="628" text-anchor="middle" font-size="29" font-weight="800" fill="#9b5de5">∿</text>
          <rect x="548" y="636" width="76" height="19" rx="9.5" fill="#fff" stroke="#9b5de5" stroke-width="1.4"/>
          <text x="586" y="650" text-anchor="middle" font-size="12.5" font-weight="800" fill="#8a46d8" id="inverterPowerGraphic">1,54 kW</text>
        </g>

        <!-- Battery -->
        <g class="softShadow">
          <rect x="720" y="630" width="124" height="130" rx="12" fill="#f3f4f6" stroke="#14b8a6" stroke-width="2"/>
          <rect x="752" y="680" width="27" height="52" rx="3" fill="#14b8a6" stroke="#0f766e" stroke-width="2"/>
          <rect x="759" y="672" width="13" height="8" rx="1" fill="#14b8a6"/>
          <g fill="#14b8a6">
            <rect x="808" y="682" width="14" height="10" rx="2"/>
            <rect x="808" y="696" width="14" height="10" rx="2"/>
            <rect x="808" y="710" width="14" height="10" rx="2"/>
            <rect x="808" y="724" width="14" height="10" rx="2"/>
            <rect x="808" y="738" width="14" height="10" rx="2"/>
          </g>
          <circle cx="810" cy="660" r="20" fill="#fff" stroke="#14b8a6" stroke-width="2"/>
          <text x="810" y="667" text-anchor="middle" class="small" fill="#0f766e" id="batterySocGraphic">99%</text>
        </g>

        <!-- Battery to inverter: only this direction -->
        <path d="M720 711 H585 V665" class="flow-battery" data-flow-key="batteryPower" marker-end="url(#arrowBattery)"/>
        <g class="valueBadge">
          <rect x="625" y="697" width="74" height="31" rx="14" fill="#fff" stroke="#14b8a6" stroke-width="2"/>
          <text x="662" y="719" text-anchor="middle" class="small" fill="#0f766e" id="batteryPowerFlow">440 W</text>
        </g>

        <!-- Green PV-battery value directly on line -->
        <g class="valueBadge">
          <rect x="895" y="697" width="76" height="31" rx="14" fill="#fff" stroke="#41c45a" stroke-width="2"/>
          <text x="933" y="719" text-anchor="middle" class="small" fill="#22a83d" id="pvBatteryTotalFlow">536 W</text>
        </g>

        <!-- inverter -> house, exactly one arrowhead -->
        <path d="M632 596 H837 V510" class="flow-purple" data-flow-key="inverterPower" marker-end="url(#arrowPurple)"/>
        <g class="valueBadge">
          <rect x="792" y="548" width="88" height="34" rx="15" fill="#fff" stroke="#9b5de5" stroke-width="2"/>
          <text x="836" y="572" text-anchor="middle" class="small" fill="#8a46d8" id="inverterPowerFlow">1,54 kW</text>
        </g>

        <!-- Direkte Netzflüsse ohne separates Netzanschlusspunkt-Symbol -->
        <!-- Einspeisung: direkt vom Wechselrichter zum Strommast, lila -->
        <path d="M632 620 H1344" class="flow-purple" data-flow-key="gridExport" marker-end="url(#arrowPurple)"/>
        <g class="valueBadge">
          <rect x="1168" y="600" width="84" height="32" rx="14" fill="#fff" stroke="#9b5de5" stroke-width="2"/>
          <text x="1210" y="623" text-anchor="middle" class="small" fill="#8a46d8" id="gridExportFlow">745 W</text>
        </g>

        <!-- Bezug: direkt vom Strommast zur Wohnung, blau -->
        <path d="M1344 678 H1100 V509" class="flow-blue" data-flow-key="gridImport" marker-end="url(#arrowBlue)"/>
        <g class="valueBadge">
          <rect x="1168" y="661" width="84" height="32" rx="14" fill="#fff" stroke="#1786ff" stroke-width="2"/>
          <text x="1210" y="684" text-anchor="middle" class="small" fill="#1172df" id="gridImportFlow">0 W</text>
        </g>

        <!-- Grid pylon -->
        <g transform="translate(1360,445)" opacity=".9">
          <path d="M58 0 L20 282 M58 0 L96 282 M31 205 H85 M37 164 H79 M43 121 H73 M48 80 H68" stroke="#1786ff" stroke-width="4" fill="none"/>
          <path d="M58 0 L0 74 H116 Z M15 73 H101 M22 116 H94" stroke="#1786ff" stroke-width="3" fill="none"/>
          <path d="M20 282 H96" stroke="#1786ff" stroke-width="4"/>
          <path d="M0 74 H-25 M116 74 H141" stroke="#1786ff" stroke-width="3"/>
          <path d="M-25 74 v30 M141 74 v30" stroke="#1786ff" stroke-width="2"/>
        </g>


      </svg>
  </div>
`;

class SolarEnergyFlow extends HTMLElement {
  static get observedAttributes() {
    return Object.keys(ATTRIBUTE_TO_KEY);
  }

  constructor() {
    super();
    this._data = { ...DEFAULT_SOLAR_FLOW_DATA };
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(template.content.cloneNode(true));
    this._addEnergyFlowAnimation();
    this._render();
  }

  connectedCallback() {
    this._readInitialAttributes();
    this._render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || newValue == null) return;
    const key = ATTRIBUTE_TO_KEY[name];
    if (!key) return;
    this._data[key] = this._coerceAttributeValue(newValue);
    this._render();
  }

  /** Replace all values. Missing keys fall back to defaults. */
  set data(values) {
    this._data = { ...DEFAULT_SOLAR_FLOW_DATA, ...(values || {}) };
    this._render();
  }

  get data() {
    return { ...this._data };
  }

  /** Update only the supplied values; ideal for live data. */
  update(values) {
    this._data = { ...this._data, ...(values || {}) };
    this._render();
  }

  _readInitialAttributes() {
    for (const [attribute, key] of Object.entries(ATTRIBUTE_TO_KEY)) {
      if (this.hasAttribute(attribute)) {
        this._data[key] = this._coerceAttributeValue(this.getAttribute(attribute));
      }
    }
  }

  _coerceAttributeValue(value) {
    const trimmed = String(value).trim();
    if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
      return Number(trimmed.replace(",", "."));
    }
    return trimmed;
  }

  _formatValue(key, value) {
    if (POWER_KEYS.has(key)) return this._formatPower(value);
    if (PERCENT_KEYS.has(key)) return this._formatPercent(value);
    return String(value ?? "–");
  }

  _formatPower(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "–");
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `${(value / 1000).toLocaleString(this.locale || "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;
    }
    return `${value.toLocaleString(this.locale || "de-DE", { minimumFractionDigits: this.powerDecimals ?? 0, maximumFractionDigits: this.powerDecimals ?? 0 })} W`;
  }

  _formatPercent(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "–");
    return `${Math.max(0, Math.min(100, value)).toLocaleString(this.locale || "de-DE", { maximumFractionDigits: 0 })} %`;
  }

  _numericPower(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(",", ".");
    const match = raw.match(/^(-?\d+(?:\.\d+)?)(kw|w)?$/);
    if (!match) return null;
    const n = Number(match[1]);
    return match[2] === "kw" ? n * 1000 : n;
  }

  _render() {
    if (!this.shadowRoot) return;
    const bindingMap = {
      pvDirectTotal: ["pvDirectTotalFlow"],
      pvDirect1: ["pvDirect1"],
      pvDirect2: ["pvDirect2"],
      pvDirect3: ["pvDirect3"],
      pvBatteryTotal: ["pvBatteryTotalFlow"],
      pvBattery1: ["pvBattery1"],
      pvBattery2: ["pvBattery2"],
      inverterPower: ["inverterPowerFlow", "inverterPowerGraphic"],
      batteryPower: ["batteryPowerFlow"],
      batterySoc: ["batterySocGraphic"],
      housePower: ["housePower"],
      autarky: ["autarky"],
      gridImport: ["gridImportFlow"],
      gridExport: ["gridExportFlow"]
    };

    for (const [key, ids] of Object.entries(bindingMap)) {
      let formatted = this._formatValue(key, this._data[key]);
      if (key === "batterySoc") formatted = formatted.replace(/\s+/g, "");
      for (const id of ids) {
        const node = this.shadowRoot.getElementById(id);
        if (node) node.textContent = formatted;
      }
    }

    // A 0 W path remains visible, but its moving pulse is stopped.
    this.shadowRoot.querySelectorAll(".flow-pulse[data-flow-key]").forEach((pulse) => {
      const key = pulse.dataset.flowKey;
      const numeric = this._numericPower(this._data[key]);
      pulse.classList.toggle("flow-inactive", numeric === null || numeric <= 1);
    });
  }

  _addEnergyFlowAnimation() {
    const svg = this.shadowRoot.querySelector("svg");
    if (!svg || svg.dataset.flowAnimationReady === "true") return;

    const flowPaths = [...svg.querySelectorAll(
      "path.flow-orange, path.flow-green, path.flow-purple, path.flow-blue, path.flow-battery"
    )];

    flowPaths.forEach((path, index) => {
      const pulse = path.cloneNode(false);
      pulse.removeAttribute("marker-end");
      pulse.removeAttribute("id");
      pulse.classList.add("flow-pulse");
      pulse.style.animationDelay = `${-(index % 5) * 0.32}s`;
      pulse.setAttribute("aria-hidden", "true");
      path.parentNode.insertBefore(pulse, path.nextSibling);
    });

    svg.dataset.flowAnimationReady = "true";
  }
}

if (!customElements.get("solar-energy-flow")) {
  customElements.define("solar-energy-flow", SolarEnergyFlow);
}

window.SolarEnergyFlow = SolarEnergyFlow;
window.DEFAULT_SOLAR_FLOW_DATA = DEFAULT_SOLAR_FLOW_DATA;
})();
