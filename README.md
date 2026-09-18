# Solar Flow Card für Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Eine responsive Lovelace-Card für ein konfigurierbares, schematisches Anlagenlayout. Version 4.3.0 kombiniert die
Webcomponent `<solar-energy-flow>` mit kompakten Anlagenkacheln und integrierten Tageswerten. Live-Leistungen, Tageswerte und Details stehen gemeinsam in vier bis sechs Anlagenkacheln;
der visuelle Editor bleibt erhalten; Konfigurationen aus V1/V2 funktionieren weiter.

Das hauszentrierte Redesign ist im [UX-Konzept](docs/UX-KONZEPT.md) mit Webcomponent-Datenvertrag, Berechnungen und Paketaufbau dokumentiert.

- ein bis vier konfigurierbare PV-Eingänge direkt am Wechselrichter
- ein bis zwei konfigurierbare PV-Platten am Batterieeingang
- optional bis zu zwei Batterien mit eigenen PV-Eingängen und Ausgängen zum Wechselrichter
- saldierender Netzbezug / Einspeisung über bidirektionalen Netzzähler
- aktuelle Leistungswerte direkt auf allen Flusspfeilen
- einzeln konfigurierbare PV-Tageserträge für alle aktiven Eingänge
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
   - URL: `/local/solar-flow-card.js?v=4.3.0`
   - Typ: `JavaScript-Modul`
3. Browser neu laden, im Dashboard **Card hinzufügen** wählen und nach **Solar Flow Card** suchen.

Alle Entity-IDs, das Vorzeichen der Netzleistung, der Titel und die Dezimalstellen lassen sich danach direkt im visuellen Card-Editor auswählen. Unter **Anlagenaufbau** zuerst die Anzahl direkter PV-Eingänge, Batterien und PV-Platten am Speicher einstellen. Anschließend erscheint für jeden aktiven Eingang ein eigener Entity-Picker für Leistung und Tagesertrag. Die YAML-Konfiguration unten ist nur noch eine alternative Möglichkeit und eine Referenz.

```yaml
type: custom:solar-flow-card
title: Unsere Solaranlage
pv_direct_inputs: 3
battery_count: 1
pv_battery_inputs: 2
grid_positive_is_import: true
battery_capacity_kwh: 5.00
# Optionaler Festpreis für Netzbezug in €/kWh. Alternativ die Preis-Entity unten setzen.
grid_import_price_per_kwh: 0.32
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
  # Optional; überschreibt den Festpreis, z. B. ein Sensor mit €/kWh oder ct/kWh.
  grid_import_price_per_kwh: sensor.electricity_price
  house_energy_today: sensor.house_energy_today
```

`grid_positive_is_import: true` bedeutet: positive Netzzähler-Leistung ist Netzbezug, negative Leistung ist Einspeisung. Falls das Zusatzskript das umgekehrt liefert, auf `false` setzen.

Ohne verfügbaren `house_energy_today`-Messwert berechnet die Card den Tagesverbrauch aus `inverter_energy_today + Netzbezug − Einspeisung`. Dafür muss `inverter_energy_today` die tatsächliche AC-Ausgangsenergie des Wechselrichters zählen. Der alte Solar-Gesamtzähler wird nicht mehr als Ersatz verwendet, da er bei einer Batterie eine falsche Hausbilanz ergeben kann.

Alle Entity-IDs und Werte in den Beispielen sind Platzhalter beziehungsweise synthetische Demonstrationsdaten. Die schematische Grafik beschreibt das konfigurierte Layout und keinen realen Haushalt.

## Version 4.3.0: Batterie-UX

Die Batterie- und PV-Batteriekarten zeigen ihre Werte jetzt je Speicher in klar getrennten Bereichen. Ladezustände
werden als Balken dargestellt; PV-Eingänge sowie Lade- und Entladeenergie bleiben direkt dem jeweiligen Speicher
zugeordnet. Die Darstellung passt sich auch auf schmalen Ansichten ohne horizontales Überlaufen an.

