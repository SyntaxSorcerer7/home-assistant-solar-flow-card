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
        pv_energy_today: ["", "", ""],
        battery_pv_energy_today: ["", ""],
        battery_to_inverter: "sensor.inverter_input_4_power",
        inverter_output: "sensor.inverter_output_power",
        grid_power: "sensor.shelly_3em_pro_total_active_power",
        battery_soc: "sensor.battery_state_of_charge",
        battery_energy: "sensor.battery_stored_energy",
        battery_charge_energy_today: "sensor.battery_charge_energy_today",
        battery_discharge_energy_today: "sensor.battery_discharge_energy_today",
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
      battery_capacity_kwh: null,
      ...config,
      entities: {
        ...config.entities,
        pv_energy_today: this.normalizedArray(config.entities.pv_energy_today, 3),
        battery_pv_energy_today: this.normalizedArray(config.entities.battery_pv_energy_today, 2)
      }
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
  getGridOptions() { return { columns: 12, rows: 8, min_columns: 6, min_rows: 6 }; }

  normalizedArray(value, length) {
    return Array.from({ length }, (_, index) => Array.isArray(value) ? (value[index] || "") : "");
  }

  entityValue(entityId) {
    const state = this._hass?.states?.[entityId];
    const raw = state?.state;
    const value = raw == null || String(raw).trim() === "" ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  powerValue(entityId) {
    const value = this.entityValue(entityId);
    if (value === null) return null;
    const unit = String(this._hass?.states?.[entityId]?.attributes?.unit_of_measurement || "").toLowerCase();
    return unit === "kw" ? value * 1000 : value;
  }

  energyValue(entityId) {
    const value = this.entityValue(entityId);
    if (value === null) return null;
    const unit = String(this._hass?.states?.[entityId]?.attributes?.unit_of_measurement || "").toLowerCase();
    return unit === "wh" ? value / 1000 : value;
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
    this._root?.querySelectorAll(`[data-value="${name}"]`).forEach((element) => { element.textContent = value; });
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
    const housePv = house === null || inverter === null ? null : Math.min(house, Math.max(0, inverter));
    const autarky = house === null || gridImport === null ? null : house <= 1 ? (gridImport > 1 ? 0 : 100) : Math.max(0, Math.min(100, 100 * (1 - gridImport / house)));
    const soc = this.entityValue(entities.battery_soc);
    const configuredCapacity = Number(this.config.battery_capacity_kwh);
    const batteryCapacity = Number.isFinite(configuredCapacity) && configuredCapacity > 0 ? configuredCapacity : null;
    const measuredBatteryStored = entities.battery_energy ? this.energyValue(entities.battery_energy) : null;
    const calculatedBatteryStored = soc === null || batteryCapacity === null
      ? null
      : batteryCapacity * Math.max(0, Math.min(100, soc)) / 100;
    const batteryStored = measuredBatteryStored === null ? calculatedBatteryStored : Math.max(0, measuredBatteryStored);

    this.setText("direct-pv", this.formatPower(directPv));
    entities.pv_inputs.forEach((id, index) => this.setText(`pv-${index + 1}`, this.formatPower(this.powerValue(id))));
    entities.pv_energy_today.forEach((id, index) => this.setText(`pv-day-${index + 1}`, this.formatEnergy(id ? this.energyValue(id) : null)));
    this.setText("battery-pv", this.formatPower(batteryPv));
    entities.battery_pv_inputs.forEach((id, index) => this.setText(`battery-pv-${index + 1}`, this.formatPower(this.powerValue(id))));
    entities.battery_pv_energy_today.forEach((id, index) => this.setText(`battery-pv-day-${index + 1}`, this.formatEnergy(id ? this.energyValue(id) : null)));
    this.setText("battery-out", this.formatPower(batteryOut));
    this.setText("inverter", this.formatPower(inverter));
    this.setText("house", this.formatPower(house));
    this.setText("house-pv", this.formatPower(housePv));
    this.setText("house-grid", this.formatPower(gridImport));
    this.setText("grid-import", this.formatPower(gridImport));
    this.setText("grid-export", this.formatPower(gridExport));
    this.setText("autarky", autarky === null ? "–" : `${this.localNumber(autarky, 0)} %`);
    this.setText("soc", soc === null ? "–" : `${this.localNumber(Math.max(0, Math.min(100, soc)), 0)} %`);
    this.setText("battery-stored", this.formatEnergy(batteryStored));
    this.setText("battery-capacity", this.formatEnergy(batteryCapacity));
    this.setText("battery-charged-today", this.formatEnergy(entities.battery_charge_energy_today ? this.energyValue(entities.battery_charge_energy_today) : null));
    this.setText("battery-discharged-today", this.formatEnergy(entities.battery_discharge_energy_today ? this.energyValue(entities.battery_discharge_energy_today) : null));
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

    this.setText("house-day-label", entities.house_energy_today ? "Hausverbrauch heute" : "Hausverbrauch heute (berechnet)");
    const scene = this._root?.querySelector("solar-energy-flow");
    if (scene) {
      scene.locale = this._hass?.locale?.language || "de-DE";
      scene.powerDecimals = this.config.power_decimals;
      scene.data = {
        pvDirect1: this.powerValue(entities.pv_inputs[0]),
        pvDirect2: this.powerValue(entities.pv_inputs[1]),
        pvDirect3: this.powerValue(entities.pv_inputs[2]),
        pvDirectTotal: directPv,
        pvBattery1: this.powerValue(entities.battery_pv_inputs[0]),
        pvBattery2: this.powerValue(entities.battery_pv_inputs[1]),
        pvBatteryTotal: batteryPv,
        inverterPower: inverter,
        batteryPower: batteryOut,
        batterySoc: soc === null ? null : Math.max(0, Math.min(100, soc)),
        housePower: house,
        autarky,
        gridImport,
        gridExport
      };
    }
  }

  render() {
    if (!this.config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --solar-direct:#f5a623; --battery:#55c58b; --inverter:#9b6cff;
          --house:#ff665b; --grid:#3f91ff; --flow-inactive:rgba(110,125,145,.30);
          display:block; color:var(--primary-text-color); container-type:inline-size;
        }
        * { box-sizing:border-box; }
        ha-card { overflow:hidden; background:var(--ha-card-background, var(--card-background-color)); }
        .header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px 4px; }
        h2 { margin:0; font-size:22px; font-weight:700; letter-spacing:-.025em; }
        .live { display:flex; gap:8px; align-items:center; color:var(--secondary-text-color); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
        .live-dot { width:8px; height:8px; border-radius:50%; background:#22b573; box-shadow:0 0 0 4px rgba(34,181,115,.14); }
        .scene-wrap { padding:0 10px; }
        solar-energy-flow { display:block; width:100%; background:#fff; border-radius:14px; margin:10px 0; }
        .summary-strip { display:grid; grid-template-columns:repeat(6,1fr); margin:0 18px 16px; border:1px solid var(--divider-color); border-radius:16px; overflow:hidden; background:color-mix(in srgb, var(--card-background-color) 94%, var(--primary-color)); }
        .summary { min-width:0; padding:11px 13px; border-right:1px solid var(--divider-color); }
        .summary:last-child { border-right:0; }
        .summary-title { color:var(--secondary-text-color); font-size:11px; white-space:nowrap; }
        .summary-title ha-icon { --mdc-icon-size:17px; vertical-align:-4px; margin-right:4px; color:var(--accent); }
        .summary-main { font-size:18px; font-weight:750; margin:4px 0; white-space:nowrap; }
        .summary-sub { color:var(--secondary-text-color); font-size:10px; line-height:1.45; }
        .summary-sub b { color:var(--primary-text-color); }
        details { border-top:1px solid var(--divider-color); }
        summary { cursor:pointer; list-style:none; padding:13px 20px; display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:650; }
        summary::-webkit-details-marker { display:none; }
        summary::after { content:'›'; font-size:22px; transform:rotate(90deg); transition:transform .2s; color:var(--secondary-text-color); }
        details[open] summary::after { transform:rotate(270deg); }
        .details-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; padding:0 18px 18px; }
        .detail-card { border:1px solid var(--divider-color); border-radius:12px; padding:10px 12px; }
        .detail-heading { font-size:11px; font-weight:700; margin-bottom:7px; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; }
        .detail-row { display:flex; justify-content:space-between; gap:10px; font-size:11px; padding:3px 0; color:var(--secondary-text-color); }
        .detail-row b { color:var(--primary-text-color); white-space:nowrap; }
        @container(max-width:800px) {
          .header { padding:14px 14px 2px; } h2{font-size:19px}
          .scene-wrap { padding:0 8px; }
          .summary-strip { grid-template-columns:repeat(3,1fr); margin:0 10px 10px; }
          .summary:nth-child(3) { border-right:0; } .summary:nth-child(-n+3) { border-bottom:1px solid var(--divider-color); }
          .details-grid { grid-template-columns:repeat(2,minmax(0,1fr)); padding:0 10px 12px; }
        }
        @container(max-width:480px) { .summary-main{font-size:15px}.summary{padding:9px}.summary-sub{font-size:9px}.details-grid{grid-template-columns:1fr} }
      </style>
      <ha-card>
        <div class="header"><h2>${this.escape(this.config.title)}</h2><div class="live"><span class="live-dot"></span>Live</div></div>
        <div class="scene-wrap">
          <solar-energy-flow></solar-energy-flow>
        </div>

        <div class="summary-strip">
          <div class="summary" style="--accent:var(--solar-direct)"><div class="summary-title"><ha-icon icon="mdi:solar-panel-large"></ha-icon>3× PV direkt</div><div class="summary-main" data-value="direct-pv">–</div><div class="summary-sub">E1 <b data-value="pv-1">–</b> · E2 <b data-value="pv-2">–</b> · E3 <b data-value="pv-3">–</b></div></div>
          <div class="summary" style="--accent:var(--battery)"><div class="summary-title"><ha-icon icon="mdi:solar-power-variant"></ha-icon>2× PV Batterie</div><div class="summary-main" data-value="battery-pv">–</div><div class="summary-sub">PV 1 <b data-value="battery-pv-1">–</b> · PV 2 <b data-value="battery-pv-2">–</b></div></div>
          <div class="summary" style="--accent:var(--inverter)"><div class="summary-title"><ha-icon icon="mdi:current-ac"></ha-icon>Wechselrichter</div><div class="summary-main" data-value="inverter">–</div><div class="summary-sub">Ausgang ins Hausnetz</div></div>
          <div class="summary" style="--accent:var(--battery)"><div class="summary-title"><ha-icon icon="mdi:battery-charging-medium"></ha-icon>DB Batterie</div><div class="summary-main" data-value="battery-out">–</div><div class="summary-sub">Ladestand <b data-value="soc">–</b></div></div>
          <div class="summary" style="--accent:var(--house)"><div class="summary-title"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon>Haus</div><div class="summary-main" data-value="house">–</div><div class="summary-sub">Autarkie <b data-value="autarky">–</b><br>PV <b data-value="house-pv">–</b> · Netz <b data-value="house-grid">–</b></div></div>
          <div class="summary" style="--accent:var(--grid)"><div class="summary-title"><ha-icon icon="mdi:transmission-tower"></ha-icon>Öffentliches Netz</div><div class="summary-main"><span data-value="grid-import">–</span> / <span data-value="grid-export">–</span></div><div class="summary-sub">Bezug / Einspeisung</div></div>
        </div>
        <details>
          <summary>Tageswerte und Details</summary>
          <div class="details-grid">
            <div class="detail-card"><div class="detail-heading">PV direkt heute</div><div class="detail-row"><span>E1 heute</span><b data-value="pv-day-1">–</b></div><div class="detail-row"><span>E2 heute</span><b data-value="pv-day-2">–</b></div><div class="detail-row"><span>E3 heute</span><b data-value="pv-day-3">–</b></div><div class="detail-row"><span>Solar gesamt heute</span><b data-value="solar">–</b></div></div>
            <div class="detail-card"><div class="detail-heading">PV Batterie heute</div><div class="detail-row"><span>PV 1 heute</span><b data-value="battery-pv-day-1">–</b></div><div class="detail-row"><span>PV 2 heute</span><b data-value="battery-pv-day-2">–</b></div><div class="detail-row"><span>Batterieausgang</span><b data-value="battery-out">–</b></div></div>
            <div class="detail-card"><div class="detail-heading">DB Batterie</div><div class="detail-row"><span>Gespeicherte Energie</span><b data-value="battery-stored">–</b></div><div class="detail-row"><span>Gesamtkapazität</span><b data-value="battery-capacity">–</b></div><div class="detail-row"><span>Heute geladen</span><b data-value="battery-charged-today">–</b></div><div class="detail-row"><span>Heute entladen</span><b data-value="battery-discharged-today">–</b></div></div>
            <div class="detail-card"><div class="detail-heading">Haus und Netz heute</div><div class="detail-row"><span data-value="house-day-label">Hausverbrauch heute</span><b data-value="house-day">–</b></div><div class="detail-row"><span>Netzbezug heute</span><b data-value="import-day">–</b></div><div class="detail-row"><span>Netzeinspeisung heute</span><b data-value="export-day">–</b></div></div>
          </div>
        </details>
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
      battery_capacity_kwh: null,
      ...config,
      entities: {
        pv_inputs: ["", "", ""],
        battery_pv_inputs: ["", ""],
        pv_energy_today: ["", "", ""],
        battery_pv_energy_today: ["", ""],
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
    if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.") || path.startsWith("pv_energy_today.") || path.startsWith("battery_pv_energy_today.")) {
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
      ["Aktuell gespeicherte Batterieenergie", "entities.battery_energy", false],
      ["Hausleistung (optional)", "entities.house_power", false],
      ["Solarenergie heute", "entities.solar_energy_today", false],
      ["Netzbezug heute", "entities.grid_import_energy_today", false],
      ["Einspeisung heute", "entities.grid_export_energy_today", false],
      ["Hausverbrauch heute", "entities.house_energy_today", false],
      ["Batterie heute geladen", "entities.battery_charge_energy_today", false],
      ["Batterie heute entladen", "entities.battery_discharge_energy_today", false],
      ["Tagesertrag direkte PV – Eingang 1", "pv_energy_today.0", false],
      ["Tagesertrag direkte PV – Eingang 2", "pv_energy_today.1", false],
      ["Tagesertrag direkte PV – Eingang 3", "pv_energy_today.2", false],
      ["Tagesertrag Batterie-PV – Modul 1", "battery_pv_energy_today.0", false],
      ["Tagesertrag Batterie-PV – Modul 2", "battery_pv_energy_today.1", false]
    ];
    const valueFor = (path) => {
      if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.") || path.startsWith("pv_energy_today.") || path.startsWith("battery_pv_energy_today.")) {
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
          <div class="section-title">Batteriekapazität</div>
          ${this.picker(fields[9][0], fields[9][1], valueFor(fields[9][1]))}
          <ha-textfield data-capacity type="text" inputmode="decimal" label="Gesamtkapazität (kWh)" value="${this._config.battery_capacity_kwh ?? ""}"></ha-textfield>
          <div class="hint">Die Energie-Entity wird direkt angezeigt. Ohne Entity berechnet die Card den aktuellen Inhalt aus Gesamtkapazität und Ladestand.</div>
        </div>
        <div class="section">
          <div class="section-title">Haus und Netz</div>
          ${this.picker(fields[10][0], fields[10][1], valueFor(fields[10][1]))}
          <div class="hint">Ohne Hausleistung berechnet die Card: Wechselrichter + saldierte Netzleistung.</div>
          <div class="switch-row">
            <div class="switch-copy"><span class="switch-label">Positive Netzleistung ist Bezug</span><span class="switch-hint">Ausschalten, wenn dein Shelly-Skript positive Werte bei Einspeisung liefert.</span></div>
            <ha-switch data-setting="grid_positive_is_import" ${this._config.grid_positive_is_import ? "checked" : ""}></ha-switch>
          </div>
        </div>
        <div class="section">
          <div class="section-title">PV-Tageserträge einzeln</div>
          <div class="hint">Optionale Energiezähler für jede der fünf Platten.</div>
          ${fields.slice(17).map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
        <div class="section">
          <div class="section-title">Tageswerte</div>
          <div class="hint">Optionale Energiezähler in kWh, die täglich zurückgesetzt werden.</div>
          ${fields.slice(11, 17).map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
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
    this.querySelector("ha-textfield[data-capacity]")?.addEventListener("change", (event) => {
      const value = Number.parseFloat(String(event.target.value).trim().replace(",", "."));
      this.updatePath("battery_capacity_kwh", Number.isFinite(value) && value > 0 ? value : null);
    });
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
