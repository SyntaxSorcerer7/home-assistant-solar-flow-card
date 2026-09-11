# UX-Konzept V3: Solar Energy Flow

Status: als Version 3.0.0 implementiert  
Home-Assistant-Kartentyp: `custom:solar-flow-card`  
Grafik: `<solar-energy-flow>`  
Stand: 7. September 2026

## Ziel und Zuständigkeit

Die mitgelieferte Webcomponent aus `solar-energy-flow-component/solar-energy-flow.js` übernimmt die gesamte Hausgrafik mit Dachmodulen, Räumen, Wechselrichter, Batterie, Netz und Leitungen. Die frühere eigene SVG-Hausdarstellung entfällt vollständig. Die mitgelieferte Demo beschreibt die visuelle Gestaltung; alle dargestellten Werte sind synthetische Beispiele.

Die Lovelace-Card ist der Adapter zwischen Home Assistant und der Webcomponent. Sie liest Sensoren, normalisiert Einheiten, berechnet fehlende abgeleitete Werte und übergibt bei jeder Aktualisierung einen vollständigen Datensatz über `scene.data`. Die Grafik besitzt ihren eigenen Shadow DOM; die Card greift nicht auf dessen interne Elemente zu.

Header, Live-Indikator, sechs Übersichtskarten, aufklappbare Tageswerte und visueller Konfigurationseditor bleiben bestehen. Der Live-Indikator ist weiterhin eine statische Beschriftung, keine Prüfung der Sensoraktualität.

## Darstellung

Die neue Komponente bestimmt Geometrie, Räume, Geräte und Leitungsverläufe. Drei orange PV-Module führen zum Wechselrichter, zwei grüne Module zur Batterie. Der Batterieausgang verläuft türkis zum Wechselrichter. Violett kennzeichnet Wechselrichterleistung und Einspeisung, Blau den Netzbezug, Rot den Hausverbrauch. Die bisherigen V2-Vorgaben für zusätzliche blaue Leitungen gelten nicht mehr.

Leistungswerte stehen an den Modulen und Flüssen. Hausleistung und Autarkie stehen im Haus. Der Ladestand wird numerisch und als dynamischer Füllstand am Batteriesymbol angezeigt. Darunter steht die aktuell gespeicherte Energie in kWh. Übersichtskarten ergänzen insbesondere den PV-/Wechselrichteranteil und Netzanteil des Hausverbrauchs. Der als „PV“ beschriftete Anteil kann auch Energie aus dem Batteriespeicher enthalten.

Die Grafik skaliert auf die Kartenbreite ohne eine zweite, selbst gezeichnete Mobilansicht. Auf schmalen Karten helfen die separaten numerischen Übersichtskarten beim Ablesen. Container-Abfragen passen deren Raster an die tatsächliche Kartenbreite an. Alle Tageswerte bleiben über „Tageswerte und Details“ erreichbar.

Die Komponente verwendet eine helle Illustrationsfläche, auch bei dunklem Home-Assistant-Theme. Die umliegenden Karten folgen dem HA-Theme. CSS-Farbvariablen der Komponente sind in deren README dokumentiert. Messwerte sind DOM-Text, die Grafik besitzt eine zugängliche Beschreibung. Es gibt keine nur per Tooltip oder Klick auf die Grafik erreichbaren Werte.

## Datenvertrag

Alle Leistungswerte werden als Zahlen in Watt übergeben, Prozentwerte als Zahlen von 0 bis 100. Unbekannte Werte sind explizit `null`, niemals Demo-Zahlen oder ersatzweise null Watt. Die Komponente zeigt sie als `–`. Auch vor dem ersten Home-Assistant-Update sind die Standardwerte unbekannt. Formatierung erfolgt mit HA-Sprache und konfigurierten Leistungsdezimalstellen; kW-Werte behalten zwei Dezimalstellen.

| Webcomponent-Feld | Quelle bzw. Berechnung |
|---|---|
| `pvDirect1..3` | `entities.pv_inputs[0..2]` |
| `pvDirectTotal` | Summe der drei direkten PV-Leistungen, nur wenn alle bekannt sind |
| `pvBattery1..2` | `entities.battery_pv_inputs[0..1]` |
| `pvBatteryTotal` | Summe der beiden Batterie-PV-Leistungen, nur wenn beide bekannt sind |
| `inverterPower` | `entities.inverter_output` |
| `batteryPower` | `entities.battery_to_inverter`; Ausgang zum Wechselrichter, keine Nettoladeleistung |
| `batterySoc` | `entities.battery_soc`, begrenzt auf 0–100 |
| `housePower` | gültiger `entities.house_power`, sonst `max(0, Wechselrichter + Netzleistung)` |
| `autarky` | `100 × (1 − Netzbezug / Hausleistung)`, begrenzt auf 0–100 |
| `gridImport` | `max(0, normalisierte Netzleistung)` |
| `gridExport` | `max(0, −normalisierte Netzleistung)` |

