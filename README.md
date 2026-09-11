# Solar Flow Card für Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Eine responsive Lovelace-Card für ein festes, schematisches Anlagenlayout. Version 3.2.1 kombiniert die
Webcomponent `<solar-energy-flow>` mit kompakten Anlagenkacheln und integrierten Tageswerten. Live-Leistungen, Tageswerte und Details stehen gemeinsam in sechs Anlagenkacheln;
der visuelle Editor bleibt erhalten; Konfigurationen aus V1/V2 funktionieren weiter.

Das hauszentrierte Redesign ist im [UX-Konzept](docs/UX-KONZEPT.md) mit Webcomponent-Datenvertrag, Berechnungen und Paketaufbau dokumentiert.

- drei konfigurierbare PV-Eingänge direkt am Wechselrichter
- zwei konfigurierbare PV-Module am Batterieeingang
- Batterieausgang am vierten Wechselrichter-Eingang
- saldierender Netzbezug / Einspeisung über bidirektionalen Netzzähler
- aktuelle Leistungswerte direkt auf allen Flusspfeilen
- fünf einzeln konfigurierbare PV-Tageserträge
- Selbstversorgung aus PV und Batterie, Netzbezug und Tagesautarkie direkt in der Hauskarte
- Tageswerte direkt in den zugehörigen Anlagenkarten
- Live-Autarkie, Batterieladestand sowie Lade- und Entladeenergie der Batterie heute

Die Card ist eine einzelne JavaScript-Datei und benötigt weder HACS noch einen Build-Schritt.

## Installation über HACS

1. In HACS **Frontend** öffnen.
2. Über das Drei-Punkte-Menü **Benutzerdefinierte Repositories** wählen.
3. `https://github.com/SyntaxSorcerer7/home-assistant-solar-flow-card` als Typ **Dashboard** hinzufügen.
4. **Solar Flow Card** installieren und Home Assistant neu laden.

HACS registriert die JavaScript-Ressource automatisch. Danach kann die Card im Dashboard über **Card hinzufügen → Solar Flow Card** eingefügt und vollständig über die Oberfläche konfiguriert werden.

Unter **Einstellungen → Dashboards → Ressourcen** muss die Datei als JavaScript-Modul
unter `/hacsfiles/home-assistant-solar-flow-card/solar-flow-card.js` eingebunden sein.
Bei manuell verwalteten YAML-Ressourcen lautet der Eintrag:

```yaml
resources:
  - url: /hacsfiles/home-assistant-solar-flow-card/solar-flow-card.js
    type: module
```

