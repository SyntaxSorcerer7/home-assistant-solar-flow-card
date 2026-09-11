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
        inverter_energy_today: "sensor.inverter_ac_energy_today",
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
    // Shelly measures the net exchange: import adds to the inverter output,
    // export leaves the house. Never substitute missing readings with zero.
    const calculatedHouse = inverter === null || grid === null
      ? null
      : Math.max(0, inverter + gridImport - gridExport);
    const house = measuredHouse ?? calculatedHouse;
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
    const energy = (key) => entities[key] ? this.energyValue(entities[key]) : null;
    const sumEnergy = (ids) => {
      const values = ids.map((id) => id ? this.energyValue(id) : null);
      return values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const directDay = sumEnergy(entities.pv_energy_today);
    // In this installation the two battery PV modules supply the battery charge.
    // Use its daily charge counter only when individual PV counters are not configured.
    const batteryPvDay = entities.battery_pv_energy_today.some(Boolean)
      ? sumEnergy(entities.battery_pv_energy_today) : energy("battery_charge_energy_today");
    const chargedDay = energy("battery_charge_energy_today") ?? batteryPvDay;
    const dischargedDay = energy("battery_discharge_energy_today");
    const inverterInputDay = directDay === null || dischargedDay === null ? null : directDay + dischargedDay;
    const importedDay = energy("grid_import_energy_today");
    const exportedDay = energy("grid_export_energy_today");
    const inverterOutputDay = energy("inverter_energy_today");
    const measuredHouseDay = energy("house_energy_today");
    // AC output already accounts for battery discharge and conversion losses.
    // Raw solar generation is not a valid substitute for this house balance.
    const houseDay = measuredHouseDay ?? ([inverterOutputDay, importedDay, exportedDay].every((value) => value !== null)
      ? Math.max(0, inverterOutputDay + importedDay - exportedDay) : null);
    const selfDay = houseDay === null || importedDay === null ? null : Math.max(0, houseDay - importedDay);
    const dayAutarky = houseDay === null || houseDay <= 0 || selfDay === null
      ? null : Math.max(0, Math.min(100, 100 * selfDay / houseDay));
    Object.entries({
      "direct-pv-day": directDay, "battery-pv-day": batteryPvDay,
      "inverter-input-day": inverterInputDay, "inverter-output-day": inverterOutputDay,
      "battery-charged-today": chargedDay, "battery-discharged-today": dischargedDay,
      "import-day": importedDay, "export-day": exportedDay, "house-day": houseDay,
      "house-self-day": selfDay
    }).forEach(([name, value]) => this.setText(name, this.formatEnergy(value)));
    this.setText("autarky-day", dayAutarky === null ? "–" : `${this.localNumber(dayAutarky, 0)} %`);
    this.setText("house-day-label", measuredHouseDay === null ? "Verbrauch · berechnet" : "Verbrauch");
    const meter = this._root?.querySelector(".autarky-meter");
    if (meter) {
      meter.value = dayAutarky ?? 0;
      meter.hidden = dayAutarky === null;
    }
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
        batteryCapacity: batteryStored,
        batterySoc: soc === null ? null : Math.max(0, Math.min(100, soc)),
        housePower: house,
        autarky,
        gridImport,
        gridExport
      };
    }
  }

  dayRow(label, value) {
    return `<div class="detail-row"><span>${label}</span><b data-value="${value}">–</b></div>`;
  }

  tile(title, icon, accent, value, caption, liveDetail, daily) {
    return `<section class="summary" style="--accent:var(--${accent})" aria-label="${title}">
      <div class="summary-title"><ha-icon icon="${icon}"></ha-icon>${title}</div>
      <div class="summary-main"><span data-value="${value}">–</span><span class="now">${caption}</span></div>
      <div class="summary-sub">${liveDetail}</div>
      <div class="today"><div class="today-heading">Heute</div>${daily}</div>
    </section>`;
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
        .dashboard { display:grid; gap:16px; padding:10px 18px 18px; }
        .scene-wrap { min-width:0; align-self:start; }
        solar-energy-flow { display:block; width:100%; background:#fff; border-radius:16px; overflow:hidden; }
        .summary-strip { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; min-width:0; }
        .summary { min-width:0; padding:9px 10px; border:1px solid var(--divider-color,#dbe2ea); border-radius:10px; background:var(--card-background-color,#fff); border-top:2px solid var(--accent); }
        .summary-title { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:650; }
        .summary-title ha-icon { --mdc-icon-size:16px; color:var(--accent); }
        .summary-main { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; font-size:19px; font-weight:750; margin:4px 0 2px; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
        .now { font-size:10px; font-weight:500; color:var(--secondary-text-color); letter-spacing:0; }
        .summary-sub { color:var(--secondary-text-color); font-size:10px; line-height:1.35; }
        .summary-sub b { color:var(--primary-text-color); font-weight:600; white-space:nowrap; }
        .today { margin-top:6px; padding-top:5px; border-top:1px solid var(--divider-color,#dbe2ea); }
        .today-heading { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--secondary-text-color); margin-bottom:3px; }
        .detail-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:11px; padding:2px 0; color:var(--secondary-text-color); }
        .detail-row b { color:var(--primary-text-color); white-space:nowrap; font-variant-numeric:tabular-nums; }
        .autarky-row { margin-top:5px; font-weight:650; }
        .autarky-row b { font-size:16px; }
        .autarky-meter { display:block; width:100%; height:4px; border:0; border-radius:8px; overflow:hidden; margin-top:4px; accent-color:var(--house); }
        .autarky-meter[hidden] { display:none; }
        .autarky-meter::-webkit-progress-bar { background:var(--divider-color,#dbe2ea); }
        .autarky-meter::-webkit-progress-value { background:var(--house); border-radius:8px; }
        .autarky-meter::-moz-progress-bar { background:var(--house); }
        @container(min-width:1100px) {
          .dashboard { grid-template-columns:minmax(0,1fr) min(38%,440px); gap:12px; height:calc(100dvh - 100px); min-height:0; padding:8px 14px 14px; }
          .scene-wrap { height:100%; min-height:0; align-self:stretch; display:flex; align-items:center; }
          solar-energy-flow { height:100%; }
          solar-energy-flow::part(wrap) { height:100%; }
          solar-energy-flow::part(svg) { height:100%; }
          .summary-strip { grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(3,max-content); gap:7px; min-height:0; overflow:auto; align-content:safe center; scrollbar-width:thin; }
          .summary { max-width:20cqw; }
        }
        @container(max-width:700px) {
          .header { padding:14px 14px 2px; } h2 { font-size:19px; }
          .dashboard { padding:10px; gap:12px; }
          .summary-strip { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
          .summary { padding:9px 10px; }
          .summary-main { font-size:19px; }
        }
        @container(max-width:380px) { .summary-strip { grid-template-columns:minmax(0,1fr); } }
      </style>
      <ha-card>
        <div class="header"><h2>${this.escape(this.config.title)}</h2><div class="live"><span class="live-dot"></span>Live</div></div>
        <div class="dashboard">
          <div class="scene-wrap"><solar-energy-flow></solar-energy-flow></div>
          <div class="summary-strip">
            ${this.tile("Haus", "mdi:home-lightning-bolt", "house", "house", "Verbrauch jetzt",
              'Selbst gedeckt <b data-value="house-pv">–</b> · Netz <b data-value="house-grid">–</b>',
              this.dayRow('<span data-value="house-day-label">Verbrauch</span>', "house-day") + this.dayRow("Netzbezug", "import-day") + this.dayRow("Selbst gedeckt", "house-self-day") +
              '<div class="detail-row autarky-row"><span>Autarkie heute</span><b data-value="autarky-day">–</b></div><progress class="autarky-meter" max="100" value="0" aria-label="Autarkie heute" hidden></progress>')}
            ${this.tile("Öffentliches Netz", "mdi:transmission-tower", "grid", "grid-import", "Bezug jetzt",
              'Einspeisung jetzt <b data-value="grid-export">–</b>', this.dayRow("Bezogen", "import-day") + this.dayRow("Eingespeist", "export-day"))}
            ${this.tile("3× PV direkt", "mdi:solar-panel-large", "solar-direct", "direct-pv", "Erzeugung jetzt",
              'E1 <b data-value="pv-1">–</b> · E2 <b data-value="pv-2">–</b> · E3 <b data-value="pv-3">–</b>',
              this.dayRow("Erzeugung gesamt", "direct-pv-day") + [1,2,3].map(i => this.dayRow(`Eingang ${i}`, `pv-day-${i}`)).join(""))}
            ${this.tile("2× PV Batterie", "mdi:solar-power-variant", "battery", "battery-pv", "Erzeugung jetzt",
              'PV 1 <b data-value="battery-pv-1">–</b> · PV 2 <b data-value="battery-pv-2">–</b>',
              this.dayRow("Erzeugung gesamt", "battery-pv-day") + [1,2].map(i => this.dayRow(`Modul ${i}`, `battery-pv-day-${i}`)).join(""))}
            ${this.tile("DB Batterie", "mdi:battery-charging-medium", "battery", "battery-out", "Ausgang jetzt",
              'Ladestand <b data-value="soc">–</b> · <b data-value="battery-stored">–</b> / <b data-value="battery-capacity">–</b>',
              this.dayRow("Geladen", "battery-charged-today") + this.dayRow("Entladen", "battery-discharged-today"))}
            ${this.tile("Wechselrichter", "mdi:current-ac", "inverter", "inverter", "AC-Ausgang jetzt",
              '3 PV-Eingänge + Batterie', this.dayRow("Eingänge gesamt", "inverter-input-day") + this.dayRow("AC-Erzeugung", "inverter-output-day"))}
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
      ["Wechselrichter AC-Erzeugung heute (für Hausbilanz)", "entities.inverter_energy_today", false],
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
