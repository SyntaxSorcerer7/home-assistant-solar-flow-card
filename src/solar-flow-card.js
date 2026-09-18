// Defaults preserve existing installations. Inactive entity slots stay in the
// editor configuration, but never contribute to readings or totals.
const SOLAR_LAYOUT = Object.freeze({
  pv_direct_inputs: { default: 3, min: 1, max: 4, label: "Direkte PV-Eingänge" },
  battery_count: { default: 1, min: 0, max: 2, label: "Anzahl Batterien" },
  pv_battery_inputs: { default: 2, min: 1, max: 2, label: "PV-Platten an Batterie 1" },
  pv_battery_2_inputs: { default: 2, min: 1, max: 2, label: "PV-Platten an Batterie 2" }
});
function solarLayout(config) {
  return Object.fromEntries(Object.entries(SOLAR_LAYOUT).map(([key, spec]) => {
    const value = config[key] === undefined ? spec.default : config[key];
    if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
      throw new Error(`'${key}' muss eine ganze Zahl von ${spec.min} bis ${spec.max} sein.`);
    }
    return [key, value];
  }));
}

class SolarFlowCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement("solar-flow-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Solaranlage",
      ...solarLayout({}),
      entities: {
        pv_inputs: ["sensor.example_inverter_input_1_power", "sensor.example_inverter_input_2_power", "sensor.example_inverter_input_3_power"],
        battery_pv_inputs: ["sensor.example_battery_solar_input_1_power", "sensor.example_battery_solar_input_2_power"],
        pv_energy_today: ["", "", ""],
        battery_pv_energy_today: ["", ""],
        battery_to_inverter: "sensor.example_inverter_input_4_power",
        inverter_output: "sensor.example_inverter_output_power",
        grid_power: "sensor.example_grid_power",
        battery_soc: "sensor.example_battery_state_of_charge",
        battery_energy: "sensor.example_battery_stored_energy",
        battery_charge_energy_today: "sensor.example_battery_charge_energy_today",
        battery_discharge_energy_today: "sensor.example_battery_discharge_energy_today",
        inverter_energy_today: "sensor.example_inverter_ac_energy_today",
        grid_import_energy_today: "sensor.example_grid_import_energy_today",
        grid_export_energy_today: "sensor.example_grid_export_energy_today",
        house_energy_today: "sensor.example_house_energy_today"
      }
    };
  }

  setConfig(config) {
    if (!config?.entities) throw new Error("'entities' fehlt in der Card-Konfiguration.");
    const layout = solarLayout(config);
    const required = ["inverter_output", "grid_power"];
    if (layout.battery_count) required.push("battery_to_inverter", "battery_soc");
    if (layout.battery_count === 2) required.push("battery_2_to_inverter", "battery_2_soc");
    const missing = required.filter((key) => !config.entities[key]);
    if (missing.length) throw new Error(`Fehlende Entitäten: ${missing.join(", ")}`);
    const counts = { pv_inputs: layout.pv_direct_inputs,
      battery_pv_inputs: layout.battery_count ? layout.pv_battery_inputs : 0,
      battery_2_pv_inputs: layout.battery_count === 2 ? layout.pv_battery_2_inputs : 0 };
    for (const [key, count] of Object.entries(counts)) {
      if (count && (!Array.isArray(config.entities[key]) || config.entities[key].length < count)) {
        throw new Error(`'entities.${key}' muss mindestens ${count} Sensorplätze enthalten.`);
      }
    }
    this.config = {
      title: "Solaranlage",
      grid_positive_is_import: true,
      power_decimals: 0,
      energy_decimals: 2,
      grid_import_price_per_kwh: null,
      battery_capacity_kwh: null,
      battery_2_capacity_kwh: null,
      ...config,
      ...layout,
      entities: {
        ...config.entities,
        pv_inputs: this.normalizedArray(config.entities.pv_inputs, counts.pv_inputs),
        battery_pv_inputs: this.normalizedArray(config.entities.battery_pv_inputs, counts.battery_pv_inputs),
        pv_energy_today: this.normalizedArray(config.entities.pv_energy_today, counts.pv_inputs),
        battery_pv_energy_today: this.normalizedArray(config.entities.battery_pv_energy_today, counts.battery_pv_inputs),
        battery_2_pv_inputs: this.normalizedArray(config.entities.battery_2_pv_inputs, counts.battery_2_pv_inputs),
        battery_2_pv_energy_today: this.normalizedArray(config.entities.battery_2_pv_energy_today, counts.battery_2_pv_inputs)
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

  formatCurrency(value) {
    return value === null ? "–" : new Intl.NumberFormat(this._hass?.locale?.language || "de-DE", {
      style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);
  }

  importPricePerKwh() {
    const entityId = this.config.entities.grid_import_price_per_kwh;
    if (entityId) {
      const value = this.entityValue(entityId);
      if (value === null) return null;
      const unit = String(this._hass?.states?.[entityId]?.attributes?.unit_of_measurement || "").toLowerCase();
      return /^(ct|cent|c)\s*\/\s*kwh$/.test(unit) ? value / 100 : value;
    }
    const raw = this.config.grid_import_price_per_kwh;
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  hasImportPrice() {
    const raw = this.config.grid_import_price_per_kwh;
    return Boolean(this.config.entities.grid_import_price_per_kwh) ||
      (raw !== null && raw !== undefined && String(raw).trim() !== "" && Number.isFinite(Number(raw)));
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
    const hasBattery = this.config.battery_count > 0;
    const directPv = this.sumEntities(entities.pv_inputs);
    const batteryPv = this.sumEntities(entities.battery_pv_inputs);
    const batteryOut = hasBattery ? this.powerValue(entities.battery_to_inverter) : null;
    const inverter = this.powerValue(entities.inverter_output);
    const rawGrid = this.powerValue(entities.grid_power);
    const grid = rawGrid === null ? null : rawGrid * (this.config.grid_positive_is_import ? 1 : -1);
    const gridImport = grid === null ? null : Math.max(0, grid);
    const gridExport = grid === null ? null : Math.max(0, -grid);
    const measuredHouse = entities.house_power ? this.powerValue(entities.house_power) : null;
    // Netzzähler measures the net exchange: import adds to the inverter output,
    // export leaves the house. Never substitute missing readings with zero.
    const calculatedHouse = inverter === null || grid === null
      ? null
      : Math.max(0, inverter + gridImport - gridExport);
    const house = measuredHouse ?? calculatedHouse;
    const housePv = house === null || inverter === null ? null : Math.min(house, Math.max(0, inverter));
    const autarky = house === null || gridImport === null ? null : house <= 1 ? (gridImport > 1 ? 0 : 100) : Math.max(0, Math.min(100, 100 * (1 - gridImport / house)));
    const batteries = Array.from({ length: this.config.battery_count }, (_, index) => this.updateBattery(index));
    const { soc = null, stored: batteryStored = null } = batteries[0] || {};
    const batteryPvTotal = this.sumValues(batteries.map(battery => battery.pv));
    const batteryOutputTotal = this.sumValues(batteries.map(battery => battery.power));

    this.setText("direct-pv", this.formatPower(directPv));
    this.setText("battery-pv-total", this.formatPower(batteryPvTotal));
    this.setText("battery-out-total", this.formatPower(batteryOutputTotal));
    entities.pv_inputs.forEach((id, index) => this.setText(`pv-${index + 1}`, this.formatPower(this.powerValue(id))));
    entities.pv_energy_today.forEach((id, index) => this.setText(`pv-day-${index + 1}`, this.formatEnergy(id ? this.energyValue(id) : null)));
    this.setText("inverter", this.formatPower(inverter));
    this.setText("house", this.formatPower(house));
    this.setText("house-pv", this.formatPower(housePv));
    this.setText("house-grid", this.formatPower(gridImport));
    this.setText("grid-import", this.formatPower(gridImport));
    this.setText("grid-export", this.formatPower(gridExport));
    this.setText("autarky", autarky === null ? "–" : `${this.localNumber(autarky, 0)} %`);
    const energy = (key) => entities[key] ? this.energyValue(entities[key]) : null;
    const sumEnergy = (ids) => {
      const values = ids.map((id) => id ? this.energyValue(id) : null);
      return values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const directDay = sumEnergy(entities.pv_energy_today);
    const dischargeValues = batteries.map(battery => battery.dischargedDay);
    const inverterInputDay = directDay === null || dischargeValues.some(value => value === null)
      ? null : directDay + dischargeValues.reduce((sum, value) => sum + value, 0);
    const importedDay = energy("grid_import_energy_today");
    const exportedDay = energy("grid_export_energy_today");
    const importCostDay = importedDay === null ? null : (() => {
      const price = this.importPricePerKwh();
      return price === null ? null : importedDay * price;
    })();
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
      "direct-pv-day": directDay,
      "inverter-input-day": inverterInputDay, "inverter-output-day": inverterOutputDay,
      "import-day": importedDay, "export-day": exportedDay, "house-day": houseDay,
      "house-self-day": selfDay
    }).forEach(([name, value]) => this.setText(name, this.formatEnergy(value)));
    this.setText("import-cost-day", this.formatCurrency(importCostDay));
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
        pvDirectInputs: this.config.pv_direct_inputs,
        batteryCount: this.config.battery_count,
        pvBatteryInputs: this.config.pv_battery_inputs,
        pvDirect1: this.powerValue(entities.pv_inputs[0]),
        pvDirect2: this.powerValue(entities.pv_inputs[1]),
        pvDirect3: this.powerValue(entities.pv_inputs[2]),
        pvDirect4: this.powerValue(entities.pv_inputs[3]),
        pvDirectTotal: directPv,
        pvBattery1: this.powerValue(entities.battery_pv_inputs[0]),
        pvBattery2: this.powerValue(entities.battery_pv_inputs[1]),
        pvBatteryTotal: batteryPv,
        inverterPower: inverter,
        batteryPower: batteryOut,
        batteryCapacity: batteryStored,
        batterySoc: soc,
        pvBattery2Input1: this.powerValue(entities.battery_2_pv_inputs[0]),
        pvBattery2Input2: this.powerValue(entities.battery_2_pv_inputs[1]),
        pvBattery2Inputs: this.config.pv_battery_2_inputs,
        pvBattery2Total: batteries[1]?.pv ?? null,
        battery2Power: batteries[1]?.power ?? null,
        battery2Soc: batteries[1]?.soc ?? null,
        battery2Capacity: batteries[1]?.stored ?? null,
        housePower: house,
        autarky,
        gridImport,
        gridExport
      };
    }
  }

  sumValues(values) {
    return values.length && values.every(value => value !== null)
      ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  updateBattery(index) {
    const key = index === 0 ? "battery" : "battery_2";
    const name = index === 0 ? "battery" : "battery-2";
    const entities = this.config.entities;
    const inputs = entities[`${key}_pv_inputs`];
    const dailyInputs = entities[`${key}_pv_energy_today`];
    const energy = suffix => this.energyValue(entities[`${key}_${suffix}`]);
    const rawSoc = this.entityValue(entities[`${key}_soc`]);
    const soc = rawSoc === null ? null : Math.max(0, Math.min(100, rawSoc));
    const configuredCapacity = Number(this.config[`${key}_capacity_kwh`]);
    const capacity = Number.isFinite(configuredCapacity) && configuredCapacity > 0 ? configuredCapacity : null;
    const measured = energy("energy");
    const stored = measured === null ? (soc === null || capacity === null ? null : capacity * soc / 100) : Math.max(0, measured);
    const pv = this.sumEntities(inputs);
    const power = this.powerValue(entities[`${key}_to_inverter`]);
    const dailyValues = dailyInputs.map(id => this.energyValue(id));
    // Charge is a fallback only when no individual PV counters are configured.
    const pvDay = dailyInputs.some(Boolean)
      ? (dailyValues.some(value => value === null) ? null : dailyValues.reduce((sum, value) => sum + value, 0))
      : energy("charge_energy_today");
    const chargedDay = energy("charge_energy_today") ?? pvDay;
    const dischargedDay = energy("discharge_energy_today");
    this.setText(`${name}-pv`, this.formatPower(pv));
    this.setText(`${name}-out`, this.formatPower(power));
    this.setText(index === 0 ? "soc" : `${name}-soc`, soc === null ? "–" : `${this.localNumber(soc, 0)} %`);
    inputs.forEach((id, i) => this.setText(`${name}-pv-${i + 1}`, this.formatPower(this.powerValue(id))));
    dailyValues.forEach((value, i) => this.setText(`${name}-pv-day-${i + 1}`, this.formatEnergy(value)));
    Object.entries({stored, capacity, "pv-day": pvDay, "charged-today": chargedDay, "discharged-today": dischargedDay})
      .forEach(([suffix, value]) => this.setText(`${name}-${suffix}`, this.formatEnergy(value)));
    return {pv, pvDay, power, soc, stored, dischargedDay};
  }

  batteryPvTile() {
    const groups = Array.from({ length: this.config.battery_count }, (_, index) => {
      const inputCount = index === 0 ? this.config.pv_battery_inputs : this.config.pv_battery_2_inputs;
      const name = index === 0 ? "battery" : "battery-2";
      const inputs = Array.from({ length: inputCount }, (_, i) =>
        `<div class="device-metric"><span>PV ${i + 1}</span><b data-value="${name}-pv-${i + 1}">–</b></div>`).join("");
      return `<div class="device-group">
        <div class="device-heading">Batterie ${index + 1}<b data-value="${name}-pv">–</b></div>
        <div class="device-metrics">${inputs}</div>
        ${this.dayRow("Ertrag heute", `${name}-pv-day`)}
      </div>`;
    }).join("");
    return `<section class="summary" style="--accent:var(--battery)" aria-label="PV Batterie">
      <div class="summary-title"><ha-icon icon="mdi:solar-power-variant"></ha-icon>PV am Speicher</div>
      <div class="summary-main"><span data-value="battery-pv-total">–</span><span class="now">Erzeugung jetzt</span></div>
      <div class="device-list">${groups}</div>
    </section>`;
  }

  batteryStatusTile() {
    const groups = Array.from({ length: this.config.battery_count }, (_, index) => {
      const name = index === 0 ? "battery" : "battery-2";
      const key = index === 0 ? "battery" : "battery_2";
      const soc = index === 0 ? "soc" : `${name}-soc`;
      const capacity = Number(this.config[`${key}_capacity_kwh`]) > 0
        ? ` <span>von <span data-value="${name}-capacity">–</span></span>` : "";
      return `<div class="device-group">
        <div class="device-heading">Batterie ${index + 1}<b data-value="${soc}">–</b></div>
        <div class="stored-energy"><b data-value="${name}-stored">–</b>${capacity} gespeichert</div>
        ${this.dayRow("Ausgang jetzt", `${name}-out`)}
        ${this.dayRow("Geladen heute", `${name}-charged-today`)}
        ${this.dayRow("Entladen heute", `${name}-discharged-today`)}
      </div>`;
    }).join("");
    const title = this.config.battery_count === 1 ? "Batterie" : "Batterien";
    return `<section class="summary" style="--accent:var(--battery)" aria-label="${title}">
      <div class="summary-title"><ha-icon icon="mdi:battery-charging-medium"></ha-icon>${title}</div>
      <div class="summary-main"><span data-value="battery-out-total">–</span><span class="now">Ausgang gesamt</span></div>
      <div class="device-list">${groups}</div>
    </section>`;
  }

  dayRow(label, value) {
    return `<div class="detail-row"><span>${label}</span><b data-value="${value}">–</b></div>`;
  }

  gridTile() {
    const daily = this.dayRow("Bezogen", "import-day") + this.dayRow("Eingespeist", "export-day") +
      (this.hasImportPrice() ? this.dayRow("Kosten Netzbezug", "import-cost-day") : "");
    return this.tile("Öffentliches Netz", "mdi:transmission-tower", "grid", "grid-import", "Bezug jetzt",
      'Einspeisung jetzt <b data-value="grid-export">–</b>', daily);
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
    const directInputs = Array.from({ length: this.config.pv_direct_inputs }, (_, i) => i + 1);
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
        .summary-strip { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; min-width:0; }
        .storage-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:inherit; grid-column:1 / -1; min-width:0; container-type:inline-size; }
        .storage-pair .summary { display:flex; flex-direction:column; }
        .storage-pair .device-list { flex:1; grid-auto-rows:1fr; }
        .summary { min-width:0; padding:9px 10px; border:1px solid var(--divider-color,#dbe2ea); border-radius:10px; background:var(--card-background-color,#fff); border-top:2px solid var(--accent); }
        .summary-title { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:650; }
        .summary-title ha-icon { --mdc-icon-size:16px; color:var(--accent); }
        .summary-live { color:var(--secondary-text-color); font-size:10px; font-weight:500; line-height:1.35; }
        .summary-live b { color:var(--primary-text-color); font-weight:600; white-space:nowrap; }
        .summary-main { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; font-size:19px; font-weight:750; margin:4px 0 2px; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
        .now { font-size:10px; font-weight:500; color:var(--secondary-text-color); letter-spacing:0; }
        .summary-sub { color:var(--secondary-text-color); font-size:10px; line-height:1.35; }
        .summary-sub b { color:var(--primary-text-color); font-weight:600; white-space:nowrap; }
        .today { margin-top:6px; padding-top:5px; border-top:1px solid var(--divider-color,#dbe2ea); }
        .today-heading { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--secondary-text-color); margin-bottom:3px; }
        .detail-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:11px; padding:2px 0; color:var(--secondary-text-color); }
        .detail-row b { color:var(--primary-text-color); white-space:nowrap; font-variant-numeric:tabular-nums; }
        .device-list { display:grid; gap:5px; margin-top:5px; }
        .device-group { min-width:0; padding-top:5px; border-top:1px solid var(--divider-color,#dbe2ea); font-variant-numeric:tabular-nums; }
        .device-heading { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:11px; font-weight:650; }
        .device-heading b { white-space:nowrap; font-size:13px; }
        .device-metrics { display:flex; flex-wrap:wrap; gap:2px 10px; margin:3px 0; }
        .device-metric { min-width:0; display:flex; flex-wrap:wrap; gap:4px; font-size:10px; color:var(--secondary-text-color); }
        .device-metric b { color:var(--primary-text-color); white-space:nowrap; }
        .stored-energy { font-size:10px; color:var(--secondary-text-color); line-height:1.35; margin:2px 0; }
        .stored-energy b { color:var(--primary-text-color); }
        .device-group .detail-row { font-size:10px; padding:1px 0; flex-wrap:wrap; gap:1px 6px; }
        .device-group .detail-row b { margin-left:auto; }
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
        }
        @container(max-width:700px) {
          .header { padding:14px 14px 2px; } h2 { font-size:19px; }
          .dashboard { padding:10px; gap:12px; }
          .summary-strip { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
          .summary { padding:9px 10px; }
          .summary-main { font-size:19px; }
        }
        @container(max-width:380px) { .summary-strip { grid-template-columns:minmax(0,1fr); } }
        @container(max-width:340px) {
          .storage-pair .summary { padding:7px; }
          .storage-pair .summary-title { flex-wrap:wrap; font-size:11px; }
          .storage-pair .summary-main { gap:2px; }
          .device-heading { gap:4px; flex-wrap:wrap; }
        }
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
            ${this.gridTile()}
            ${this.tile(`${directInputs.length}× PV direkt`, "mdi:solar-panel-large", "solar-direct", "direct-pv", "Erzeugung jetzt",
              directInputs.map(i => `E${i} <b data-value="pv-${i}">–</b>`).join(" · "),
              this.dayRow("Erzeugung gesamt", "direct-pv-day") + directInputs.map(i => this.dayRow(`Eingang ${i}`, `pv-day-${i}`)).join(""))}
            ${this.tile("Wechselrichter", "mdi:current-ac", "inverter", "inverter", "AC-Ausgang jetzt",
              `${directInputs.length} ${directInputs.length === 1 ? "PV-Eingang" : "PV-Eingänge"}${this.config.battery_count ? ` + ${this.config.battery_count} ${this.config.battery_count === 1 ? "Batterie" : "Batterien"}` : ""}`, this.dayRow("Eingänge gesamt", "inverter-input-day") + this.dayRow("AC-Erzeugung", "inverter-output-day"))}
            ${this.config.battery_count ? `<div class="storage-pair">${this.batteryPvTile()}${this.batteryStatusTile()}</div>` : ""}
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
    const layout = solarLayout(config);
    this._config = {
      title: "Solaranlage",
      grid_positive_is_import: true,
      power_decimals: 0,
      energy_decimals: 2,
      grid_import_price_per_kwh: null,
      battery_capacity_kwh: null,
      battery_2_capacity_kwh: null,
      ...config,
      ...layout,
      entities: {
        pv_inputs: ["", "", ""],
        battery_pv_inputs: ["", ""],
        battery_2_pv_inputs: ["", ""],
        battery_2_pv_energy_today: ["", ""],
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
    if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.") || path.startsWith("pv_energy_today.") || path.startsWith("battery_pv_energy_today.") || path.startsWith("battery_2_pv_inputs.") || path.startsWith("battery_2_pv_energy_today.")) {
      const [key, rawIndex] = path.split(".");
      const index = Number(rawIndex);
      next.entities[key] = [...(next.entities[key] || [])];
      next.entities[key][index] = value || "";
    } else if (path.startsWith("entities.")) {
      const key = path.slice("entities.".length);
      if (value) next.entities[key] = value;
      else delete next.entities[key];
    } else {
      next[path] = value;
    }
    if (Object.hasOwn(SOLAR_LAYOUT, path)) {
      solarLayout(next);
      for (const [key, count] of Object.entries({
        pv_inputs: next.pv_direct_inputs, pv_energy_today: next.pv_direct_inputs,
        battery_pv_inputs: next.pv_battery_inputs, battery_pv_energy_today: next.pv_battery_inputs,
        battery_2_pv_inputs: next.pv_battery_2_inputs, battery_2_pv_energy_today: next.pv_battery_2_inputs
      })) {
        next.entities[key] = [...(next.entities[key] || [])];
        while (next.entities[key].length < count) next.entities[key].push("");
      }
    }
    this._config = next;
    this.fireConfigChanged();
    if (Object.hasOwn(SOLAR_LAYOUT, path)) this.render();
  }

  render() {
    if (!this._config) return;
    const hasBattery = this._config.battery_count > 0;
    const hasSecondBattery = this._config.battery_count === 2;
    const inputFields = (count, label, key) => Array.from({ length: count }, (_, i) => [`${label} ${i + 1}`, `${key}.${i}`]);
    const liveFields = [
      ...inputFields(this._config.pv_direct_inputs, "Direkte PV-Leistung – Eingang", "pv_inputs"),
      ...(hasBattery ? [
        ...inputFields(this._config.pv_battery_inputs, "Batterie 1 – PV-Modul", "battery_pv_inputs"),
        ["Batterie 1 zum Wechselrichter", "entities.battery_to_inverter"],
        ["Batterie 1 – Ladestand", "entities.battery_soc"]
      ] : []),
      ...(hasSecondBattery ? [
        ...inputFields(2, "Batterie 2 – PV-Modul", "battery_2_pv_inputs"),
        ["Batterie 2 zum Wechselrichter", "entities.battery_2_to_inverter"],
        ["Batterie 2 – Ladestand", "entities.battery_2_soc"]
      ] : []),
      ["Wechselrichter-Ausgangsleistung", "entities.inverter_output"],
      ["Saldierte Netzleistung (Netzzähler)", "entities.grid_power"]
    ];
    const pvDayFields = [
      ...inputFields(this._config.pv_direct_inputs, "Tagesertrag direkte PV – Eingang", "pv_energy_today"),
      ...(hasBattery ? inputFields(this._config.pv_battery_inputs, "Tagesertrag Batterie 1 – PV-Modul", "battery_pv_energy_today") : []),
      ...(hasSecondBattery ? inputFields(2, "Tagesertrag Batterie 2 – PV-Modul", "battery_2_pv_energy_today") : [])
    ];
    const dayFields = [
      ["Wechselrichter AC-Erzeugung heute (für Hausbilanz)", "entities.inverter_energy_today"],
      ["Netzbezug heute", "entities.grid_import_energy_today"],
      ["Einspeisung heute", "entities.grid_export_energy_today"],
      ["Hausverbrauch heute", "entities.house_energy_today"],
      ...(hasBattery ? [
        ["Batterie 1 heute geladen", "entities.battery_charge_energy_today"],
        ["Batterie 1 heute entladen", "entities.battery_discharge_energy_today"]
      ] : []),
      ...(hasSecondBattery ? [
        ["Batterie 2 heute geladen", "entities.battery_2_charge_energy_today"],
        ["Batterie 2 heute entladen", "entities.battery_2_discharge_energy_today"]
      ] : [])
    ];
    const valueFor = (path) => {
      if (path.startsWith("pv_inputs.") || path.startsWith("battery_pv_inputs.") || path.startsWith("pv_energy_today.") || path.startsWith("battery_pv_energy_today.") || path.startsWith("battery_2_pv_inputs.") || path.startsWith("battery_2_pv_energy_today.")) {
        const [key, rawIndex] = path.split(".");
        return this._config.entities[key]?.[Number(rawIndex)] || "";
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
        solar-flow-card-editor ha-entity-picker { display:block; width:100%; }
        solar-flow-card-editor .input-field { display:grid; gap:6px; min-width:0; font-size:14px; color:var(--primary-text-color,#212121); }
        solar-flow-card-editor .input-field input { box-sizing:border-box; width:100%; min-width:0; min-height:48px; padding:12px; border:1px solid var(--divider-color,#bdbdbd); border-radius:6px; background:var(--card-background-color,#fff); color:var(--primary-text-color,#212121); font:inherit; }
        solar-flow-card-editor .input-field input:focus-visible { outline:2px solid var(--primary-color,#03a9f4); outline-offset:1px; }
        .switch-row { display:flex; justify-content:space-between; gap:16px; align-items:center; min-height:44px; }
        .switch-copy { display:grid; gap:3px; }
        .switch-label { font-size:14px; }
        .switch-hint { color:var(--secondary-text-color); font-size:12px; }
        .number-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      </style>
      <div class="editor">
        <div class="section">
          <div class="section-title">Darstellung</div>
          <label class="input-field"><span>Titel</span><input data-setting="title" value="${this.escape(this._config.title || "")}"></label>
          <div class="number-row">
            <label class="input-field"><span>Dezimalstellen Leistung</span><input data-number="power_decimals" type="number" min="0" max="3" step="1" value="${this._config.power_decimals}"></label>
            <label class="input-field"><span>Dezimalstellen Energie</span><input data-number="energy_decimals" type="number" min="0" max="3" step="1" value="${this._config.energy_decimals}"></label>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Anlagenaufbau</div>
          ${Object.entries(SOLAR_LAYOUT).filter(([key]) => key !== "pv_battery_inputs" || hasBattery).filter(([key]) => key !== "pv_battery_2_inputs" || hasSecondBattery).map(([key, spec]) => `
            <label class="input-field"><span>${spec.label}</span><input data-layout="${key}" type="number" min="${spec.min}" max="${spec.max}" step="1" value="${this._config[key]}"></label>`).join("")}
          <div class="hint">1–4 direkte PV-Eingänge, 0–2 Batterien und jeweils 1–2 PV-Platten pro Batterie. Ausgeblendete Entity-Zuordnungen bleiben gespeichert und werden nicht mitgerechnet.</div>
        </div>
        <div class="section">
          <div class="section-title">Live-Leistungen</div>
          <div class="hint">Pflichtfelder für das animierte Flussdiagramm.</div>
          ${liveFields.map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
        ${hasBattery ? `<div class="section">
          <div class="section-title">Batterie 1 – Kapazität</div>
          ${this.picker("Batterie 1 – aktuell gespeicherte Energie", "entities.battery_energy", valueFor("entities.battery_energy"))}
          <label class="input-field"><span>Gesamtkapazität (kWh)</span><input data-capacity type="text" inputmode="decimal" value="${this.escape(this._config.battery_capacity_kwh ?? "")}"></label>
          <div class="hint">Die Energie-Entity wird direkt angezeigt. Ohne Entity berechnet die Card den aktuellen Inhalt aus Gesamtkapazität und Ladestand.</div>
        </div>` : ""}
        ${hasSecondBattery ? `<div class="section">
          <div class="section-title">Batterie 2 – Kapazität</div>
          ${this.picker("Batterie 2 – aktuell gespeicherte Energie", "entities.battery_2_energy", valueFor("entities.battery_2_energy"))}
          <label class="input-field"><span>Batterie 2 – Gesamtkapazität (kWh)</span><input data-capacity-2 type="text" inputmode="decimal" value="${this.escape(this._config.battery_2_capacity_kwh ?? "")}"></label>
          <div class="hint">Ohne verfügbaren Energiewert wird der Inhalt aus Gesamtkapazität und Ladestand berechnet.</div>
        </div>` : ""}
        <div class="section">
          <div class="section-title">Haus und Netz</div>
          ${this.picker("Hausleistung (optional)", "entities.house_power", valueFor("entities.house_power"))}
          <div class="hint">Ohne Hausleistung berechnet die Card: Wechselrichter + saldierte Netzleistung.</div>
          ${this.picker("Strompreis Netzbezug (€/kWh, optional)", "entities.grid_import_price_per_kwh", valueFor("entities.grid_import_price_per_kwh"))}
          <label class="input-field"><span>Strompreis Netzbezug direkt (€/kWh, optional)</span><input data-import-price type="text" inputmode="decimal" value="${this.escape(this._config.grid_import_price_per_kwh ?? "")}"></label>
          <div class="hint">Wahlweise eine Preis-Entity oder einen festen Preis eintragen. Bei einer Entity hat deren aktueller Wert Vorrang; Cent/kWh werden automatisch in €/kWh umgerechnet.</div>
          <div class="switch-row">
            <div class="switch-copy"><span class="switch-label">Positive Netzleistung ist Bezug</span><span class="switch-hint">Ausschalten, wenn dein Netzzähler-Skript positive Werte bei Einspeisung liefert.</span></div>
            <ha-switch data-setting="grid_positive_is_import" ${this._config.grid_positive_is_import ? "checked" : ""}></ha-switch>
          </div>
        </div>
        <div class="section">
          <div class="section-title">PV-Tageserträge einzeln</div>
          <div class="hint">Optionale Energiezähler für jeden konfigurierten PV-Eingang.</div>
          ${pvDayFields.map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
        <div class="section">
          <div class="section-title">Tageswerte</div>
          <div class="hint">Optionale Energiezähler in kWh, die täglich zurückgesetzt werden.</div>
          ${dayFields.map(([label, path]) => this.picker(label, path, valueFor(path))).join("")}
        </div>
      </div>`;

    this.querySelectorAll("ha-entity-picker").forEach((picker) => {
      picker.hass = this._hass;
      picker.includeDomains = ["sensor", "input_number"];
      picker.addEventListener("value-changed", (event) => this.updatePath(picker.dataset.path, event.detail.value));
    });
    this.querySelector("input[data-setting='title']")?.addEventListener("change", (event) => this.updatePath("title", event.target.value));
    this.querySelectorAll("input[data-layout]").forEach((field) => field.addEventListener("change", (event) => {
      const key = field.dataset.layout;
      const spec = SOLAR_LAYOUT[key];
      const value = Number(event.target.value);
      if (String(event.target.value).trim() && Number.isInteger(value) && value >= spec.min && value <= spec.max) {
        this.updatePath(key, value);
      } else {
        field.value = this._config[key];
      }
    }));
    this.querySelectorAll("input[data-number]").forEach((field) => field.addEventListener("change", (event) => {
      const value = Math.max(0, Math.min(3, Number(event.target.value)));
      this.updatePath(field.dataset.number, Number.isFinite(value) ? value : 0);
    }));
    this.querySelector("input[data-capacity]")?.addEventListener("change", (event) => {
      const value = Number.parseFloat(String(event.target.value).trim().replace(",", "."));
      this.updatePath("battery_capacity_kwh", Number.isFinite(value) && value > 0 ? value : null);
    });
    this.querySelector("input[data-capacity-2]")?.addEventListener("change", (event) => {
      const value = Number.parseFloat(String(event.target.value).trim().replace(",", "."));
      this.updatePath("battery_2_capacity_kwh", Number.isFinite(value) && value > 0 ? value : null);
    });
    this.querySelector("input[data-import-price]")?.addEventListener("change", (event) => {
      const value = Number.parseFloat(String(event.target.value).trim().replace(",", "."));
      this.updatePath("grid_import_price_per_kwh", Number.isFinite(value) ? value : null);
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
