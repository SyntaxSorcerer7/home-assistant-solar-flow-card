# UX-Konzept: Solar Energy Flow 3.3.0

Stand: 16. September 2026. Home-Assistant-Kartentyp: `custom:solar-flow-card`.

## Zuständigkeit und Darstellung

Die Webcomponent `solar-energy-flow-component/solar-energy-flow.js` aus dem gelieferten
V3-Paket zeichnet Haus, PV-Module, Wechselrichter, Speicher, Netz und Leitungen.
Der Adapter in `src/solar-flow-card.js` normalisiert Sensorwerte und übergibt einen
vollständigen Datensatz über `scene.data`. Die Card greift nicht auf interne SVG-Elemente zu.

Orange zeigt 1–4 direkte PV-Eingänge, Grün 1–2 PV-Platten am Speicher. Der optionale
Speicher ist über einen türkisen Ausgang mit dem Wechselrichter verbunden. Ohne
Batterie entfällt der gesamte Speicherzweig. Violett zeigt Wechselrichterleistung
und Einspeisung, Blau Netzbezug. Die Grafik bleibt auch im Dark Mode hell; die
umgebenden Kacheln folgen dem Home-Assistant-Theme.

Vier Kacheln (Haus, Netz, direkte PV, Wechselrichter) bleiben immer sichtbar.
Bei einer Batterie kommen Speicher-PV und Batterie hinzu. Live- und Tageswerte sind
in diesen Kacheln gemeinsam sichtbar. Ab 1100 px Kartenbreite stehen sie rechts
neben der Grafik, darunter unter der Grafik. Der Live-Indikator ist eine statische
Beschriftung, keine Prüfung der Sensoraktualität.

## Konfiguration und Datenvertrag

| Konfiguration | Werte | Standard | Grafikfeld |
|---|---|---|---|
| `pv_direct_inputs` | ganze Zahl 1–4 | 3 | `pvDirectInputs` |
| `battery_count` | ganze Zahl 0–1 | 1 | `batteryCount` |
| `pv_battery_inputs` | ganze Zahl 1–2 | 2 | `pvBatteryInputs` |

Der visuelle Editor zeigt nur passende Leistungs- und Tagesenergie-Picker. Beim
Vergrößern einer Gruppe werden leere Sensorplätze ergänzt; beim Verkleinern bleiben
Zuordnungen für eine spätere Reaktivierung erhalten. Nur aktive Plätze werden
berechnet. Mit 0 Batterien werden keine Batterie-Entities verlangt. Die Grenzen
entsprechen der gelieferten Grafik; mehrere Batterien werden nicht unterstützt.

| Grafikfeld | Quelle bzw. Berechnung |
|---|---|
| `pvDirect1..4` | aktive `entities.pv_inputs`, inaktive Plätze `null` |
| `pvDirectTotal` | vollständige Summe aktiver direkter PV-Leistungen |
| `pvBattery1..2` | aktive `entities.battery_pv_inputs`, inaktive Plätze `null` |
| `pvBatteryTotal` | vollständige Summe aktiver Speicher-PV-Leistungen; ohne Speicher 0, verborgen |
| `inverterPower` | `entities.inverter_output` |
| `batteryPower` | `entities.battery_to_inverter`, Ausgang zum Wechselrichter |
| `batterySoc` | `entities.battery_soc`, auf 0–100 begrenzt |
| `batteryCapacity` | gespeicherte kWh aus `battery_energy`, sonst Kapazität × SoC / 100 |
| `housePower` | gültiger `house_power`, sonst max(0, Wechselrichter + saldierte Netzleistung) |
| `autarky` | 100 × (1 − Netzbezug / Hausleistung), auf 0–100 begrenzt |
| `gridImport` / `gridExport` | positive / negative normalisierte Netzleistung, jeweils mindestens 0 |

Leistung wird in Watt, Energie in kWh übergeben; W/kW und Wh/kWh werden automatisch
normalisiert. Unbekannte Werte sind `null` und erscheinen als `–`. Sie aktivieren
keine Animation. Der Pfeil zum Haus zeigt max(0, Wechselrichter − Einspeisung).
`grid_positive_is_import` normalisiert das Netzzähler-Vorzeichen. Import und Export
sind gegenseitig ausgeschlossen. Ohne Netzleistung bleibt die Autarkie unbekannt.
Bei Hausleistung ≤ 1 W ergibt sich 100 %, außer bei Bezug > 1 W (dann 0 %).

## Tageswerte

PV-Tageswerte verwenden nur aktive Einzelzähler; bei fehlenden Messwerten bleibt
die jeweilige Summe unbekannt. Wechselrichter-Eingangsenergie ist die direkte
PV-Energie plus Batterieentladung; ohne Batterie ist kein Entladezähler nötig.
Die AC-Ausgangsenergie wird separat angezeigt.

Bei fehlenden Speicher-PV-Tageszählern dient der Ladezähler als Gruppensumme, sofern
nur diese PV-Platten die Batterie laden. Umgekehrt kann die vollständige
Speicher-PV-Summe den fehlenden Ladezähler ersetzen. Diese schematische Annahme
berücksichtigt keine Ladeverluste; Einzelwerte werden nicht geschätzt.

Ein gültiger `house_energy_today` hat Vorrang. Sonst gilt:

```text
Hausverbrauch heute = max(0, inverter_energy_today + Netzbezug − Einspeisung)
Selbst gedeckt = max(0, Hausverbrauch − Netzbezug)
Tagesautarkie = Selbst gedeckt / Hausverbrauch × 100
```

Alle benötigten Zähler müssen verfügbar sein. Ohne Verbrauch bleibt die Tagesautarkie
unbekannt. Ein DC-Solar-Gesamtzähler ersetzt keine AC-Messung. Die Card integriert
keine Momentanleistung; dafür werden Home-Assistant-Integral- und Tageszähler verwendet.

## Paket und Abnahme

`node scripts/build.mjs` erzeugt die eigenständige `solar-flow-card.js` und ihre
gzip-Version. HACS benötigt keine weiteren Ressourcen. Bestehende Konfigurationen
behalten ohne neue Einstellungen 3 direkte Eingänge, 1 Batterie und 2 Speicher-PV-Platten.

`node --test tests/*.test.mjs` prüft alle Anlagenaufteilungen, dynamische Editorfelder,
Erhalt ausgeblendeter Zuordnungen, Validierung, Summen, Einheiten, Netzvorzeichen,
Autarkie und Batterieinhalt sowie die Übereinstimmung von Bundle und gzip-Datei.
Die produktive Home-Assistant-/HACS-Installation wird separat im Zielsystem geprüft.
