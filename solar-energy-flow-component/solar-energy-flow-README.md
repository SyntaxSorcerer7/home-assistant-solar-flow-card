# Solar Energy Flow Web Component

## Einbindung

```html
<script src="./solar-energy-flow.js"></script>
<solar-energy-flow id="solarFlow"></solar-energy-flow>
```

## Initiale Werte übergeben

```html
<script>
  const solarFlow = document.querySelector('#solarFlow');
  solarFlow.data = {
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
    housePower: 798,
    autarky: 100,
    gridImport: 0,
    gridExport: 745
  };
</script>
```

Numerische Leistungswerte werden als **Watt** interpretiert und automatisch als W/kW formatiert. Strings wie `"1,54 kW"` werden unverändert angezeigt.

## Live aktualisieren

```js
solarFlow.update({
  inverterPower: 1620,
  housePower: 830,
  gridExport: 790
});
```

`update()` ändert nur die übergebenen Felder. `data = {...}` setzt den kompletten Datensatz neu (fehlende Felder fallen auf `null` (Anzeige `–`) zurück).

## Alternativ direkt über HTML-Attribute

```html
<solar-energy-flow
  inverter-power="1540"
  house-power="798"
  battery-soc="99"
  grid-import="0"
  grid-export="745">
</solar-energy-flow>
```

Verfügbare Attribute: `pv-direct-total`, `pv-direct-1`, `pv-direct-2`, `pv-direct-3`, `pv-battery-total`, `pv-battery-1`, `pv-battery-2`, `inverter-power`, `battery-power`, `battery-soc`, `house-power`, `autarky`, `grid-import`, `grid-export`.

## Styling

Die Hauptfarben lassen sich über CSS Custom Properties am Element überschreiben:

```css
solar-energy-flow {
  --solar-orange: #ff8a00;
  --solar-green: #41c45a;
  --solar-purple: #9b5de5;
  --solar-blue: #1786ff;
  --solar-red: #ef5a45;
  --solar-battery: #14b8a6;
}
```


## Home-Assistant-V3-Anpassungen

Standardwerte sind `null`, damit keine Demo-Leistungen im Dashboard erscheinen.
Unbekannte Werte sowie Leistungen ≤ 1 W erzeugen keine bewegten Pulse.
Bei `prefers-reduced-motion` werden Animationen deaktiviert.
Die optionalen Properties `locale` (z. B. `de-DE`) und `powerDecimals` (0–3)
werden vor `data` gesetzt; sie steuern Zahlenformat und W-Dezimalstellen.
Für eine verlässliche Flusssteuerung numerische Wattwerte oder `null` übergeben.
Die Beispielwerte oben müssen für eine Demo ausdrücklich gesetzt werden.
