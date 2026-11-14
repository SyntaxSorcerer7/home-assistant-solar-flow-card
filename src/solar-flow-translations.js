// The selected language belongs to the card configuration, independently of
// the Home Assistant profile language.
function solarLanguage(language) {
  return language === "de" ? "de" : "en";
}

function solarLocale(language) {
  return solarLanguage(language) === "de" ? "de-DE" : "en-GB";
}

const SOLAR_MESSAGES = {
  en: {
    title: "Solar system",
    missingEntities: "'entities' is missing from the card configuration.",
    missingEntity: "Missing entities: {entities}",
    missingSlots: "'entities.{key}' must contain at least {count} sensor slots.",
    invalidLayout: "'{key}' must be an integer from {min} to {max}.",
    today: "Today",
    historical: "Historical",
    loading: "Loading daily values …",
    partial: "Daily values · missing values: –",
    empty: "No stored daily values available.",
    failed: "Could not load daily values. Select the date again to retry.",
    currentValues: "Tiles: live values and today's daily values",
    currentHeading: "Today · current daily values",
    historyHeading: "Daily values · {date}"
  },
  de: {
    title: "Solaranlage",
    missingEntities: "'entities' fehlt in der Card-Konfiguration.",
    missingEntity: "Fehlende Entitäten: {entities}",
    missingSlots: "'entities.{key}' muss mindestens {count} Sensorplätze enthalten.",
    invalidLayout: "'{key}' muss eine ganze Zahl von {min} bis {max} sein.",
    today: "Heute",
    historical: "Historisch",
    loading: "Tageswerte werden geladen …",
    partial: "Tageswerte · fehlende Werte: –",
    empty: "Keine gespeicherten Tageswerte verfügbar.",
    failed: "Tageswerte konnten nicht geladen werden. Datum erneut auswählen zum Wiederholen.",
    currentValues: "Kacheln: Live-Werte und Tageswerte von heute",
    currentHeading: "Heute · laufende Tageswerte",
    historyHeading: "Tageswerte · {date}"
  }
};

