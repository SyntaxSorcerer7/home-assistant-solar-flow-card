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

// All fixtures are synthetic and contain no household measurements.
test("maps a synthetic export balance and normalizes stored energy", () => {
  const { text, scene } = makeCard({
    pv1: 200, pv2: 300, pv3: 400, bpv1: 100, bpv2: 200,
    batteryOut: 200, inverter: 1000, grid: -200,
    soc: { state: "60", attributes: { unit_of_measurement: "%" } },
    stored: { state: "3000", attributes: { unit_of_measurement: "Wh" } }
  });
  assert.equal(text["direct-pv"], "900 W");
  assert.equal(text["battery-pv"], "300 W");
  assert.equal(text.house, "800 W");
  assert.equal(text["house-pv"], "800 W");
  assert.equal(text["grid-import"], "0 W");
  assert.equal(text["grid-export"], "200 W");
  assert.equal(text["battery-stored"], "3,00 kWh");
  assert.equal(text.autarky, "100 %");
  assert.equal(scene.data.gridExport, 200);
  assert.equal(scene.data.gridImport, 0);
  assert.equal(scene.data.batteryPower, 200);
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
    pvDirectInputs: 3, batteryCount: 1, pvBatteryInputs: 2,
    pvDirect1: 1, pvDirect2: 2, pvDirect3: 3, pvDirect4: null, pvDirectTotal: 6,
    pvBattery1: 4, pvBattery2: 5, pvBatteryTotal: 9,
    pvBattery2Input1: null, pvBattery2Input2: null, pvBattery2Inputs: 2, pvBattery2Total: null,
    battery2Power: null, battery2Soc: null, battery2Capacity: null,
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
  const { scene, text } = makeCard({ inverter: 100, grid: -200, soc: 50 }, { grid_positive_is_import: false, battery_capacity_kwh: 5.0 });
  assert.equal(scene.data.gridImport, 200);
  assert.equal(scene.data.housePower, 300);
  assert.equal(text['battery-stored'], '2,50 kWh');
});

test("component formats unknown values and keeps raw watts for animation", () => {
  const component = registry.get('solar-energy-flow').prototype;
  assert.equal(component._formatPower(null), '–');
  assert.equal(component._formatPercent(null), '–');
  assert.equal(component._numericPower(null), null);
  assert.equal(component._numericPower(1234), 1234);
  assert.equal(component._formatPower.call({locale:'de-DE', powerDecimals:2}, 12.34), '12,34 W');
  const pulses = [null, 0, 1, 2].map(value => ({dataset:{flowKey:'power'}, classList:{toggle: (_name, inactive) => { assert.equal(inactive, value === null || value <= 1); }}, value}));
  for (const pulse of pulses) component._render.call(Object.assign(Object.create(component), {
    _renderStorageLayout: () => {}, _renderBatteryState: () => {}, _data: {power: pulse.value}, _formatValue: () => '–', _numericPower: component._numericPower,
    shadowRoot: {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [pulse]}
  }));
});

