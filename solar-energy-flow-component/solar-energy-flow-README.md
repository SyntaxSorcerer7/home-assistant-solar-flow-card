Solar Energy Flow – V3
======================

DATEIEN
-------
solar-energy-flow.js
  Die eigentliche WebComponent.

solar-energy-flow-demo.html
  Standalone-Demo. Die WebComponent ist direkt eingebettet; Datei einfach im Browser öffnen.

example-minimal.html
  Minimales Beispiel mit externer Einbindung von solar-energy-flow.js.

PARAMETER
---------
Direkte PV-Eingänge:
  pv-direct-inputs="1" bis "4"
  pv-direct-1="..." bis pv-direct-4="..."

Speicheranzahl (numerisch, kein Boolean):
  battery-count="0", battery-count="1" oder battery-count="2"

  0:
  - Batterie verschwindet vollständig
  - SOC / Kapazität verschwinden
  - Batterie-Leistungsfluss verschwindet
  - kompletter grüner Speicher-PV-Bereich verschwindet
  - Speicher-PV-Module, Badges und Leitungen verschwinden

  1:
  - Batterie wird angezeigt
  - Speicher-PV kann mit 1 oder 2 Eingängen konfiguriert werden

  2:
  - Zwei Speicher nebeneinander mit leichtem Höhenversatz mit eigenen Leistungs-, SOC- und Kapazitätsanzeigen
  - Der Keller wächst um 35 SVG-Einheiten; das Dach erhält eine zusätzliche Modulreihe (+120), damit alle Werte lesbar bleiben
  - Zwei getrennte Speicher-PV-Zweige: Batterie 1 mit 1–2 Eingängen, Batterie 2 mit zwei eigenen Eingängen
  - Bestehende battery-power/soc/capacity-Werte gehören zu Speicher 1
  - Speicher 2: battery-2-power, battery-2-soc, battery-2-capacity
  - Fehlende Werte werden als „–“ dargestellt

Speicher-PV-Eingänge:
  pv-battery-inputs="1" oder "2"
  pv-battery-1="..."
  pv-battery-2="..."

PV-Eingänge von Batterie 2 (nur bei battery-count="2"):
  pv-battery-2-input-1="480"
  pv-battery-2-input-2="530"
  pv-battery-2-total="1010" (optional, sonst Summe der beiden Eingänge)
  Diese Werte sind unabhängig von pv-battery-1 / pv-battery-2 der ersten Batterie.

Weitere Werte:
  inverter-power
  battery-power
  battery-soc
  battery-capacity
  house-power
  autarky
  grid-import
  grid-export

TOTALWERTE
----------
pv-direct-total und pv-battery-total können weiterhin explizit gesetzt werden.
Wenn sie fehlen, berechnet V3 den jeweiligen Totalwert aus den konfigurierten Einzelwerten.
Bei battery-count="0" wird pvBatteryTotal intern nicht verwendet.

BEISPIEL
--------
<solar-energy-flow
  battery-count="1"
  pv-direct-inputs="4"
  pv-direct-1="850"
  pv-direct-2="920"
  pv-direct-3="780"
  pv-direct-4="1050"
  pv-battery-inputs="2"
  pv-battery-1="620"
  pv-battery-2="630"
  inverter-power="3950"
  battery-power="410"
  battery-soc="73"
  battery-capacity="12.8"
  house-power="3420"
  autarky="88"
  grid-import="100"
  grid-export="530">
</solar-energy-flow>

JAVASCRIPT-API
--------------
const flow = document.querySelector('solar-energy-flow');

flow.update({
  batteryCount: 2,
  pvBattery2Input1: 480,
  pvBattery2Input2: 530,
  // pvBattery2Total: 1010, // optionaler expliziter Gesamtwert
  battery2Power: 210,
  battery2Soc: 34,
  battery2Capacity: 8.5,
  pvDirectInputs: 4,
  pvDirect1: 850,
  pvDirect2: 920,
  pvDirect3: 780,
  pvDirect4: 1050,
  pvBatteryInputs: 2,
  pvBattery1: 620,
  pvBattery2: 630
});

HOME ASSISTANT
--------------
Die Card-Konfiguration und Entity-Zuordnung sind in ../README.md dokumentiert.
Die YAML-Parameter heißen pv_direct_inputs, battery_count und pv_battery_inputs.