`grid_positive_is_import` normalisiert das Vorzeichen: Bezug positiv, Einspeisung negativ. Import und Export sind gegenseitig ausgeschlossen. Fehlt die Netzleistung, bleiben beide Werte und die Autarkie unbekannt. Bei bekannter Hausleistung ≤ 1 W ergibt sich 100 % Autarkie, außer der Bezug ist > 1 W; dann 0 %.

Die Leistungszahlen steuern zugleich die Animation, unabhängig von der lokalisierten Textdarstellung. Nur bekannte Werte > 1 W aktivieren einen Fluss. Inaktive Leitungen bleiben sichtbar. `prefers-reduced-motion` deaktiviert bewegte Pulse vollständig.

## Ergänzende Werte und Berechnungen

Die Übersicht zeigt weiterhin beide PV-Gruppen und alle fünf Einzelwerte, Wechselrichter, Batterieausgang und SoC, Hausverbrauch und Autarkie sowie getrennten Bezug und Export. Der Hausanteil des Wechselrichters beträgt `min(Hausverbrauch, max(0, Wechselrichter))`; der Netzanteil entspricht dem Netzbezug.

Die Detailkarten enthalten alle fünf PV-Tageserträge, Solarenergie heute, Batterieenergie und Kapazität, heute geladen/entladen sowie Hausverbrauch, Bezug und Einspeisung heute. Nicht konfigurierte oder nicht verfügbare Tageswerte erscheinen als `–`.

Eine gültige `battery_energy` hat Vorrang. Andernfalls berechnet die Card bei positiver `battery_capacity_kwh` und bekanntem SoC die gespeicherte Energie als `Kapazität × SoC / 100`.

Ohne `house_energy_today` bleibt aus Kompatibilitätsgründen die bisherige Tagesbilanz erhalten:

```text
Hausverbrauch heute = max(0, Solarenergie heute + Netzbezug heute − Einspeisung heute)
```

Sie wird ausdrücklich als „berechnet“ beschriftet. Alle drei Tageswerte müssen bekannt sein. Diese Bilanz ist bei PV-Erzeugung vor dem Speicher nur eine Näherung: Speicheränderung und Verluste sind nicht enthalten. Ein eigener Hausenergiezähler ist genauer. Die Card integriert keine Momentanleistung im Browser zu Tagesenergie; dafür werden Home-Assistant-Integral- und Tageszähler verwendet.

## Konfiguration und HACS-Paket

Bestehende YAML-Konfigurationen verwenden weiterhin `custom:solar-flow-card`. Pflichtfelder, optionale Entitäten, Titel, Vorzeichenumschaltung, Kapazität und beide Dezimalstellen-Einstellungen bleiben mit V1/V2 kompatibel. Der Editor bleibt vollständig erhalten. `entities.battery_pv` wird weiterhin ignoriert; die Summe stammt aus den zwei Einzelsensoren. Leistungseinheiten W/kW und Energieeinheiten Wh/kWh werden normalisiert.

Die Quellen sind getrennt:

- `solar-energy-flow-component/solar-energy-flow.js`: mitgelieferte Grafik, ergänzt um unbekannte Standardwerte, Formatierungsoptionen und sichere Animationszustände;
- `src/solar-flow-card.js`: HA-Datenadapter, Übersichtskarten und Editor;
- `scripts/build.mjs`: erzeugt `solar-flow-card.js` und die passende gzip-Datei.

HACS installiert weiterhin nur `solar-flow-card.js`. Diese Datei enthält die vollständige Webcomponent vor dem Adapter, ohne externe Imports, CDN oder weitere Ressourcenregistrierung. Ein Build ist nur nach Quellcodeänderungen nötig, nicht bei der Installation. Ein Tag `v3.0.0` kann über den vorhandenen Release-Workflow veröffentlicht werden.

## Abnahme

- Der Adapter enthält keine eigene SVG-Hausdarstellung mehr und rendert genau eine `solar-energy-flow`-Instanz.
- Alle 15 Datenfelder werden auch bei unbekannten Werten vollständig übertragen.
- Bestehende Konfiguration, Editor und Tageswerte bleiben verfügbar.
- Summen, Einheiten, Netzvorzeichen, Autarkie, Kapazitätsberechnung und unbekannte Sensorwerte sind automatisiert geprüft.
- Vor der Veröffentlichung werden Paket und gzip-Datei neu gebaut und die Tests ausgeführt.
- Die tatsächliche HACS-Installation und Prüfung mit den produktiven HA-Sensoren erfolgt in Home Assistant.

Mit Dashboard 3.1.0 erhält die Webcomponent zusätzlich `batteryCapacity`: gespeicherte Batterieenergie in kWh, aus Sensor oder Ladestand × Gesamtkapazität; bei fehlender Grundlage `null`.