## Korrektur 3.3.1: Eingabefelder im visuellen Editor

Titel, Dezimalstellen, Anlagenaufbau und Batteriekapazität verwenden jetzt native,
beschriftete Eingabefelder. Damit bleiben sie auch dann sichtbar und bedienbar,
wenn Home Assistant das interne Element `ha-textfield` nicht geladen hat.
Nach dem Update auf 3.3.1 das Frontend vollständig neu laden und den Karteneditor
neu öffnen.

## Anlagenaufbau konfigurieren (3.3.0)

Die neue Dashboard-Grafik aus `solar-energy-flow-v3-complete.zip` wird mitgeliefert.
Im visuellen Editor und alternativ in YAML stehen diese numerischen Einstellungen bereit:

| Einstellung | Zulässige Werte | Standard bei bestehenden Konfigurationen |
|---|---|---|
| `pv_direct_inputs` | 1–4 direkte PV-Eingänge | 3 |
| `battery_count` | 0, 1 oder 2 Batterien | 1 |
| `pv_battery_inputs` | 1–2 PV-Platten an Batterie 1 | 2 |
| `pv_battery_2_inputs` | 1–2 PV-Platten an Batterie 2 | 2 |

Die mitgelieferte Grafik unterstützt bis zu **zwei Batterien**. Jede Batterie kann
einen oder zwei eigene PV-Eingänge haben. Mit „Platten“ sind
hier die PV-Module am Speicher gemeint, nicht gestapelte Batteriemodule.
Die vier Einstellungen sind ganze Zahlen, keine Booleans oder Entity-IDs.

`entities.pv_inputs` enthält je aktivem direkten Eingang eine Leistungs-Entity in
Reihenfolge E1 bis E4. `entities.battery_pv_inputs` enthält entsprechend PV 1 bis PV 2.
Die optionalen Listen `pv_energy_today` und `battery_pv_energy_today` verwenden dieselbe
Reihenfolge. Fehlende Tageszähler können als `""` eingetragen oder weggelassen werden;
unvollständige Tagessummen bleiben `–`. Leere Leistungsplätze zeigen ebenfalls `–`.
Für Leistungslisten müssen mindestens so viele Plätze wie aktive Eingänge vorhanden sein.

Beim Ändern der Anzahl fügt der Editor die nötigen Plätze hinzu. Ausgeblendete
Entity-Zuordnungen bleiben gespeichert, werden aber weder angezeigt noch in Summen
einbezogen. Bei `battery_count: 0` sind keine Batterie-Entities erforderlich:
Batterie, Speicher-PV, Leitungen und beide zugehörigen Kacheln verschwinden. Der
Wechselrichter-Eingangstageswert besteht dann ausschließlich aus den direkten PV-Erträgen.
`pv_battery_inputs` wird in diesem Fall nicht angezeigt und hat keine Auswirkung.

Für Batterie 1 bleiben alle bisherigen Schlüssel unverändert. Bei `battery_count: 2`
erscheinen im Editor zusätzliche Felder für Batterie 2. Ihre Leistungs- und
Ladestand-Entities sind Pflicht; Kapazität, gespeicherte Energie und Tageszähler
sind optional. `battery_2_capacity_kwh` steht auf oberster Ebene, alle Sensoren
stehen unter `entities`. Die kWh-Anzeige nutzt `battery_2_energy` oder ersatzweise
Ladestand × Kapazität. Die PV-Erzeugung beider Batterien erscheint in einer gemeinsamen
Kachel „PV am Speicher“ mit der berechneten Gesamtleistung oben. Darunter zeigt jeder
Speicher seine PV-Eingänge und seinen Tagesertrag in einem eigenen Bereich. Die
Batteriekachel fasst die Ausgangsleistung zusammen und zeigt je Speicher einen
Ladebalken, gespeicherte Energie, Ausgangsleistung sowie geladene und entladene
Energie für heute. Ohne konfigurierte Kapazität entfällt die Kapazitätsangabe; bei
unbekanntem Ladestand wird der Ladebalken ausgeblendet.
Der Wechselrichter-Eingangstageswert addiert direkte PV-Erträge und die Entladung
beider aktiver Batterien; fehlt ein benötigter Messwert, bleibt die Summe `–`.

