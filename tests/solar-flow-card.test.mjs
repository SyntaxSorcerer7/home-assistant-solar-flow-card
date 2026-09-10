import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const registry = new Map();
class HTMLElement {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      querySelector: () => null,
      querySelectorAll: () => []
    };
    return this.shadowRoot;
  }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}

const context = vm.createContext({
  HTMLElement,
  document: { createElement: () => ({ innerHTML: "" }) },
  CustomEvent: class {},
  Intl,
  console,
  window: { customCards: [] },
  customElements: {
    define: (name, constructor) => registry.set(name, constructor),
    get: (name) => registry.get(name)
  }
});
vm.runInContext(await readFile(new URL("../solar-flow-card.js", import.meta.url), "utf8"), context);
const SolarFlowCard = registry.get("solar-flow-card");

function makeCard(values, overrides = {}) {
  const ids = {
    pv_inputs: ["pv1", "pv2", "pv3"],
    battery_pv_inputs: ["bpv1", "bpv2"],
    battery_to_inverter: "batteryOut",
    inverter_output: "inverter",
    grid_power: "grid",
    battery_soc: "soc",
    battery_energy: "stored",
    solar_energy_today: "solarDay",
    grid_import_energy_today: "importDay",
    grid_export_energy_today: "exportDay",
    battery_charge_energy_today: "chargeDay",
    battery_discharge_energy_today: "dischargeDay",
    ...overrides.entities
  };
  const card = new SolarFlowCard();
  card.setConfig({ grid_positive_is_import: true, ...overrides, entities: ids });
  const text = {};
  const scene = {};
  card._root.querySelector = (selector) => selector === "solar-energy-flow" ? scene : null;
  card.setText = (name, value) => { text[name] = value; };
  card._hass = {
    locale: { language: "de-DE" },
    states: Object.fromEntries(Object.entries(values).map(([id, state]) => [id, typeof state === "object" ? state : { state: String(state), attributes: { unit_of_measurement: "W" } }]))
  };
  card.updateValues();
  return { text, scene, card };
}

test("maps the live Home Assistant export balance without changing V1 information", () => {
  const { text, scene } = makeCard({
    pv1: 177, pv2: 240, pv3: 220, bpv1: 110, bpv2: 75,
    batteryOut: 36, inverter: 672, grid: -555,
    soc: { state: "58", attributes: { unit_of_measurement: "%" } },
    stored: { state: "1300", attributes: { unit_of_measurement: "Wh" } },
    solarDay: { state: "0.69", attributes: { unit_of_measurement: "kWh" } },
    importDay: { state: "5.28", attributes: { unit_of_measurement: "kWh" } },
    exportDay: { state: "6.48", attributes: { unit_of_measurement: "kWh" } },
    chargeDay: { state: "0.05", attributes: { unit_of_measurement: "kWh" } },
    dischargeDay: { state: "0.32", attributes: { unit_of_measurement: "kWh" } }
  });
  assert.equal(text["direct-pv"], "637 W");
  assert.equal(text["battery-pv"], "185 W");
  assert.equal(text.house, "117 W");
  assert.equal(text["house-pv"], "117 W");
  assert.equal(text["grid-import"], "0 W");
  assert.equal(text["grid-export"], "555 W");
  assert.equal(text["battery-stored"], "1,30 kWh");
  assert.equal(text.autarky, "100 %");
  assert.equal(scene.data.gridExport, 555);
  assert.equal(scene.data.gridImport, 0);
  assert.equal(scene.data.batteryPower, 36);
});

test("normalizes kW, imports from the grid and derives house/autarky", () => {
  const { text, scene } = makeCard({
    pv1: { state: "0.1", attributes: { unit_of_measurement: "kW" } },
    pv2: 200, pv3: 100, bpv1: 0, bpv2: 0, batteryOut: 0,
    inverter: { state: "0.4", attributes: { unit_of_measurement: "kW" } },
    grid: { state: "0.2", attributes: { unit_of_measurement: "kW" } },
    soc: 50
  });
  assert.equal(text["direct-pv"], "400 W");
  assert.equal(text.house, "600 W");
  assert.equal(text["house-pv"], "400 W");
  assert.equal(text["house-grid"], "200 W");
  assert.equal(text.autarky, "67 %");
  assert.equal(scene.data.gridImport, 200);
  assert.equal(scene.data.gridExport, 0);
});

test("keeps unavailable optional values visible as a dash", () => {
  const { text } = makeCard({ pv1: 1, pv2: 2, pv3: 3, bpv1: 4, bpv2: 5, batteryOut: 0, inverter: 0, grid: 0, soc: 0 });
  assert.equal(text["pv-day-1"], "–");
  assert.equal(text["battery-pv-day-1"], "–");
  assert.equal(text["battery-capacity"], "–");
  assert.equal(text["house-day"], "–");
});