for (const positiveIsImport of [true, false]) {
  for (const [net, expectedHouse] of [[100, 300], [-100, 100], [0, 200]]) {
    test(`Netzzähler balance without house sensor: net ${net} W, positive import ${positiveIsImport}`, () => {
      const { scene, text } = makeCard({ inverter: 200, grid: positiveIsImport ? net : -net }, {
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
  for (const [reading, expected] of [[500, 500], [0, 0], ['unavailable', 300], ['unknown', 300], ['', 300]]) {
    const { scene } = makeCard({ inverter: 200, grid: 100, house: reading }, { entities: { house_power: 'house' } });
    assert.equal(scene.data.housePower, expected);
    assert.equal(scene.data.gridImport, 100);
    assert.equal(scene.data.gridExport, 0);
  }
  const { scene } = makeCard({ inverter: 200, grid: 100 }, { entities: { house_power: '' } });
  assert.equal(scene.data.housePower, 300);
});

test('missing balance readings stay unknown instead of assuming zero', () => {
  for (const values of [{ inverter: 200 }, { grid: 100 }, { inverter: 200, grid: 'unavailable' }]) {
    const { scene, text } = makeCard(values);
    assert.equal(scene.data.housePower, null);
    assert.equal(text.house, '–');
    assert.equal(text.autarky, '–');
  }
});

test('live direction changes reset the opposite arrow in the bundled graphic', () => {
  const { card, scene } = makeCard({ inverter: 200, grid: 100 });
  const component = registry.get('solar-energy-flow').prototype;
  const nodes = Object.fromEntries(['housePower', 'gridImportFlow', 'gridExportFlow'].map(id => [id, {}]));
  const graphic = Object.assign(Object.create(component), {
    shadowRoot: { querySelector: () => null, getElementById: id => nodes[id], querySelectorAll: () => [] },
    _renderStorageLayout: () => {}, locale: 'de-DE', powerDecimals: 0
  });
  for (const [grid, house, imported, exported] of [
    [100, '300 W', '100 W', '0 W'],
    [-100, '100 W', '0 W', '100 W'],
    [0, '200 W', '0 W', '0 W'],
    ['unavailable', '–', '–', '–'],
    [50, '250 W', '50 W', '0 W']
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
  const measured = makeCard({ inverter: 200, grid: 100, soc: 50, stored: { state: '1300', attributes: { unit_of_measurement: 'Wh' } } }, { battery_capacity_kwh: 5.0 });
  assert.equal(measured.scene.data.batteryCapacity, 1.3);
  const calculated = makeCard({ inverter: 200, grid: 100, soc: 50 }, { battery_capacity_kwh: 5.0 });
  assert.equal(calculated.scene.data.batteryCapacity, 2.5);
  const missing = makeCard({ inverter: 200, grid: 100, soc: 50 });
  assert.equal(missing.scene.data.batteryCapacity, null);
  const component = registry.get('solar-energy-flow').prototype;
  assert.equal(component._formatCapacity.call({ locale: 'de-DE' }, 2.5), '2,50 kWh');
  assert.equal(component._formatCapacity(null), '–');
});

test('battery fill follows live state of charge and clamps invalid ranges', () => {
  const component = registry.get('solar-energy-flow').prototype;
  for (const [soc, height, color] of [[0, 0, 'battery-liquid-critical'], [20, 10, 'battery-liquid-critical'], [40, 20, 'battery-liquid-low'], [80, 40, null], [150, 50, null], [-10, 0, 'battery-liquid-critical'], [null, 0, 'battery-liquid-critical']]) {
    const attributes = {};
    const classes = new Set(['battery-liquid-low', 'battery-liquid-critical']);
    const fill = { setAttribute: (key, value) => { attributes[key] = value; }, classList: { remove: (...names) => names.forEach(name => classes.delete(name)), add: name => classes.add(name) } };
    const graphic = Object.assign(Object.create(component), { _data: { batterySoc: soc }, shadowRoot: { getElementById: id => id === 'batteryLevelFill' ? fill : null } });
    graphic._renderBatteryState("battery");
    assert.equal(Number(attributes.height), height);
    assert.equal(Number(attributes.y), 58 - height);
    assert.deepEqual([...classes], color ? [color] : []);
  }
});

test('inverter-to-house arrow subtracts Netzzähler export and animates only the remaining power', () => {
  const component = registry.get('solar-energy-flow').prototype;
  for (const [inverter, grid, houseSensor, expected, inactive] of [
    [1000, -200, 900, '800 W', false],
    [200, 100, 900, '200 W', false],
    [200, 0, 900, '200 W', false],
    [200, -200, 900, '0 W', true],
    [200, -200, 900, '0 W', true],
    [200, 'unavailable', 900, '–', true],
    ['unavailable', -100, 900, '–', true]
  ]) {
    const { scene } = makeCard({ inverter, grid, house: houseSensor }, { entities: { house_power: 'house' } });
    const nodes = { inverterPowerFlow: {}, inverterPowerGraphic: {} };
    let stopped;
    const pulse = { dataset: { flowKey: 'inverterToHouse' }, classList: { toggle: (_name, value) => { stopped = value; } } };
    const graphic = Object.assign(Object.create(component), {
      _renderStorageLayout: () => {}, _data: scene.data, locale: 'de-DE', powerDecimals: 0,
      shadowRoot: { querySelector: () => null, getElementById: id => nodes[id], querySelectorAll: () => [pulse] }
    });
    graphic._render();
    assert.equal(nodes.inverterPowerFlow.textContent, expected);
    assert.equal(nodes.inverterPowerGraphic.textContent, graphic._formatPower(scene.data.inverterPower));
    assert.equal(stopped, inactive);
    assert.equal(scene.data.housePower, 900);
  }
});

const kwh = (value) => ({ state: String(value), attributes: { unit_of_measurement: 'kWh' } });

test('daily house autonomy counts direct PV and battery supply independently of live power', () => {
  const { text } = makeCard({ houseDay: kwh(10), importDay: kwh(2.5), inverter: 0, grid: 500 }, {
    entities: { house_energy_today: 'houseDay' }
  });
  assert.equal(text['house-day'], '10,00 kWh');
  assert.equal(text['house-self-day'], '7,50 kWh');
  assert.equal(text['autarky-day'], '75 %');
  assert.equal(text.autarky, '0 %');
});

test('daily house balance uses AC generation and never raw solar production', () => {
  const values = { acDay: kwh(8), importDay: kwh(3), exportDay: kwh(1), solarDay: kwh(20) };
  const { text } = makeCard(values, { entities: { inverter_energy_today: 'acDay' } });
  assert.equal(text['house-day'], '10,00 kWh');
  assert.equal(text['house-self-day'], '7,00 kWh');
  assert.equal(text['autarky-day'], '70 %');
  assert.equal(makeCard(values).text['house-day'], '–');
  assert.equal(makeCard(values).text['autarky-day'], '–');
});

test('shows daily grid-import costs only when a price is configured', () => {
  const values = { houseDay: kwh(10), importDay: kwh(7.25) };
  const withoutPrice = makeCard(values, { entities: { house_energy_today: 'houseDay' } });
  assert.equal(withoutPrice.text['import-cost-day'], '–');
  assert.equal(withoutPrice.text['house-savings-day'], '–');
  assert.doesNotMatch(withoutPrice.card.shadowRoot.innerHTML, /Kosten Netzbezug/);
  assert.doesNotMatch(withoutPrice.card.shadowRoot.innerHTML, /Ersparnis Selbstversorgung/);

  const direct = makeCard(values, { grid_import_price_per_kwh: 0.32, entities: { house_energy_today: 'houseDay' } });
  assert.equal(direct.text['import-cost-day'], '2,32 €');
  assert.equal(direct.text['house-savings-day'], '0,88 €');
  assert.match(direct.card.shadowRoot.innerHTML, /Kosten Netzbezug/);
  assert.match(direct.card.shadowRoot.innerHTML, /Ersparnis Selbstversorgung/);
});

test('uses the configured import-price entity before a direct value and normalizes cents', () => {
  const { text } = makeCard({ importDay: kwh(10), price: { state: '31.5', attributes: { unit_of_measurement: 'ct/kWh' } } }, {
    grid_import_price_per_kwh: 0.99,
    entities: { grid_import_price_per_kwh: 'price' }
  });
  assert.equal(text['import-cost-day'], '3,15 €');
});

test('values grid exports at the import price when the feed-in tariff is missing or zero and marks it red', () => {
  const fallback = makeCard({ exportDay: kwh(5) }, { grid_import_price_per_kwh: 0.32, grid_export_price_per_kwh: 0 });
  assert.equal(fallback.text['export-value-day'], '1,60 €');
  assert.match(fallback.card.shadowRoot.innerHTML, /export-value-uncompensated/);
  assert.match(fallback.card.shadowRoot.innerHTML, /nicht vergütet/);

  const compensated = makeCard({ exportDay: kwh(5), feedIn: { state: '8', attributes: { unit_of_measurement: 'ct/kWh' } } }, {
    grid_import_price_per_kwh: 0.32, grid_export_price_per_kwh: 0.99,
    entities: { grid_export_price_per_kwh: 'feedIn' }
  });
  assert.equal(compensated.text['export-value-day'], '0,40 €');
  assert.match(compensated.card.exportValueRow(), /export-value-compensated/);
  assert.match(compensated.card.exportValueRow(), /Wert Einspeisung<\/span>/);
});

test('daily input totals normalize Wh and add battery discharge only at inverter', () => {
  const values = { d1: kwh(1), d2: {state:'2000', attributes:{unit_of_measurement:'Wh'}}, d3: kwh(3), b1: kwh(0.4), b2: kwh(0.6), dischargeDay: kwh(2) };
  const entities = { pv_energy_today:['d1','d2','d3'], battery_pv_energy_today:['b1','b2'] };
  const { text } = makeCard(values, { entities });
  assert.equal(text['direct-pv-day'], '6,00 kWh');
  assert.equal(text['inverter-input-day'], '8,00 kWh');
  assert.equal(text['battery-pv-day'], '1,00 kWh');
  assert.equal(text['battery-charged-today'], '1,00 kWh');
  assert.equal(makeCard({...values,d2:'unavailable'}, {entities}).text['direct-pv-day'], '–');
  assert.equal(makeCard({...values,b2:'unavailable',chargeDay:kwh(5)}, {entities}).text['battery-pv-day'], '–');
  assert.equal(makeCard({chargeDay:kwh(5)}).text['battery-pv-day'], '5,00 kWh');
});

test('daily autonomy remains unknown at midnight or without import reading', () => {
  for (const values of [{houseDay:kwh(0),importDay:kwh(0)}, {houseDay:kwh(3)}]) {
    assert.equal(makeCard(values, {entities:{house_energy_today:'houseDay'}}).text['autarky-day'], '–');
  }
  const { text } = makeCard({houseDay:kwh(2),importDay:kwh(3)}, {entities:{house_energy_today:'houseDay'}});
  assert.equal(text['house-self-day'], '0,00 kWh');
  assert.equal(text['autarky-day'], '0 %');
});

for (const direct of [1, 2, 3, 4]) {
  for (const batteries of [0, 1, 2]) {
    for (const batteryPv of [1, 2]) {
      test(`layout ${direct} direct / ${batteries} battery / ${batteryPv} battery PV maps only active sensors`, () => {
        const {card, scene, text} = makeCard({pv1:10,pv2:20,pv3:30,pv4:40,bpv1:50,bpv2:60,
          d1:kwh(1),d2:kwh(2),d3:kwh(3),d4:kwh(4),b1:kwh(5),b2:kwh(6),dischargeDay:kwh(2),secondDischarge:kwh(2),secondPv1:70,secondPv2:80}, {
          pv_direct_inputs:direct, battery_count:batteries, pv_battery_inputs:batteryPv,
          entities:{pv_inputs:['pv1','pv2','pv3','pv4'],pv_energy_today:['d1','d2','d3','d4'],
            battery_pv_energy_today:['b1','b2'], battery_2_pv_inputs:['secondPv1','secondPv2'],
            battery_2_to_inverter:'secondOut',battery_2_soc:'secondSoc',battery_2_discharge_energy_today:'secondDischarge'}
        });
        assert.equal(scene.data.pvDirectInputs, direct);
        assert.equal(scene.data.batteryCount, batteries);
        assert.equal(scene.data.pvBatteryInputs, batteryPv);
        assert.equal(scene.data.pvDirectTotal, direct*(direct+1)*5);
        assert.equal(scene.data.pvDirect4, direct === 4 ? 40 : null);
        assert.equal(scene.data.pvBatteryTotal, batteries ? (batteryPv === 1 ? 50 : 110) : 0);
        assert.equal(text['inverter-input-day'], `${direct*(direct+1)/2 + batteries*2},00 kWh`);
        assert.equal((card.shadowRoot.innerHTML.match(/class="summary"/g)||[]).length, 4 + (batteries ? 2 : 0));
        assert.match(card.shadowRoot.innerHTML, new RegExp(`${direct}× PV direkt`));
        const Editor = registry.get('solar-flow-card-editor');
        const editor = new Editor();
        editor.setConfig(card.config);
        assert.equal((editor.innerHTML.match(/data-path="pv_inputs\./g)||[]).length, direct);
        assert.equal((editor.innerHTML.match(/data-path="battery_pv_inputs\./g)||[]).length, (batteries ? batteryPv : 0));
        assert.equal(editor.innerHTML.includes('data-capacity'), Boolean(batteries));
      });
    }
  }
}

test('battery-free configuration requires no battery entities and ignores stale discharge', () => {
  const card = new SolarFlowCard();
  card.setConfig({battery_count:0,pv_direct_inputs:1,entities:{pv_inputs:['pv'],inverter_output:'inv',grid_power:'grid'}});
  assert.equal(card.config.entities.battery_pv_inputs.length, 0);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /aria-label="Batterie"|aria-label="2× PV Batterie"/);
});

test('counts reject unsupported values and active power arrays must have enough slots', () => {
  for (const [key, values] of Object.entries({pv_direct_inputs:[0,5,1.5,'2',null],battery_count:[-1,3,1.5,'2',true],pv_battery_inputs:[0,3]})) {
    for (const value of values) assert.throws(() => makeCard({}, {[key]:value}), /ganze Zahl/);
  }
  assert.throws(() => makeCard({}, {pv_direct_inputs:4}), /mindestens 4/);
  assert.throws(() => makeCard({}, {entities:{battery_pv_inputs:[]}}), /mindestens 2/);
});

test('editor expands entity slots, emits valid config and restores hidden selections', () => {
  const editor = new (registry.get('solar-flow-card-editor'))();
  let emitted;
  editor.fireConfigChanged = () => { emitted = editor._config; };
  editor.setConfig(SolarFlowCard.getStubConfig());
  editor.updatePath('pv_direct_inputs', 4);
  assert.equal(emitted.entities.pv_inputs.length,4);
  assert.equal(emitted.entities.pv_energy_today.length,4);
  editor.updatePath('pv_inputs.3','sensor.fourth');
  editor.updatePath('pv_direct_inputs',1);
  assert.doesNotMatch(editor.innerHTML,/data-path="pv_inputs\.3"/);
  assert.equal(editor._config.entities.pv_inputs[3],'sensor.fourth');
  editor.updatePath('pv_direct_inputs',4);
  assert.match(editor.innerHTML,/value="sensor.fourth"/);
  editor.updatePath('pv_battery_inputs',1);
  assert.doesNotMatch(editor.innerHTML,/data-path="battery_pv_inputs\.1"/);
  editor.updatePath('battery_count',0);
  assert.doesNotMatch(editor.innerHTML,/data-path="entities.battery_/);
  editor.updatePath('battery_count',1);
  editor.updatePath('pv_battery_inputs',2);
  assert.match(editor.innerHTML,/value="sensor.example_battery_solar_input_2_power"/);
  new SolarFlowCard().setConfig(emitted);
});

test('editor uses labelled native inputs without requiring lazy-loaded HA text fields', () => {
  const editor = new (registry.get('solar-flow-card-editor'))();
  editor.setConfig(SolarFlowCard.getStubConfig());
  assert.doesNotMatch(editor.innerHTML, /ha-textfield/);
  assert.match(editor.innerHTML, /<label class="input-field"><span>Titel<\/span><input data-setting="title"/);
  assert.match(editor.innerHTML, /data-path="entities.grid_import_price_per_kwh"/);
  assert.match(editor.innerHTML, /data-import-price/);
  assert.match(editor.innerHTML, /data-path="entities.grid_export_price_per_kwh"/);
  assert.match(editor.innerHTML, /data-export-price/);
  for (const key of ['pv_direct_inputs', 'battery_count', 'pv_battery_inputs']) {
    assert.match(editor.innerHTML, new RegExp(`<input data-layout="${key}" type="number"`));
  }
});

test('native input change listeners update configuration and reject invalid counts', () => {
  const editor = new (registry.get('solar-flow-card-editor'))();
  const fields = ['pv_direct_inputs','battery_count','pv_battery_inputs'].map(key => ({
    dataset:{layout:key}, addEventListener(_type, handler) { this.change=handler; }
  }));
  const title = { addEventListener(_type, handler) { this.change=handler; } };
  const capacity = { addEventListener(_type, handler) { this.change=handler; } };
  const importPrice = { addEventListener(_type, handler) { this.change=handler; } };
  const exportPrice = { addEventListener(_type, handler) { this.change=handler; } };
  editor.querySelectorAll = selector => selector === 'input[data-layout]' ? fields : [];
  editor.querySelector = selector => selector === "input[data-setting='title']" ? title : selector === 'input[data-capacity]' ? capacity : selector === 'input[data-import-price]' ? importPrice : selector === 'input[data-export-price]' ? exportPrice : null;
  let emitted;
  editor.fireConfigChanged = () => { emitted=editor._config; };
  editor.setConfig(SolarFlowCard.getStubConfig());
  fields[0].change({target:{value:'4'}});
  assert.equal(emitted.pv_direct_inputs,4);
  assert.equal(emitted.entities.pv_inputs.length,4);
  fields[0].change({target:{value:'5'}});
  assert.equal(emitted.pv_direct_inputs,4);
  assert.equal(fields[0].value,4);
  fields[2].change({target:{value:'1'}});
  assert.equal(emitted.pv_battery_inputs,1);
  fields[1].change({target:{value:'0'}});
  assert.equal(emitted.battery_count,0);
  assert.doesNotMatch(editor.innerHTML,/data-layout="pv_battery_inputs"/);
  title.change({target:{value:'Meine PV'}});
  assert.equal(emitted.title,'Meine PV');
  capacity.change({target:{value:'5,5'}});
  assert.equal(emitted.battery_capacity_kwh,5.5);
  importPrice.change({target:{value:'0,325'}});
  assert.equal(emitted.grid_import_price_per_kwh,0.325);
  exportPrice.change({target:{value:'0,08'}});
  assert.equal(emitted.grid_export_price_per_kwh,0.08);
});

const secondBattery = {
  battery_count: 2, battery_capacity_kwh: 5, battery_2_capacity_kwh: 8,
  entities: {
    battery_2_pv_inputs: ['secondPv1', 'secondPv2'],
    battery_2_pv_energy_today: ['secondDay1', 'secondDay2'],
    battery_2_to_inverter: 'secondOut', battery_2_soc: 'secondSoc',
    battery_2_energy: 'secondStored', battery_2_charge_energy_today: 'secondCharge',
    battery_2_discharge_energy_today: 'secondDischarge', pv_energy_today: ['d1','d2','d3']
  }
};

test('two batteries map independent PV, output, state and energy including unit conversion', () => {
  const {scene, text, card} = makeCard({bpv1:10,bpv2:20,batteryOut:30,soc:40,
    secondPv1:{state:'0.4',attributes:{unit_of_measurement:'kW'}}, secondPv2:500,
    secondOut:200,secondSoc:75,secondStored:{state:'3500',attributes:{unit_of_measurement:'Wh'}},
    secondDay1:kwh(2),secondDay2:kwh(3),secondCharge:kwh(6),secondDischarge:kwh(4),
    dischargeDay:kwh(1),d1:kwh(1),d2:kwh(2),d3:kwh(3)}, secondBattery);
  assert.equal(scene.data.pvBattery2,20);
  assert.equal(scene.data.pvBattery2Input1,400);
  assert.equal(scene.data.pvBattery2Input2,500);
  assert.equal(scene.data.pvBattery2Total,900);
  assert.equal(scene.data.batteryPower,30);
  assert.equal(scene.data.battery2Power,200);
  assert.equal(scene.data.batterySoc,40);
  assert.equal(scene.data.battery2Soc,75);
  assert.equal(scene.data.batteryCapacity,2);
  assert.equal(scene.data.battery2Capacity,3.5);
  assert.equal(text['battery-2-pv-day'],'5,00 kWh');
  assert.equal(text['battery-2-charged-today'],'6,00 kWh');
  assert.equal(text['battery-2-discharged-today'],'4,00 kWh');
  assert.equal(text['inverter-input-day'],'11,00 kWh');
  assert.match(card.shadowRoot.innerHTML,/aria-label="Batterien"/);
});

test('second battery missing values remain unknown, capacity falls back to clamped SOC', () => {
  const {scene,text} = makeCard({secondSoc:150,secondPv1:50,secondPv2:'unavailable',
    secondDay1:kwh(2),secondDay2:'unavailable',d1:kwh(1),d2:kwh(2),d3:kwh(3),dischargeDay:kwh(1)},secondBattery);
  assert.equal(scene.data.battery2Soc,100);
  assert.equal(scene.data.battery2Capacity,8);
  assert.equal(scene.data.battery2Power,null);
  assert.equal(scene.data.pvBattery2Total,null);
  assert.equal(text['battery-2-pv-day'],'–');
  assert.equal(text['inverter-input-day'],'–');
});

test('second battery sensors are required only when enabled and stale readings are ignored', () => {
  assert.throws(() => makeCard({}, {battery_count:2}), /battery_2_to_inverter.*battery_2_soc/);
  assert.throws(() => makeCard({}, {...secondBattery,entities:{...secondBattery.entities,battery_2_pv_inputs:['one']}}), /battery_2_pv_inputs.*mindestens 2/);
  const {scene,text} = makeCard({secondOut:900,secondSoc:80,secondStored:8,secondPv1:300,secondPv2:400,
    secondDischarge:kwh(99),dischargeDay:kwh(1),d1:kwh(1),d2:kwh(2),d3:kwh(3)}, {...secondBattery,battery_count:1});
  for (const field of ['battery2Power','battery2Soc','battery2Capacity','pvBattery2Input1','pvBattery2Input2','pvBattery2Total']) assert.equal(scene.data[field],null);
  assert.equal(text['inverter-input-day'],'7,00 kWh');
});

test('editor preserves second battery configuration while toggling counts and emits usable config', () => {
  const editor = new (registry.get('solar-flow-card-editor'))();
  editor.fireConfigChanged = () => {};
  editor.setConfig(SolarFlowCard.getStubConfig());
  editor.updatePath('battery_count',2);
  editor.updatePath('battery_2_pv_inputs.0','sensor.second_pv_1');
  editor.updatePath('battery_2_pv_inputs.1','sensor.second_pv_2');
  editor.updatePath('battery_2_pv_energy_today.1','sensor.second_day_2');
  editor.updatePath('entities.battery_2_to_inverter','sensor.second_out');
  editor.updatePath('entities.battery_2_soc','sensor.second_soc');
  editor.updatePath('battery_2_capacity_kwh',8);
  editor.updatePath('battery_count',0);
  assert.doesNotMatch(editor.innerHTML,/data-path="(?:entities\.)?battery_2/);
  editor.updatePath('battery_count',2);
  assert.match(editor.innerHTML,/value="sensor.second_pv_2"/);
  assert.match(editor.innerHTML,/data-capacity-2[^>]*value="8"/);
  assert.equal(editor._config.entities.battery_2_pv_energy_today[1],'sensor.second_day_2');
  new SolarFlowCard().setConfig(editor._config);
});

test('second capacity input accepts a decimal comma independently of first capacity', () => {
  const editor = new (registry.get('solar-flow-card-editor'))();
  const capacity = {addEventListener(_type, handler) {this.change = handler;}};
  editor.querySelector = selector => selector === 'input[data-capacity-2]' ? capacity : null;
  editor.fireConfigChanged = () => {};
  editor.setConfig({...SolarFlowCard.getStubConfig(), battery_count:2, battery_capacity_kwh:5});
  capacity.change({target:{value:'8,5'}});
  assert.equal(editor._config.battery_2_capacity_kwh,8.5);
  assert.equal(editor._config.battery_capacity_kwh,5);
  capacity.change({target:{value:''}});
  assert.equal(editor._config.battery_2_capacity_kwh,null);
});

test('one battery uses one combined battery-PV tile and shows only its active module', () => {
  const {card, text} = makeCard({bpv1:120, batteryOut:0, soc:50, b1:kwh(2)}, {
    pv_battery_inputs:1, entities:{battery_pv_energy_today:['b1']}
  });
  assert.equal((card.shadowRoot.innerHTML.match(/aria-label="PV Batterie"/g) || []).length, 1);
  assert.match(card.shadowRoot.innerHTML, /PV 1<\/span><b data-value="battery-pv-1">–<\/b>/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /battery-pv-2/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /B2 PV/);
  assert.match(card.shadowRoot.innerHTML, /Erzeugung jetzt/);
  assert.equal(text['battery-pv-total'], '120 W');
  assert.equal(text['battery-pv-day'], '2,00 kWh');
});

test('two batteries combine live PV power, show grouped active modules and keep daily totals per battery', () => {
  const {card, text} = makeCard({bpv1:100, secondPv1:200, secondOut:0, secondSoc:50, b1:kwh(2), secondDay1:kwh(3)}, {
    battery_count:2, pv_battery_inputs:1, pv_battery_2_inputs:1,
    entities:{battery_pv_energy_today:['b1'], battery_2_pv_energy_today:['secondDay1'],
      battery_2_pv_inputs:['secondPv1'], battery_2_to_inverter:'secondOut', battery_2_soc:'secondSoc'}
  });
  assert.equal((card.shadowRoot.innerHTML.match(/aria-label="PV Batterie"/g) || []).length, 1);
  assert.match(card.shadowRoot.innerHTML, /PV 1<\/span><b data-value="battery-pv-1">–<\/b>/);
  assert.match(card.shadowRoot.innerHTML, /PV 1<\/span><b data-value="battery-2-pv-1">–<\/b>/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /battery-pv-2|battery-2-pv-2/);
  assert.match(card.shadowRoot.innerHTML, /Ertrag heute<\/span><b data-value="battery-pv-day"/);
  assert.match(card.shadowRoot.innerHTML, /Ertrag heute<\/span><b data-value="battery-2-pv-day"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /Modul 1|Modul 2/);
  assert.equal(text['battery-pv-total'], '300 W');
  assert.equal(text['battery-pv-day'], '2,00 kWh');
  assert.equal(text['battery-2-pv-day'], '3,00 kWh');
});

test('two batteries use one status tile while retaining each output, state, capacity and daily value', () => {
  const {card, text} = makeCard({batteryOut:100, soc:40, stored:2, chargeDay:kwh(3), dischargeDay:kwh(1),
    secondOut:200, secondSoc:75, secondStored:6, secondCharge:kwh(4), secondDischarge:kwh(2)}, {
    battery_count:2, battery_capacity_kwh:5, battery_2_capacity_kwh:8,
    entities:{battery_2_pv_inputs:['secondPv1', 'secondPv2'], battery_2_to_inverter:'secondOut',
      battery_2_soc:'secondSoc', battery_2_energy:'secondStored', battery_2_charge_energy_today:'secondCharge',
      battery_2_discharge_energy_today:'secondDischarge'}
  });
  assert.equal((card.shadowRoot.innerHTML.match(/aria-label="Batterien"/g) || []).length, 1);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /aria-label="Batterie 1"|aria-label="Batterie 2"/);
  for (const value of ['battery-out', 'soc', 'battery-stored', 'battery-capacity', 'battery-2-out', 'battery-2-soc', 'battery-2-stored', 'battery-2-capacity']) {
    assert.match(card.shadowRoot.innerHTML, new RegExp(`data-value="${value}"`));
  }
  assert.equal(text['battery-out-total'], '300 W');
  assert.equal(text['battery-charged-today'], '3,00 kWh');
  assert.equal(text['battery-discharged-today'], '1,00 kWh');
  assert.equal(text['battery-2-charged-today'], '4,00 kWh');
  assert.equal(text['battery-2-discharged-today'], '2,00 kWh');
});