Vollständiges Minimalbeispiel mit zwei Batterien (optionale Werte kommentiert):

```yaml
type: custom:solar-flow-card
battery_count: 2
pv_direct_inputs: 1
pv_battery_inputs: 1
pv_battery_2_inputs: 2
battery_capacity_kwh: 5
battery_2_capacity_kwh: 8
entities:
  pv_inputs:
    - sensor.direct_pv_power
  battery_pv_inputs:
    - sensor.battery_1_pv_power
  battery_to_inverter: sensor.battery_1_output_power
  battery_soc: sensor.battery_1_soc
  battery_2_pv_inputs:
    - sensor.battery_2_pv_1_power
    - sensor.battery_2_pv_2_power
  battery_2_to_inverter: sensor.battery_2_output_power
  battery_2_soc: sensor.battery_2_soc
  inverter_output: sensor.inverter_output_power
  grid_power: sensor.grid_power
  # battery_2_energy: sensor.battery_2_stored_energy
  # battery_2_pv_energy_today:
  #   - sensor.battery_2_pv_1_energy_today
  #   - sensor.battery_2_pv_2_energy_today
  # battery_2_charge_energy_today: sensor.battery_2_charge_energy_today
  # battery_2_discharge_energy_today: sensor.battery_2_discharge_energy_today
```

`battery_2_pv_inputs` gehört ausschließlich zu Batterie 2. Der zweite Eintrag in
`battery_pv_inputs` gehört weiterhin zu Batterie 1. `pv_battery_inputs` und
`pv_battery_2_inputs` steuern die jeweils aktiven PV-Eingänge getrennt.

Beispiel mit vier direkten PV-Eingängen ohne Batterie:

```yaml
type: custom:solar-flow-card
title: PV ohne Speicher
pv_direct_inputs: 4
battery_count: 0
entities:
  pv_inputs:
    - sensor.pv_1_power
    - sensor.pv_2_power
    - sensor.pv_3_power
    - sensor.pv_4_power
  pv_energy_today:
    - sensor.pv_1_energy_today
    - sensor.pv_2_energy_today
    - sensor.pv_3_energy_today
    - sensor.pv_4_energy_today
  inverter_output: sensor.inverter_ac_power
  grid_power: sensor.grid_power
```

Beispiel mit zwei direkten Eingängen und einer PV-Platte am Speicher:

```yaml
type: custom:solar-flow-card
pv_direct_inputs: 2
battery_count: 1
pv_battery_inputs: 1
battery_capacity_kwh: 5
entities:
  pv_inputs:
    - sensor.pv_1_power
    - sensor.pv_2_power
  battery_pv_inputs:
    - sensor.battery_pv_1_power
  battery_to_inverter: sensor.battery_output_power
  battery_soc: sensor.battery_soc
  inverter_output: sensor.inverter_ac_power
  grid_power: sensor.grid_power
```

Bestehende Konfigurationen benötigen keine neuen Einstellungen. Nach dem Update die
JavaScript- und gzip-Datei gemeinsam austauschen und den Frontend-Cache neu laden.

## Bedeutung der Messwerte

| Card-Feld | Erwarteter Sensor | Einheit |
|---|---|---|
| `pv_inputs` | Leistung an den konfigurierten direkten Eingängen (1–4) | W |
| `battery_pv_inputs` | Leistung der konfigurierten Batterie-PV-Platten (1–2), einzeln | W |
| `pv_energy_today` | Tagesertrag je aktivem direkten PV-Eingang | Wh oder kWh |
| `battery_pv_energy_today` | Tagesertrag je aktiver Batterie-PV-Platte | Wh oder kWh |
| `battery_to_inverter` | Batterie-Ausgang zum Wechselrichter (nur bei Batterie) | W |
| `inverter_output` | AC-Ausgangsleistung des Wechselrichters | W |
| `inverter_energy_today` | AC-Ausgangsenergie heute, optional für die Haus-Tagesbilanz | Wh oder kWh |
| `grid_power` | saldierte Netzleistung | W |
| `grid_import_price_per_kwh` | optionaler Preis für Netzbezug als fester Card-Wert oder unter `entities` als Preis-Sensor | €/kWh (Sensor auch ct/kWh) |
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

