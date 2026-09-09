# Solar Energy Flow Web Component

Wiederverwendbare, dependency-freie Web Component für die Haus-/PV-/Batterie-/Stromnetz-Grafik.

## Dateien

- `solar-energy-flow.js` – die wiederverwendbare Komponente
- `solar-energy-flow-demo.html` – eigenständige Demo, die auch per `file://` funktioniert

## Einbindung

```html
<script src="./solar-energy-flow.js"></script>
<solar-energy-flow id="solarFlow"></solar-energy-flow>
```

## Werte setzen

Numerische Leistungswerte werden als Watt interpretiert und automatisch als W oder kW formatiert.
`batteryCapacity` wird als kWh interpretiert.

```js
const flow = document.querySelector("#solarFlow");

flow.data = {
  pvDirect1: 343,
  pvDirect2: 406,
  pvDirect3: 354,
  pvDirectTotal: 1103,

  pvBattery1: 263,
  pvBattery2: 273,
  pvBatteryTotal: 536,

  inverterPower: 1540,

  batteryPower: 440,
  batterySoc: 99,
  batteryCapacity: 9.9,

  housePower: 798,
  autarky: 100,

  gridImport: 0,
  gridExport: 745
};
```

Damit wird zum Beispiel:

- `inverterPower: 1540` → `1,54 kW`
- `batterySoc: 99` → `99%`
- `batteryCapacity: 9.9` → `9,90 kWh`

## Live-Updates

Nur geänderte Werte müssen aktualisiert werden:

```js
flow.update({
  inverterPower: 1620,
  housePower: 910,
  batterySoc: 87,
  batteryCapacity: 8.6
});
```

## HTML-Attribute

Die wichtigsten Werte können auch als Attribute übergeben werden:

```html
<solar-energy-flow
  inverter-power="1540"
  battery-power="440"
  battery-soc="99"
  battery-capacity="9.9"
  house-power="798"
  autarky="100"
  grid-import="0"
  grid-export="745">
</solar-energy-flow>
```

## Batterieanzeige

Die Batterie verwendet nur noch eine Füllstandsanzeige. Das Batteriesymbol wird entsprechend `batterySoc` von unten nach oben gefüllt. Zusätzlich wird die aktuelle Kapazität über `batteryCapacity` in kWh angezeigt.

## Energiefluss

Die farbigen Energiepfade enthalten animierte Energiepulse. Bei einem Leistungswert von `0 W` wird die zugehörige Pulsanimation automatisch ausgeblendet.

## Home-Assistant-Anpassungen

Fehlende Werte sind `null` und erscheinen als `–`; Demo-Werte werden nicht als
Standard verwendet. `locale` und `powerDecimals` steuern die Formatierung.
Unbekannte Werte und Leistungen ≤ 1 W aktivieren keine Pulse; bei reduzierter
Bewegung sind Animationen deaktiviert. Der Adapter übergibt in `batteryCapacity`
die aktuell gespeicherte Energie in kWh (Sensor oder Ladestand × Gesamtkapazität).