function solarMessage(language, key, values = {}) {
  let message = SOLAR_MESSAGES[solarLanguage(language)][key] ?? SOLAR_MESSAGES.en[key] ?? key;
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

const SOLAR_TEXT_EN = {
  "Direkte PV-Eingänge": "Direct PV inputs",
  "Anzahl Batterien": "Number of batteries",
  "PV-Platten an Batterie 1": "PV panels on battery 1",
  "PV-Platten an Batterie 2": "PV panels on battery 2",
  "Wert Einspeisung": "Export value",
  "Wert Einspeisung · nicht vergütet": "Export value · uncompensated",
  "Verbrauch · berechnet": "Consumption · calculated",
  "Verbrauch": "Consumption",
  "Ertrag heute": "Generation today",
  "Geladen heute": "Charged today",
  "Entladen heute": "Discharged today",
  "Ausgang jetzt": "Output now",
  "Batterie": "Battery",
  "Batterien": "Batteries",
  "Bezogen": "Imported",
  "Eingespeist": "Exported",
  "Kosten Netzbezug": "Grid import cost",
  "Öffentliches Netz": "Public grid",
  "Bezug jetzt": "Import now",
  "Haus": "Home",
  "Verbrauch jetzt": "Consumption now",
  "Netzbezug": "Grid import",
  "Selbst gedeckt": "Self supplied",
  "Ersparnis Selbstversorgung": "Self-supply savings",
  "Erzeugung gesamt": "Total generation",
  "Wechselrichter": "Inverter",
  "Erzeugung jetzt": "Generation now",
  "PV-Eingang": "PV input",
  "PV-Eingänge": "PV inputs",
  "Eingänge gesamt": "Total input",
  "AC-Erzeugung": "AC generation",
  "AC-Ausgang jetzt": "AC output now",
  "Direkte PV": "Direct PV",
  "Batterie 1 – PV": "Battery 1 – PV",
  "Batterie 2 – PV": "Battery 2 – PV",
  "Direkte PV-Leistung – Eingang": "Direct PV power – input",
  "Batterie 1 – PV-Modul": "Battery 1 – PV panel",
  "Batterie 2 – PV-Modul": "Battery 2 – PV panel",
  "Batterie 1 zum Wechselrichter": "Battery 1 to inverter",
  "Batterie 2 zum Wechselrichter": "Battery 2 to inverter",
  "Batterie 1 – Ladestand": "Battery 1 – state of charge",
  "Batterie 2 – Ladestand": "Battery 2 – state of charge",
  "Wechselrichter-Ausgangsleistung": "Inverter output power",
  "Saldierte Netzleistung (Netzzähler)": "Net grid power (grid meter)",
  "Tagesertrag direkte PV – Eingang": "Daily direct PV generation – input",
  "Tagesertrag Batterie 1 – PV-Modul": "Daily battery 1 PV generation – panel",
  "Tagesertrag Batterie 2 – PV-Modul": "Daily battery 2 PV generation – panel",
  "Wechselrichter AC-Erzeugung heute (für Hausbilanz)": "Inverter AC generation today (for home balance)",
  "Netzbezug heute": "Grid import today",
  "Einspeisung heute": "Grid export today",
  "Hausverbrauch heute": "Home consumption today",
  "Batterie 1 heute geladen": "Battery 1 charged today",
  "Batterie 1 heute entladen": "Battery 1 discharged today",
  "Batterie 2 heute geladen": "Battery 2 charged today",
  "Batterie 2 heute entladen": "Battery 2 discharged today",
  "Batterie 1 – aktuell gespeicherte Energie": "Battery 1 – currently stored energy",
  "Batterie 2 – aktuell gespeicherte Energie": "Battery 2 – currently stored energy",
  "Hausleistung (optional)": "Home power (optional)",
  "Strompreis Netzbezug (€/kWh, optional)": "Grid import price (€/kWh, optional)",
  "Einspeisevergütung (€/kWh, optional)": "Feed-in tariff (€/kWh, optional)",
  "Darstellung": "Appearance",
  "Titel": "Title",
  "Dezimalstellen Leistung": "Power decimal places",
  "Dezimalstellen Energie": "Energy decimal places",
  "Anlagenaufbau": "System layout",
  "1–4 direkte PV-Eingänge, 0–2 Batterien und jeweils 1–2 PV-Platten pro Batterie. Ausgeblendete Entity-Zuordnungen bleiben gespeichert und werden nicht mitgerechnet.": "1–4 direct PV inputs, 0–2 batteries and 1–2 PV panels per battery. Hidden entity assignments are preserved and excluded from totals.",
  "Beschriftung der Dachplatten (optional)": "Roof panel labels (optional)",
  "Maximal 3 Zeichen je Platte, für Hausgrafik und Kacheln. Leer lassen für die bisherigen Bezeichnungen.": "Up to 3 characters per panel, for the graphic and tiles. Leave empty for default labels.",
  "Live-Leistungen": "Live power",
  "Pflichtfelder für das animierte Flussdiagramm.": "Required fields for the animated energy flow.",
  "Batterie 1 – Kapazität": "Battery 1 – capacity",
  "Batterie 2 – Kapazität": "Battery 2 – capacity",
  "Gesamtkapazität (kWh)": "Total capacity (kWh)",
  "Batterie 2 – Gesamtkapazität (kWh)": "Battery 2 – total capacity (kWh)",
  "Die Energie-Entity wird direkt angezeigt. Ohne Entity berechnet die Card den aktuellen Inhalt aus Gesamtkapazität und Ladestand.": "The energy entity is displayed directly. Without an entity, stored energy is calculated from capacity and state of charge.",
  "Ohne verfügbaren Energiewert wird der Inhalt aus Gesamtkapazität und Ladestand berechnet.": "Without an available energy reading, stored energy is calculated from capacity and state of charge.",
  "Haus und Netz": "Home and grid",
  "Ohne Hausleistung berechnet die Card: Wechselrichter + saldierte Netzleistung.": "Without home power, the card calculates inverter output plus net grid power.",
  "Strompreis Netzbezug direkt (€/kWh, optional)": "Fixed grid import price (€/kWh, optional)",
  "Einspeisevergütung direkt (€/kWh, optional)": "Fixed feed-in tariff (€/kWh, optional)",
  "Preise können als Entity oder fester Wert angegeben werden; die Entity hat Vorrang. Cent/kWh werden automatisch in €/kWh umgerechnet. Fehlt die Einspeisevergütung oder ist sie 0, zeigt die Card den Wert zum Bezugspreis rot als „nicht vergütet“ an.": "Prices can be entities or fixed values. The entity takes precedence. Cent/kWh is converted to €/kWh. If the feed-in tariff is missing or zero, the export value is shown in red at the import price as uncompensated.",
  "Positive Netzleistung ist Bezug": "Positive grid power is import",
  "Ausschalten, wenn dein Netzzähler-Skript positive Werte bei Einspeisung liefert.": "Turn off when your grid meter reports positive values for export.",
  "PV-Tageserträge einzeln": "Individual daily PV generation",
  "Optionale Energiezähler für jeden konfigurierten PV-Eingang.": "Optional energy meters for each configured PV input.",
  "Tageswerte": "Daily values",
  "Optionale Energiezähler in kWh, die täglich zurückgesetzt werden.": "Optional energy meters in kWh that reset daily.",
  "PV am Speicher": "Battery PV",
  "Ausgang gesamt": "Total output",
  "PV Batterie": "Battery PV",
  "Hausgrafik · immer live": "House diagram · always live",
  "Hausgrafik · Live": "House diagram · Live",
  "Tag für die Kacheln auswählen": "Select day for tiles",
  "Vorheriger Tag": "Previous day",
  "Datum für die Kacheln": "Date for tiles",
  "Nächster Tag": "Next day",
  "Heute / Live": "Today / Live",
  "Zurück zu Heute / Live": "Return to Today / Live",
  "Autarkie am ausgewählten Tag": "Self-sufficiency on selected day",
  "von": "of",
  "gespeichert": "stored",
  "PV direkt": "Direct PV",
  "Eingang": "Input",
  "Einspeisung jetzt": "Export now",
  "Netz": "Grid",
  "Autarkie heute": "Self-sufficiency today"
};

Object.assign(SOLAR_TEXT_EN, {
  "Hausverbrauch": "Home consumption",
  "Autarkie": "Self-sufficiency",
  "Kapazität": "Capacity",
  "Energiefluss einer Solaranlage mit Haus, PV-Modulen, Wechselrichter, Batterie und Stromnetz": "Solar energy flow with home, PV panels, inverter, battery and grid"
});

const SOLAR_TEXT_DE = Object.fromEntries(Object.keys(SOLAR_TEXT_EN).map(key => [key, key]));

function solarText(language, text) {
  const translations = solarLanguage(language) === "de" ? SOLAR_TEXT_DE : SOLAR_TEXT_EN;
  return translations[text] ?? SOLAR_TEXT_EN[text] ?? text;
}

const SOLAR_DAY_LABELS = {
  "Ertrag heute": { en: { today: "Generation today", history: "Generation on {date}" }, de: { today: "Ertrag heute", history: "Ertrag am {date}" } },
  "Geladen heute": { en: { today: "Charged today", history: "Charged on {date}" }, de: { today: "Geladen heute", history: "Geladen am {date}" } },
  "Entladen heute": { en: { today: "Discharged today", history: "Discharged on {date}" }, de: { today: "Entladen heute", history: "Entladen am {date}" } },
  "Autarkie heute": { en: { today: "Self-sufficiency today", history: "Self-sufficiency on {date}" }, de: { today: "Autarkie heute", history: "Autarkie am {date}" } }
};