test("V3 uses only the supplied webcomponent and maps every field", () => {
  const { card, scene } = makeCard({pv1: 1, pv2: 2, pv3: 3, bpv1: 4, bpv2: 5, inverter: 6, grid: -2, soc: 150, batteryOut: 0});
  assert.match(card.shadowRoot.innerHTML, /<solar-energy-flow><\/solar-energy-flow>/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /<svg|energy-scene/);
  assert.deepEqual(JSON.parse(JSON.stringify(scene.data)), {
    pvDirect1: 1, pvDirect2: 2, pvDirect3: 3, pvDirectTotal: 6,
    pvBattery1: 4, pvBattery2: 5, pvBatteryTotal: 9,
    inverterPower: 6, batteryPower: 0, batterySoc: 100, batteryCapacity: null,
    housePower: 4, autarky: 100, gridImport: 0, gridExport: 2
  });
});

test("unknown grid cannot produce fictitious autarky; partial sums remain unknown", () => {
  const { text, scene } = makeCard({ pv1: 10, pv2: 'unavailable', pv3: 20, house: 100, grid: 'unknown' }, { entities: { house_power: 'house' } });
  assert.equal(text.autarky, '–');
  assert.equal(scene.data.autarky, null);
  assert.equal(scene.data.pvDirectTotal, null);
  assert.equal(scene.data.gridImport, null);
  assert.equal(scene.data.housePower, 100);
});

test("normalizes reversed grid signs and derives stored battery energy", () => {
  const { scene, text } = makeCard({ inverter: 100, grid: -200, soc: 50 }, { grid_positive_is_import: false, battery_capacity_kwh: 4.8 });
  assert.equal(scene.data.gridImport, 200);
  assert.equal(scene.data.housePower, 300);
  assert.equal(text['battery-stored'], '2,40 kWh');
});

test("component formats unknown values and keeps raw watts for animation", () => {
  const component = registry.get('solar-energy-flow').prototype;
  assert.equal(component._formatPower(null), '–');
  assert.equal(component._formatPercent(null), '–');
  assert.equal(component._numericPower(null), null);
  assert.equal(component._numericPower(1234), 1234);
  assert.equal(component._formatPower.call({locale:'de-DE', powerDecimals:2}, 12.34), '12,34 W');
  const pulses = [null, 0, 1, 2].map(value => ({dataset:{flowKey:'power'}, classList:{toggle: (_name, inactive) => { assert.equal(inactive, value === null || value <= 1); }}, value}));
  for (const pulse of pulses) component._render.call({
    _renderBatteryState: () => {}, _data: {power: pulse.value}, _formatValue: () => '–', _numericPower: component._numericPower,
    shadowRoot: {getElementById: () => null, querySelectorAll: () => [pulse]}
  });
});

for (const positiveIsImport of [true, false]) {
  for (const [net, expectedHouse] of [[100, 269], [-100, 69], [0, 169]]) {
    test(`Shelly balance without house sensor: net ${net} W, positive import ${positiveIsImport}`, () => {
      const { scene, text } = makeCard({ inverter: 169, grid: positiveIsImport ? net : -net }, {
        grid_positive_is_import: positiveIsImport
      });
      assert.equal(scene.data.housePower, expectedHouse);
      assert.equal(text.house, `${expectedHouse} W`);
      assert.equal(scene.data.gridImport, Math.max(0, net));
      assert.equal(scene.data.gridExport, Math.max(0, -net));
      assert.equal(scene.data.gridImport * scene.data.gridExport, 0);
    });
  }
}

test('optional house sensor takes precedence, including zero, and falls back when unavailable', () => {
  for (const [reading, expected] of [[500, 500], [0, 0], ['unavailable', 269], ['unknown', 269], ['', 269]]) {
    const { scene } = makeCard({ inverter: 169, grid: 100, house: reading }, { entities: { house_power: 'house' } });
    assert.equal(scene.data.housePower, expected);
    assert.equal(scene.data.gridImport, 100);
    assert.equal(scene.data.gridExport, 0);
  }
  const { scene } = makeCard({ inverter: 169, grid: 100 }, { entities: { house_power: '' } });
  assert.equal(scene.data.housePower, 269);
});

test('missing balance readings stay unknown instead of assuming zero', () => {
  for (const values of [{ inverter: 169 }, { grid: 100 }, { inverter: 169, grid: 'unavailable' }]) {
    const { scene, text } = makeCard(values);
    assert.equal(scene.data.housePower, null);
    assert.equal(text.house, '–');
    assert.equal(text.autarky, '–');
  }
});

test('live direction changes reset the opposite arrow in the bundled graphic', () => {
  const { card, scene } = makeCard({ inverter: 169, grid: 100 });
  const component = registry.get('solar-energy-flow').prototype;
  const nodes = Object.fromEntries(['housePower', 'gridImportFlow', 'gridExportFlow'].map(id => [id, {}]));
  const graphic = Object.assign(Object.create(component), {
    shadowRoot: { getElementById: id => nodes[id], querySelectorAll: () => [] },
    locale: 'de-DE', powerDecimals: 0
  });
  for (const [grid, house, imported, exported] of [
    [100, '269 W', '100 W', '0 W'],
    [-100, '69 W', '0 W', '100 W'],
    [0, '169 W', '0 W', '0 W'],
    ['unavailable', '–', '–', '–'],
    [50, '219 W', '50 W', '0 W']
  ]) {
    card.hass = { ...card._hass, states: { ...card._hass.states, grid: { state: String(grid), attributes: { unit_of_measurement: 'W' } } } };
    graphic._data = scene.data;
    graphic._render();
    assert.equal(nodes.housePower.textContent, house);
    assert.equal(nodes.gridImportFlow.textContent, imported);
    assert.equal(nodes.gridExportFlow.textContent, exported);
  }
});