Wenn die Geräte bereits **fortlaufende Energiezähler in kWh** bereitstellen, können daraus mit `utility_meter` Tageszähler entstehen. Das Beispiel enthält zusätzlich einen optionalen Gesamtzähler der fünf Solarquellen in der Beispielkonfiguration; für die Kacheln werden die einzelnen PV-Tageszähler benötigt. Anzahl der Quellen und Entity-IDs bitte an die eigene Konfiguration anpassen:

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

Für den optionalen Gesamtzähler gilt: Die Solar-Tagesenergie muss die Energie aller aktiven direkten Eingänge **plus** die Energie der aktiven Batterie-PV-Platten zählen. Nicht stattdessen Batterieausgang und Batterie-PV gemeinsam addieren, da dieselbe Energie dadurch doppelt gezählt würde.

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

Alle vier bis sechs Kacheln zeigen die aktuelle Leistung und die zugehörigen Tageswerte ohne Aufklappen.
Ab 1100 px **Kartenbreite** stehen die kompakten Kacheln rechts in zwei Spalten neben der Grafik. Jede Kachel ist höchstens ein Fünftel der Kartenbreite breit. Die Ansicht richtet sich nach der verfügbaren Bildschirmhöhe; bei besonders geringer Höhe scrollt nur der Kachelbereich. Darunter stehen die Kacheln in drei beziehungsweise zwei Spalten unter der Grafik; unter 380 px in einer Spalte.

- **Haus:** Verbrauch, Netzbezug, selbst gedeckte Energie (`Verbrauch − Netzbezug`, mindestens null) und Tagesautarkie (`selbst gedeckt / Verbrauch × 100`). PV und Batterie zählen gemeinsam zur Selbstversorgung. Ohne Verbrauch seit Mitternacht bleibt die Tagesautarkie `–`.
- **Netz:** Bezug und Einspeisung heute getrennt. Ist ein Strompreis in €/kWh konfiguriert, erscheint zusätzlich die Summe der heutigen Netzbezugskosten. Im Editor kann dafür wahlweise eine Entity oder ein fester Wert eingetragen werden; die Entity hat Vorrang.
- **1–4× PV direkt:** Summe der aktiven `pv_energy_today`-Zähler plus Einzelwerte.
- **1–2× PV Batterie:** Nur bei Batterie; Summe der aktiven `battery_pv_energy_today`-Zähler plus Einzelwerte. Sind keine Modul-Tageszähler konfiguriert, dient `battery_charge_energy_today` als Gesamtwert für ein konfigurierbares, schematisches Anlagenlayout, in dem nur diese Module die Batterie laden. Einzelwerte werden nicht daraus geschätzt.
- **Batterie:** Nur bei Batterie; heute geladen und entladen, dazu Ladestand und gespeicherte Energie. Ohne Ladezähler dient die vollständige Summe der Batterie-PV-Tageszähler als Ladewert für ein konfigurierbares, schematisches Anlagenlayout.
- **Wechselrichter:** Tagesenergie aller aktiven direkten PV-Eingänge plus Batterieentladung bei vorhandenem Speicher sowie die separat gemessene AC-Erzeugung. Eingangsenergie und AC-Erzeugung unterscheiden sich durch Verluste.

Die Tagessummen benötigen vollständige Messwerte; fehlende Werte erscheinen als `–`.
Im visuellen Editor lässt sich unter „Tageswerte“ der neue AC-Tageszähler auswählen.
Der bestehende `solar_energy_today`-Eintrag kann in alten Konfigurationen stehen bleiben,
wird jedoch für diese Kacheln und die Hausbilanz nicht mehr verwendet.
