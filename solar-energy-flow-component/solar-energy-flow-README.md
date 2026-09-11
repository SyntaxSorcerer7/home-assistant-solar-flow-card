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

Alle folgenden Zahlen sind synthetische Demonstrationsdaten.

## Werte setzen

Numerische Leistungswerte werden als Watt interpretiert und automatisch als W oder kW formatiert.
`batteryCapacity` wird als kWh interpretiert.

```js
const flow = document.querySelector("#solarFlow");

flow.data = {
  pvDirect1: 200,
  pvDirect2: 300,
  pvDirect3: 400,
  pvDirectTotal: 900,

  pvBattery1: 100,
  pvBattery2: 200,
  pvBatteryTotal: 300,

  inverterPower: 1000,

  batteryPower: 200,
  batterySoc: 60,
  batteryCapacity: 3.0,

  housePower: 800,
  autarky: 100,

  gridImport: 0,
  gridExport: 200
};
```

Damit wird zum Beispiel:

- `inverterPower: 1000` → `1,00 kW`
- `batterySoc: 60` → `60%`
- `batteryCapacity: 3.0` → `3,00 kWh`

## Live-Updates

Nur geänderte Werte müssen aktualisiert werden:

```js
flow.update({
  inverterPower: 1200,
  housePower: 1000,
  batterySoc: 70,
  batteryCapacity: 3.5
});
```

## HTML-Attribute

Die wichtigsten Werte können auch als Attribute übergeben werden:

```html
<solar-energy-flow
  inverter-power="1000"
  battery-power="200"
  battery-soc="60"
  battery-capacity="3.0"
  house-power="800"
  autarky="100"
  grid-import="0"
  grid-export="200">
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