test('HACS entry point includes card, editor and graphic with matching compressed content', async () => {
  const { gunzipSync } = await import('node:zlib');
  const manifest = JSON.parse(await readFile(new URL('../hacs.json', import.meta.url), 'utf8'));
  const bundle = await readFile(new URL(`../${manifest.filename}`, import.meta.url), 'utf8');
  const compressed = await readFile(new URL(`../${manifest.filename}.gz`, import.meta.url));
  assert.equal(gunzipSync(compressed).toString(), bundle);
  for (const path of ['src/solar-flow-card.js', 'solar-energy-flow-component/solar-energy-flow.js']) {
    assert.ok(bundle.includes(await readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  }
  for (const name of ['solar-flow-card', 'solar-flow-card-editor', 'solar-energy-flow']) assert.ok(registry.has(name));
  assert.ok(context.window.customCards.some(card => card.type === 'solar-flow-card'));
  assert.doesNotMatch(bundle, /\bimport\s+(?:['"{*]|.*\bfrom\b)/);
});

test('new battery graphic receives measured or calculated stored energy in kWh', () => {
  const measured = makeCard({ inverter: 169, grid: 100, soc: 50, stored: { state: '1300', attributes: { unit_of_measurement: 'Wh' } } }, { battery_capacity_kwh: 4.8 });
  assert.equal(measured.scene.data.batteryCapacity, 1.3);
  const calculated = makeCard({ inverter: 169, grid: 100, soc: 50 }, { battery_capacity_kwh: 4.8 });
  assert.equal(calculated.scene.data.batteryCapacity, 2.4);
  const missing = makeCard({ inverter: 169, grid: 100, soc: 50 });
  assert.equal(missing.scene.data.batteryCapacity, null);
  const component = registry.get('solar-energy-flow').prototype;
  assert.equal(component._formatCapacity.call({ locale: 'de-DE' }, 2.4), '2,40 kWh');
  assert.equal(component._formatCapacity(null), '–');
});

test('battery fill follows live state of charge and clamps invalid ranges', () => {
  const component = registry.get('solar-energy-flow').prototype;
  for (const [soc, height, color] of [[0, 0, 'battery-liquid-critical'], [20, 10, 'battery-liquid-critical'], [40, 20, 'battery-liquid-low'], [80, 40, null], [150, 50, null], [-10, 0, 'battery-liquid-critical'], [null, 0, 'battery-liquid-critical']]) {
    const attributes = {};
    const classes = new Set(['battery-liquid-low', 'battery-liquid-critical']);
    const fill = { setAttribute: (key, value) => { attributes[key] = value; }, classList: { remove: (...names) => names.forEach(name => classes.delete(name)), add: name => classes.add(name) } };
    const graphic = Object.assign(Object.create(component), { _data: { batterySoc: soc }, shadowRoot: { getElementById: id => id === 'batteryLevelFill' ? fill : null } });
    graphic._renderBatteryState();
    assert.equal(Number(attributes.height), height);
    assert.equal(Number(attributes.y), 58 - height);
    assert.deepEqual([...classes], color ? [color] : []);
  }
});

test('inverter-to-house arrow subtracts Shelly export and animates only the remaining power', () => {
  const component = registry.get('solar-energy-flow').prototype;
  for (const [inverter, grid, houseSensor, expected, inactive] of [
    [1540, -745, 900, '795 W', false],
    [169, 100, 900, '169 W', false],
    [169, 0, 900, '169 W', false],
    [169, -169, 900, '0 W', true],
    [169, -200, 900, '0 W', true],
    [169, 'unavailable', 900, '–', true],
    ['unavailable', -100, 900, '–', true]
  ]) {
    const { scene } = makeCard({ inverter, grid, house: houseSensor }, { entities: { house_power: 'house' } });
    const nodes = { inverterPowerFlow: {}, inverterPowerGraphic: {} };
    let stopped;
    const pulse = { dataset: { flowKey: 'inverterToHouse' }, classList: { toggle: (_name, value) => { stopped = value; } } };
    const graphic = Object.assign(Object.create(component), {
      _data: scene.data, locale: 'de-DE', powerDecimals: 0,
      shadowRoot: { getElementById: id => nodes[id], querySelectorAll: () => [pulse] }
    });
    graphic._render();
    assert.equal(nodes.inverterPowerFlow.textContent, expected);
    assert.equal(nodes.inverterPowerGraphic.textContent, graphic._formatPower(scene.data.inverterPower));
    assert.equal(stopped, inactive);
    assert.equal(scene.data.housePower, 900);
  }
});