Die Webcomponent ist im Paket enthalten und benötigt keinen weiteren Ressourceneintrag.
Bei einem manuellen Austausch der HACS-Datei auch die danebenliegende `.gz`-Datei
aktualisieren oder entfernen, da HACS sonst die alte komprimierte Version ausliefert
([HACS-Dokumentation](https://www.hacs.xyz/docs/use/repositories/type/dashboard/)).

## Manuelle Installation

1. `solar-flow-card.js` nach `/config/www/solar-flow-card.js` kopieren.
2. In Home Assistant unter **Einstellungen → Dashboards → Ressourcen** hinzufügen:
   - URL: `/local/solar-flow-card.js?v=3.2.1`
   - Typ: `JavaScript-Modul`
3. Browser neu laden, im Dashboard **Card hinzufügen** wählen und nach **Solar Flow Card** suchen.

Alle Entity-IDs, das Vorzeichen der Netzleistung, der Titel und die Dezimalstellen lassen sich danach direkt im visuellen Card-Editor auswählen. Die drei PV-Eingänge haben jeweils einen eigenen Entity-Picker. Die YAML-Konfiguration unten ist nur noch eine alternative Möglichkeit und eine Referenz.

```yaml
type: custom:solar-flow-card
title: Unsere Solaranlage
grid_positive_is_import: true
battery_capacity_kwh: 5.00
entities:
  pv_inputs:
    - sensor.inverter_input_1_power
    - sensor.inverter_input_2_power
    - sensor.inverter_input_3_power
  battery_pv_inputs:
    - sensor.example_battery_input_1_power
    - sensor.example_battery_input_2_power
  pv_energy_today:
    - sensor.inverter_input_1_energy_today
    - sensor.inverter_input_2_energy_today
    - sensor.inverter_input_3_energy_today
  battery_pv_energy_today:
    - sensor.example_battery_pv_1_energy_today
    - sensor.example_battery_pv_2_energy_today
  battery_to_inverter: sensor.inverter_input_4_power
  inverter_output: sensor.inverter_output_power
  grid_power: sensor.example_grid_power
  battery_soc: sensor.example_battery_state_of_charge
  battery_energy: sensor.example_battery_stored_energy
  battery_charge_energy_today: sensor.battery_charge_energy_today
  battery_discharge_energy_today: sensor.battery_discharge_energy_today
  # Optional: Ohne diesen Sensor wird Hausleistung = Wechselrichter + Netzleistung gerechnet.
  house_power: sensor.house_total_power
  inverter_energy_today: sensor.inverter_ac_energy_today
  grid_import_energy_today: sensor.grid_import_energy_today
  grid_export_energy_today: sensor.grid_export_energy_today
  house_energy_today: sensor.house_energy_today
```

`grid_positive_is_import: true` bedeutet: positive Netzzähler-Leistung ist Netzbezug, negative Leistung ist Einspeisung. Falls das Zusatzskript das umgekehrt liefert, auf `false` setzen.

Ohne verfügbaren `house_energy_today`-Messwert berechnet die Card den Tagesverbrauch aus `inverter_energy_today + Netzbezug − Einspeisung`. Dafür muss `inverter_energy_today` die tatsächliche AC-Ausgangsenergie des Wechselrichters zählen. Der alte Solar-Gesamtzähler wird nicht mehr als Ersatz verwendet, da er bei einer Batterie eine falsche Hausbilanz ergeben kann.

Alle Entity-IDs und Werte in den Beispielen sind Platzhalter beziehungsweise synthetische Demonstrationsdaten. Die feste Grafik beschreibt das unterstützte Layout und keinen realen Haushalt.

## Bedeutung der Messwerte

| Card-Feld | Erwarteter Sensor | Einheit |
|---|---|---|
| `pv_inputs` | Leistung an Eingang 1–3 | W |
| `battery_pv_inputs` | Leistung der zwei Batterie-PV-Module, einzeln | W |
| `pv_energy_today` | Tagesertrag der drei direkten PV-Module, einzeln | Wh oder kWh |
| `battery_pv_energy_today` | Tagesertrag der beiden Batterie-PV-Module, einzeln | Wh oder kWh |
| `battery_to_inverter` | Batterie-Ausgang / Inverter-Eingang 4 | W |
| `inverter_output` | AC-Ausgangsleistung des Wechselrichters | W |
| `inverter_energy_today` | AC-Ausgangsenergie heute, optional für die Haus-Tagesbilanz | Wh oder kWh |
| `grid_power` | saldierte Netzleistung | W |
| `battery_soc` | Ladezustand | % |
| `battery_energy` | aktuell gespeicherte Batterieenergie (optional); wird im visuellen Editor ausgewählt | Wh oder kWh |
| `battery_capacity_kwh` | feste Gesamtkapazität; wird im visuellen Editor eingetragen | kWh |
| `battery_charge_energy_today` | heute insgesamt in die Batterie geladene Energie (optional) | Wh oder kWh |
| `battery_discharge_energy_today` | heute insgesamt aus der Batterie entladene Energie (optional) | Wh oder kWh |
| `house_power` | aktueller Hausverbrauch (optional) | W |
| Tageswerte | seit Mitternacht gezählte Energie | kWh |

Leistungssensoren dürfen `W` oder `kW`, Energiesensoren `Wh` oder `kWh` liefern; die Card rechnet diese Einheiten automatisch um.

Die Live-Autarkie wird als `100 × (1 − Netzbezug / Hausverbrauch)` berechnet und auf 0–100 % begrenzt. Bei Einspeisung beträgt sie 100 %. Ist `house_power` nicht gesetzt, berechnet die Card den Hausverbrauch als `Wechselrichterleistung + saldierte Netzleistung`.

Konkret: Bei 200 W Wechselrichterleistung und 100 W Netzbezug beträgt der
Hausverbrauch 300 W; bei 100 W Einspeisung beträgt er 100 W. Beide Netzpfeile
bleiben sichtbar: Nur die aktive Richtung zeigt einen Wert größer als 0 W,
die Gegenrichtung zeigt 0 W. Bei ausgeglichenem Netzanschluss zeigen beide 0 W.
Fehlt ein erforderlicher Messwert, erscheint `–`. Ein gültiger optionaler
`house_power`-Sensor hat Vorrang; ist er nicht verfügbar, greift dieselbe Berechnung.

## Tageswerte in Home Assistant erzeugen

Wenn die Geräte bereits **fortlaufende Energiezähler in kWh** bereitstellen, können daraus mit `utility_meter` Tageszähler entstehen. Das Beispiel enthält zusätzlich einen optionalen Gesamtzähler aller fünf Solarquellen; für die Kacheln werden die einzelnen PV-Tageszähler benötigt. Entity-IDs bitte an die echten Sensoren anpassen:

```yaml
template:
  - sensor:
      - name: Solar Energy Total
        unique_id: solar_energy_total
        unit_of_measurement: kWh
        device_class: energy
        state_class: total_increasing
        state: >-
          {{ states('sensor.inverter_input_1_energy')|float(0)
           + states('sensor.inverter_input_2_energy')|float(0)
           + states('sensor.inverter_input_3_energy')|float(0)
           + states('sensor.example_pv_1_energy')|float(0)
           + states('sensor.example_pv_2_energy')|float(0) }}

utility_meter:
  inverter_ac_energy_today:
    source: sensor.inverter_ac_energy_total
    cycle: daily
  solar_energy_today:
    source: sensor.solar_energy_total
    cycle: daily
  grid_import_energy_today:
    source: sensor.example_grid_import_total
    cycle: daily
  grid_export_energy_today:
    source: sensor.example_grid_export_total
    cycle: daily
  house_energy_today:
    source: sensor.house_energy_total
    cycle: daily
  battery_charge_energy_today:
    source: sensor.battery_charge_energy_total
    cycle: daily
  battery_discharge_energy_today:
    source: sensor.battery_discharge_energy_total
    cycle: daily
```

Für den optionalen Gesamtzähler gilt: Die Solar-Tagesenergie muss die Energie der drei direkten Eingänge **plus** die Energie der zwei Batterie-PV-Module zählen. Nicht stattdessen Batterieausgang und Batterie-PV gemeinsam addieren, da dieselbe Energie dadurch doppelt gezählt würde.

Falls nur Leistungssensoren in Watt existieren, zuerst je Quelle den Home-Assistant-Helfer **Integral (Riemann-Summe)** mit Zeiteinheit Stunden und Präfix `k` anlegen. Die daraus entstehenden kWh-Sensoren können anschließend als Quellen der Tageszähler dienen.

## Hinweise zur Energiebilanz

Der Tageswert für den Hausverbrauch kommt bevorzugt von einem eigenen Verbrauchs-/Energiezähler. Alternativ verwendet die Card die gemessene AC-Ausgangsenergie des Wechselrichters plus Netzbezug minus Einspeisung. Die Summe der DC-Eingänge ist wegen der Umwandlungsverluste kein Ersatz für die AC-Messung.


## V3 aktualisieren und entwickeln

HACS benötigt weiterhin ausschließlich `solar-flow-card.js`; die neue Webcomponent
ist darin enthalten. Keine zusätzliche Lovelace-Ressource registrieren. Nach dem
Update Browser-/Frontend-Cache neu laden. Die Installationsdatei und ihre gzip-Version
werden gemeinsam aus den Quellen erzeugt:

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
```

Die Grafikquelle liegt unter `solar-energy-flow-component/solar-energy-flow.js`,
der Home-Assistant-Adapter unter `src/solar-flow-card.js`. Die Datei im Hauptverzeichnis
ist das fertige V3-HACS-Paket. Bei einem Release-Tag baut und prüft der Workflow das Paket.

Fehlende Messwerte erscheinen auch in der Grafik als `–` und aktivieren keine
Animation. PV-Summen, Hausleistung, Autarkie und gespeicherte Batterieenergie werden
bei vorhandenen Grundlagen berechnet. Leistungswerte bleiben für Animationen numerisch.
Die neue Illustration verwendet auch im Dark Mode eine helle Fläche; die Karten außen
folgen dem Home-Assistant-Theme.

### Neue Dashboard-Grafik (3.1.0)

Die aktualisierte Grafik enthält einen dynamischen Batteriefüllstand und stärkere
Flussanimationen. Die kWh-Anzeige unter der Batterie zeigt die gespeicherte Energie
aus `battery_energy`, ersatzweise aus Ladestand × `battery_capacity_kwh`.
Hausberechnung, optionaler Haussensor und beide Netzpfeile bleiben erhalten.

### Korrektur 3.1.1

Der Pfeil vom Wechselrichter zum Haus zeigt die AC-Ausgangsleistung abzüglich
der Netzzähler-Einspeisung, mindestens 0 W. Am Wechselrichter selbst steht weiterhin
die gesamte AC-Ausgangsleistung. Bei vollständiger Einspeisung stoppt der Puls
zum Haus; bei fehlenden Messwerten erscheint `–`.

### Gemeinsame Anlagenkacheln

Alle sechs Kacheln zeigen die aktuelle Leistung und die zugehörigen Tageswerte ohne Aufklappen.
Ab 1100 px **Kartenbreite** stehen die kompakten Kacheln rechts in zwei Spalten neben der Grafik. Jede Kachel ist höchstens ein Fünftel der Kartenbreite breit. Die Ansicht richtet sich nach der verfügbaren Bildschirmhöhe; bei besonders geringer Höhe scrollt nur der Kachelbereich. Darunter stehen die Kacheln in drei beziehungsweise zwei Spalten unter der Grafik; unter 380 px in einer Spalte.

- **Haus:** Verbrauch, Netzbezug, selbst gedeckte Energie (`Verbrauch − Netzbezug`, mindestens null) und Tagesautarkie (`selbst gedeckt / Verbrauch × 100`). PV und Batterie zählen gemeinsam zur Selbstversorgung. Ohne Verbrauch seit Mitternacht bleibt die Tagesautarkie `–`.
- **Netz:** Bezug und Einspeisung heute getrennt.
- **3× PV direkt:** Summe der drei `pv_energy_today`-Zähler plus Einzelwerte.
- **2× PV Batterie:** Summe der zwei `battery_pv_energy_today`-Zähler plus Einzelwerte. Sind keine Modul-Tageszähler konfiguriert, dient `battery_charge_energy_today` als Gesamtwert für ein festes, schematisches Anlagenlayout, in dem nur diese Module die Batterie laden. Einzelwerte werden nicht daraus geschätzt.
- **Batterie:** Heute geladen und entladen, dazu Ladestand und gespeicherte Energie. Ohne Ladezähler dient die vollständige Summe der Batterie-PV-Tageszähler als Ladewert für ein festes, schematisches Anlagenlayout.
- **Wechselrichter:** Tagesenergie aller vier Eingänge (drei direkte PV-Eingänge plus Batterieentladung) sowie die separat gemessene AC-Erzeugung. Eingangsenergie und AC-Erzeugung unterscheiden sich durch Verluste.

Die Tagessummen benötigen vollständige Messwerte; fehlende Werte erscheinen als `–`.
Im visuellen Editor lässt sich unter „Tageswerte“ der neue AC-Tageszähler auswählen.
Der bestehende `solar_energy_today`-Eintrag kann in alten Konfigurationen stehen bleiben,
wird jedoch für diese Kacheln und die Hausbilanz nicht mehr verwendet.
