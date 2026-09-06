class SolarFlowCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement("solar-flow-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Solaranlage",
      entities: {
        pv_inputs: ["sensor.inverter_input_1_power", "sensor.inverter_input_2_power", "sensor.inverter_input_3_power"],
        battery_pv_inputs: ["sensor.battery_solar_input_1_power", "sensor.battery_solar_input_2_power"],
        battery_to_inverter: "sensor.inverter_input_4_power",
        inverter_output: "sensor.inverter_output_power",
        grid_power: "sensor.shelly_3em_pro_total_active_power",
        battery_soc: "sensor.battery_state_of_charge",
        solar_energy_today: "sensor.solar_energy_today",
        grid_import_energy_today: "sensor.grid_import_energy_today",
        grid_export_energy_today: "sensor.grid_export_energy_today",
        house_energy_today: "sensor.house_energy_today"
      }
    };
  }

  setConfig(config) {
    if (!config?.entities) throw new Error("'entities' fehlt in der Card-Konfiguration.");
    const required = ["pv_inputs", "battery_pv_inputs", "battery_to_inverter", "inverter_output", "grid_power", "battery_soc"];
    const missing = required.filter((key) => !config.entities[key]);
    if (missing.length) throw new Error(`Fehlende Entitäten: ${missing.join(", ")}`);
    if (!Array.isArray(config.entities.pv_inputs) || config.entities.pv_inputs.length !== 3) {
      throw new Error("'entities.pv_inputs' muss genau drei Sensoren enthalten.");
    }
    if (!Array.isArray(config.entities.battery_pv_inputs) || config.entities.battery_pv_inputs.length !== 2) {
      throw new Error("'entities.battery_pv_inputs' muss genau zwei Sensoren enthalten.");
    }
    this.config = {
      title: "Solaranlage",
      grid_positive_is_import: true,
      power_decimals: 0,
      energy_decimals: 2,
      ...config,
      entities: { ...config.entities }
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;
    if (!this._root) this.render();
    this.updateValues();
  }

  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, rows: 8, min_columns: 6, min_rows: 7 }; }

  entityValue(entityId) {
    const state = this._hass?.states?.[entityId];
    const value = Number.parseFloat(state?.state);
    return Number.isFinite(value) ? value : null;
  }

  powerValue(entityId) {
    const value = this.entityValue(entityId);
    if (value === null) return null;
    const unit = this._hass?.states?.[entityId]?.attributes?.unit_of_measurement;
    return unit === "kW" ? value * 1000 : value;
  }

  energyValue(entityId) {
    const value = this.entityValue(entityId);
    if (value === null) return null;
    const unit = this._hass?.states?.[entityId]?.attributes?.unit_of_measurement;
    return unit === "Wh" ? value / 1000 : value;
  }

  sumEntities(entityIds) {
    const values = entityIds.map((id) => this.powerValue(id));
    return values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  formatPower(value) {
    if (value === null) return "–";
    const absolute = Math.abs(value);
    if (absolute >= 1000) return `${this.localNumber(absolute / 1000, 2)} kW`;
    return `${this.localNumber(absolute, this.config.power_decimals)} W`;
  }

  formatEnergy(value) {
    return value === null ? "–" : `${this.localNumber(value, this.config.energy_decimals)} kWh`;
  }

  localNumber(value, digits) {
    return new Intl.NumberFormat(this._hass?.locale?.language || "de-DE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  escape(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  setText(name, value) {
    const element = this._root?.querySelector(`[data-value="${name}"]`);
    if (element) element.textContent = value;
  }

  setFlow(name, active, reverse = false) {
    const element = this._root?.querySelector(`[data-flow="${name}"]`);
    if (!element) return;
    element.classList.toggle("active", Boolean(active));
    element.classList.toggle("reverse", Boolean(reverse));
  }

  updateValues() {
    const entities = this.config.entities;
    const directPv = this.sumEntities(entities.pv_inputs);
    const batteryPv = this.sumEntities(entities.battery_pv_inputs);
    const batteryOut = this.powerValue(entities.battery_to_inverter);
    const inverter = this.powerValue(entities.inverter_output);
    const rawGrid = this.powerValue(entities.grid_power);
    const grid = rawGrid === null ? null : rawGrid * (this.config.grid_positive_is_import ? 1 : -1);
    const gridImport = grid === null ? null : Math.max(0, grid);
    const gridExport = grid === null ? null : Math.max(0, -grid);
    const measuredHouse = entities.house_power ? this.powerValue(entities.house_power) : null;
    const house = measuredHouse ?? (inverter === null || grid === null ? null : Math.max(0, inverter + grid));
    const autarky = house === null ? null : house <= 1 ? (gridImport > 1 ? 0 : 100) : Math.max(0, Math.min(100, 100 * (1 - gridImport / house)));
    const soc = this.entityValue(entities.battery_soc);

    this.setText("direct-pv", this.formatPower(directPv));
    entities.pv_inputs.forEach((id, index) => this.setText(`pv-${index + 1}`, this.formatPower(this.powerValue(id))));
    this.setText("battery-pv", this.formatPower(batteryPv));
    entities.battery_pv_inputs.forEach((id, index) => this.setText(`battery-pv-${index + 1}`, this.formatPower(this.powerValue(id))));
    this.setText("battery-out", this.formatPower(batteryOut));
    this.setText("inverter", this.formatPower(inverter));
    this.setText("house", this.formatPower(house));
    this.setText("grid-import", this.formatPower(gridImport));
    this.setText("grid-export", this.formatPower(gridExport));
    this.setText("flow-pv-inverter", this.formatPower(directPv));
    this.setText("flow-pv-battery", this.formatPower(batteryPv));
    this.setText("flow-battery-inverter", this.formatPower(batteryOut));
    this.setText("flow-inverter-house", this.formatPower(inverter));
    this.setText("flow-house-grid", this.formatPower(grid === null ? null : Math.abs(grid)));
    this.setText("autarky", autarky === null ? "–" : `${this.localNumber(autarky, 0)} %`);
    this.setText("soc", soc === null ? "–" : `${this.localNumber(Math.max(0, Math.min(100, soc)), 0)} %`);
    const fill = this._root?.querySelector(".battery-fill");
    if (fill) fill.style.width = `${soc === null ? 0 : Math.max(0, Math.min(100, soc))}%`;

    [
      ["solar", "solar_energy_today"], ["import-day", "grid_import_energy_today"],
      ["export-day", "grid_export_energy_today"], ["house-day", "house_energy_today"]
    ].forEach(([target, key]) => this.setText(target, this.formatEnergy(entities[key] ? this.energyValue(entities[key]) : null)));

    if (!entities.house_energy_today) {
      const produced = entities.solar_energy_today ? this.energyValue(entities.solar_energy_today) : null;
      const imported = entities.grid_import_energy_today ? this.energyValue(entities.grid_import_energy_today) : null;
      const exported = entities.grid_export_energy_today ? this.energyValue(entities.grid_export_energy_today) : null;
      const derivedHouseEnergy = [produced, imported, exported].every((value) => value !== null)
        ? Math.max(0, produced + imported - exported)
        : null;
      this.setText("house-day", this.formatEnergy(derivedHouseEnergy));
    }

    this.setFlow("pv-inverter", directPv > 1);
    this.setFlow("pv-battery", batteryPv > 1);
    this.setFlow("battery-inverter", batteryOut > 1, true);
    this.setFlow("inverter-house", inverter > 1);
    this.setFlow("house-grid", grid !== null && Math.abs(grid) > 1, gridImport > 1);
  }

  render() {
    if (!this.config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { --solar: #f5b82e; --battery: #55c58b; --grid: #6ca9ff; --muted: rgba(127,127,127,.28); display:block; }
        ha-card { overflow:hidden; padding:20px; background:linear-gradient(145deg, var(--ha-card-background, var(--card-background-color)), color-mix(in srgb, var(--primary-color) 5%, var(--ha-card-background, var(--card-background-color)))); }
        .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        h2 { margin:0; font-size:20px; font-weight:650; letter-spacing:-.02em; }
        .live { display:flex; gap:6px; align-items:center; color:var(--secondary-text-color); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
        .live-dot { width:7px; height:7px; border-radius:50%; background:#45c784; box-shadow:0 0 0 4px rgba(69,199,132,.13); }
        .flow-grid { display:grid; grid-template-columns:minmax(132px,1fr) 56px minmax(132px,1fr) 56px minmax(132px,1fr); grid-template-rows:auto 58px auto 58px auto; align-items:center; }
        .node { min-height:92px; border:1px solid var(--divider-color); border-radius:16px; padding:14px; background:color-mix(in srgb, var(--card-background-color) 90%, transparent); box-sizing:border-box; position:relative; box-shadow:0 4px 20px rgba(0,0,0,.04); }
        .node-title { display:flex; gap:8px; align-items:center; font-size:13px; color:var(--secondary-text-color); }
        ha-icon { --mdc-icon-size:20px; color:var(--node-color, var(--primary-color)); }
        .big { font-size:23px; font-weight:700; margin-top:9px; letter-spacing:-.03em; }
        .sub { margin-top:7px; color:var(--secondary-text-color); font-size:11px; display:flex; gap:8px; flex-wrap:wrap; }
        .pv { --node-color:var(--solar); grid-column:1; grid-row:1; }
        .inverter { --node-color:#b388ff; grid-column:3; grid-row:1; }
        .house { --node-color:#ff7d6e; grid-column:5; grid-row:1; }
        .battery-pv { --node-color:var(--solar); grid-column:1; grid-row:3; }
        .battery { --node-color:var(--battery); grid-column:3; grid-row:3; }
        .grid-node { --node-color:var(--grid); grid-column:5; grid-row:3; }
        .stat { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-top:7px; font-size:12px; color:var(--secondary-text-color); }
        .stat b { color:var(--primary-text-color); font-size:14px; }
        .battery-shell { height:6px; border-radius:8px; background:var(--muted); margin-top:10px; overflow:hidden; }
        .battery-fill { height:100%; width:0; background:var(--battery); border-radius:inherit; transition:width .6s ease; }
        .flow { color:var(--muted); position:relative; display:flex; align-items:center; justify-content:center; }
        .flow.horizontal { height:3px; background:currentColor; margin:0 8px; }
        .flow.vertical { width:3px; height:42px; background:currentColor; justify-self:center; }
        .flow::after { content:""; z-index:4; width:9px; height:9px; border-top:3px solid currentColor; border-right:3px solid currentColor; position:absolute; filter:drop-shadow(0 0 2px currentColor); transform:rotate(45deg); }
        .flow.horizontal::after { right:-5px; }
        .flow.vertical::after { bottom:-5px; transform:rotate(135deg); }
        .flow.reverse.horizontal::after { left:-5px; right:auto; transform:rotate(225deg); }
        .flow.reverse.vertical::after { top:-5px; bottom:auto; transform:rotate(-45deg); }
        .flow.active { color:var(--flow-color, var(--primary-color)); }
        .flow.active::before { content:""; position:absolute; width:8px; height:8px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; animation:move-x 1.8s linear infinite; }
        .flow.active.vertical::before { animation-name:move-y; }
        .flow.active.reverse::before { animation-direction:reverse; }
        .flow-value { position:absolute; z-index:2; left:50%; top:50%; transform:translate(-50%,-50%); padding:3px 6px; border:1px solid color-mix(in srgb, currentColor 45%, var(--divider-color)); border-radius:999px; background:var(--ha-card-background, var(--card-background-color)); color:var(--primary-text-color); box-shadow:0 2px 8px rgba(0,0,0,.12); font-size:10px; font-weight:700; line-height:1.15; white-space:nowrap; }
        .flow.active .flow-value { color:var(--flow-color, var(--primary-color)); }
        @keyframes move-x { from{transform:translateX(-17px)} to{transform:translateX(17px)} }
        @keyframes move-y { from{transform:translateY(-15px)} to{transform:translateY(15px)} }
        .f-pv-inv { --flow-color:var(--solar); grid-column:2; grid-row:1; }
        .f-inv-house { --flow-color:#b388ff; grid-column:4; grid-row:1; }
        .f-pv-bat { --flow-color:var(--solar); grid-column:2; grid-row:3; }
        .f-bat-inv { --flow-color:var(--battery); grid-column:3; grid-row:2; }
        .f-house-grid { --flow-color:var(--grid); grid-column:5; grid-row:2; }
        .daily { grid-column:1 / -1; grid-row:5; display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:2px; }
        .daily-item { padding:13px; border-radius:13px; background:color-mix(in srgb, var(--secondary-background-color) 70%, transparent); min-width:0; }
        .daily-label { color:var(--secondary-text-color); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .daily-value { font-size:16px; font-weight:650; margin-top:6px; }
        @media(max-width:600px) {
          ha-card { padding:14px; } .flow-grid { grid-template-columns:minmax(92px,1fr) 30px minmax(92px,1fr) 30px minmax(92px,1fr); }
          .node { min-height:88px; padding:10px; } .big { font-size:17px; } .sub { gap:4px; font-size:9px; }
          .node-title { font-size:11px; gap:4px; } ha-icon { --mdc-icon-size:17px; }
          .daily { grid-template-columns:repeat(2,1fr); } .daily-value { font-size:14px; }
          .flow.horizontal { margin:0 4px; } @keyframes move-x { from{transform:translateX(-8px)} to{transform:translateX(8px)} }
        }
      </style>
      <ha-card>
        <div class="header"><h2>${this.escape(this.config.title)}</h2><div class="live"><span class="live-dot"></span>Live</div></div>
        <div class="flow-grid">
          <div class="node pv"><div class="node-title"><ha-icon icon="mdi:solar-panel-large"></ha-icon>3× PV direkt</div><div class="big" data-value="direct-pv">–</div><div class="sub"><span>E1 <b data-value="pv-1">–</b></span><span>E2 <b data-value="pv-2">–</b></span><span>E3 <b data-value="pv-3">–</b></span></div></div>
          <div class="flow horizontal f-pv-inv" data-flow="pv-inverter"><span class="flow-value" data-value="flow-pv-inverter">–</span></div>
          <div class="node inverter"><div class="node-title"><ha-icon icon="mdi:current-ac"></ha-icon>Wechselrichter</div><div class="big" data-value="inverter">–</div><div class="sub">Ausgang ins Hausnetz</div></div>
          <div class="flow horizontal f-inv-house" data-flow="inverter-house"><span class="flow-value" data-value="flow-inverter-house">–</span></div>
          <div class="node house"><div class="node-title"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon>Haus</div><div class="big" data-value="house">–</div><div class="stat"><span>Autarkie</span><b data-value="autarky">–</b></div></div>
          <div class="node battery-pv"><div class="node-title"><ha-icon icon="mdi:solar-power-variant"></ha-icon>2× PV Batterie</div><div class="big" data-value="battery-pv">–</div><div class="sub"><span>PV 1 <b data-value="battery-pv-1">–</b></span><span>PV 2 <b data-value="battery-pv-2">–</b></span></div></div>
          <div class="flow horizontal f-pv-bat" data-flow="pv-battery"><span class="flow-value" data-value="flow-pv-battery">–</span></div>
          <div class="node battery"><div class="node-title"><ha-icon icon="mdi:battery-charging-medium"></ha-icon>DB Batterie</div><div class="big" data-value="battery-out">–</div><div class="stat"><span>Ladestand</span><b data-value="soc">–</b></div><div class="battery-shell"><div class="battery-fill"></div></div></div>
          <div class="flow vertical f-bat-inv" data-flow="battery-inverter"><span class="flow-value" data-value="flow-battery-inverter">–</span></div>
          <div class="flow vertical f-house-grid" data-flow="house-grid"><span class="flow-value" data-value="flow-house-grid">–</span></div>
          <div class="node grid-node"><div class="node-title"><ha-icon icon="mdi:transmission-tower"></ha-icon>Öffentliches Netz</div><div class="stat"><span>Bezug</span><b data-value="grid-import">–</b></div><div class="stat"><span>Einspeisung</span><b data-value="grid-export">–</b></div></div>
          <div class="daily">
            <div class="daily-item"><div class="daily-label">Solar heute</div><div class="daily-value" data-value="solar">–</div></div>
            <div class="daily-item"><div class="daily-label">Netzbezug heute</div><div class="daily-value" data-value="import-day">–</div></div>
            <div class="daily-item"><div class="daily-label">Einspeisung heute</div><div class="daily-value" data-value="export-day">–</div></div>
            <div class="daily-item"><div class="daily-label">Hausverbrauch heute</div><div class="daily-value" data-value="house-day">–</div></div>
          </div>
        </div>
      </ha-card>`;
    this._root = this.shadowRoot;
    this.updateValues();
  }
}

if (!customElements.get("solar-flow-card")) customElements.define("solar-flow-card", SolarFlowCard);

class SolarFlowCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll("ha-entity-picker").forEach((picker) => { picker.hass = hass; });
  }

  setConfig(config) {
    this._config = {
      title: "Solaranlage",
      grid_positive_is_import: true,
      power_decimals: 0,
      energy_decimals: 2,
      ...config,
      entities: {
        pv_inputs: ["", "", ""],
        battery_pv_inputs: ["", ""],
        ...(config.entities || {})
      }
    };
    this.render();
  }

  fireConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  updatePath(path, value) {
    const next = { ...this._config, entities: { ...this._config.entities } };
    if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.")) {
      const [key, rawIndex] = path.split(".");
      const index = Number(rawIndex);
      next.entities[key] = [...next.entities[key]];
      next.entities[key][index] = value || "";
    } else if (path.startsWith("entities.")) {
      const key = path.slice("entities.".length);
      if (value) next.entities[key] = value;
      else delete next.entities[key];
    } else {
      next[path] = value;
    }
    this._config = next;
    this.fireConfigChanged();
  }

  render() {
    if (!this._config) return;
    const fields = [
      ["Direkte PV-Leistung – Eingang 1", "pv_inputs.0", true],
      ["Direkte PV-Leistung – Eingang 2", "pv_inputs.1", true],
      ["Direkte PV-Leistung – Eingang 3", "pv_inputs.2", true],
      ["Batterie-PV – Modul 1", "battery_pv_inputs.0", true],
      ["Batterie-PV – Modul 2", "battery_pv_inputs.1", true],
      ["Batterie zum Wechselrichter – Eingang 4", "entities.battery_to_inverter", true],
      ["Wechselrichter-Ausgangsleistung", "entities.inverter_output", true],
      ["Saldierte Netzleistung (Shelly)", "entities.grid_power", true],
      ["Batterie-Ladestand", "entities.battery_soc", true],
      ["Hausleistung (optional)", "entities.house_power", false],
      ["Solarenergie heute", "entities.solar_energy_today", false],
      ["Netzbezug heute", "entities.grid_import_energy_today", false],
      ["Einspeisung heute", "entities.grid_export_energy_today", false],
      ["Hausverbrauch heute", "entities.house_energy_today", false]
    ];
    const valueFor = (path) => {
      if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.")) {
        const [key, rawIndex] = path.split(".");
        return this._config.entities[key][Number(rawIndex)] || "";
      }
      return this._config.entities[path.slice("entities.".length)] || "";
    };
    this.innerHTML = `
      <style>
        solar-flow-card-editor { display:block; }
        .editor { display:grid; gap:20px; padding:4px 0 12px; }
        .section { display:grid; gap:12px; }
        .section-title { font-size:14px; font-weight:600; color:var(--primary-text-color); margin-top:4px; }
        .hint { color:var(--secondary-text-color); font-size:12px; line-height:1.4; margin-top:-5px; }
        ha-textfield, ha-entity-picker { display:block; width:100%; }
        .switch-row { display:flex; justify-content:space-between; gap:16px; align-items:center; min-height:44px; }
        .switch-copy { display:grid; gap:3px; }
        .switch-label { font-size:14px; }
        .switch-hint { color:var(--secondary-text-color); font-size:12px; }
        .number-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      </style>
      <div class="editor">
        <div class="section">
          <div class="section-title">Darstellung</div>
          <ha-textfield data-setting="title" label="Titel" value="${this.escape(this._config.title || "")}"></ha-textfield>
          <div class="number-row">
            <ha-textfield data-number="power_decimals" type="number" min="0" max="3" label="Dezimalstellen Leistung" value="${this._config.power_decimals}"></ha-textfield>
            <ha-textfield data-number="energy_decimals" type="number" min="0" max="3" label="Dezimalstellen Energie" value="${this._config.energy_decimals}"></ha-textfield>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Live-Leistungen</div>
          <div class="hint">Pflichtfelder für das animierte Flussdiagramm.</div>
          ${fields.slice(0, 9).map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
        <div class="section">
          <div class="section-title">Haus und Netz</div>
          ${this.picker(fields[9][0], fields[9][1], valueFor(fields[9][1]))}
          <div class="hint">Ohne Hausleistung berechnet die Card: Wechselrichter + saldierte Netzleistung.</div>
          <div class="switch-row">
            <div class="switch-copy"><span class="switch-label">Positive Netzleistung ist Bezug</span><span class="switch-hint">Ausschalten, wenn dein Shelly-Skript positive Werte bei Einspeisung liefert.</span></div>
            <ha-switch data-setting="grid_positive_is_import" ${this._config.grid_positive_is_import ? "checked" : ""}></ha-switch>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Tageswerte</div>
          <div class="hint">Optionale Energiezähler in kWh, die täglich zurückgesetzt werden.</div>
          ${fields.slice(10).map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
      </div>`;

    this.querySelectorAll("ha-entity-picker").forEach((picker) => {
      picker.hass = this._hass;
      picker.includeDomains = ["sensor", "input_number"];
      picker.addEventListener("value-changed", (event) => this.updatePath(picker.dataset.path, event.detail.value));
    });
    this.querySelector("ha-textfield[data-setting='title']")?.addEventListener("change", (event) => this.updatePath("title", event.target.value));
    this.querySelectorAll("ha-textfield[data-number]").forEach((field) => field.addEventListener("change", (event) => {
      const value = Math.max(0, Math.min(3, Number(event.target.value)));
      this.updatePath(field.dataset.number, Number.isFinite(value) ? value : 0);
    }));
    this.querySelector("ha-switch")?.addEventListener("change", (event) => this.updatePath("grid_positive_is_import", event.target.checked));
  }

  picker(label, path, value) {
    return `<ha-entity-picker data-path="${path}" label="${label}" value="${this.escape(value)}" allow-custom-entity></ha-entity-picker>`;
  }

  escape(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
}

if (!customElements.get("solar-flow-card-editor")) customElements.define("solar-flow-card-editor", SolarFlowCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "solar-flow-card",
  name: "Solar Flow Card",
  description: "Live-Energiefluss für PV, Batterie, Wechselrichter, Haus und Netz",
  preview: true
});
