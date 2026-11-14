# Changelog

**English** | [Deutsch](CHANGELOG.de.md)

Changes to [Solar Flow Card](README.md), in descending version order.

## 4.8.0

- Added English and German card, editor, and graphic translations with a per-card language setting. English is the default, including for existing cards without a language setting.

## 4.7.0

- Custom labels of up to three characters per PV module in the house graphic and tiles.

## 4.6.5

- Removed the current daily values heading from the live view.

## 4.6.4

- When viewing past days, the card hides live sections of the tiles. The house graphic remains live.

## 4.6.3

- Historical costs account for constant price sensors even when the price did not change on the selected day, provided it can be established that the price already applied.

## 4.6.2

- Status, day navigation arrows, date, and Today button appear in a compact row.

## 4.6.1

- Day navigation arrows, localized dates, and separate status indicators for the house graphic and tiles.

## 4.6.0

- Date selection for historical daily values from Home Assistant history.

## 4.5.0

- Valuation of grid exports using an optional feed-in tariff. When no tariff is set, the import price can provide an estimated value.

## 4.4.0 and 4.3.1

- A more compact battery view with separate PV, state of charge, and charge and discharge energy values for each battery.

## 4.3.0

- Prepared the package for publication through HACS.

## 4.2.0

- Optional electricity price for grid import costs and estimated savings from self-supply.

## 4.1.0

- Two batteries share a PV tile and a battery tile, with values kept separate for each battery.

## 4.0.0

- Support for a second battery with its own PV inputs and sensors.

## 3.3.1

- Native input fields in the visual editor for title, decimal places, system layout, and battery capacity.

## 3.3.0

- Configurable numbers of direct PV inputs and battery PV modules, plus operation without a battery.

## 3.2.1

- Anonymized project metadata and synthetic example data.

## 3.2.0

- Compact system tiles with integrated daily values.

## 3.1.1

- The inverter-to-house arrow subtracts grid exports from AC output power.

## 3.1.0

- Dynamic battery fill level and clearer flow animations.

## 3.0.0

- House graphic using the `solar-energy-flow` web component.

## 1.4.0

- Configurable display of stored battery energy.

## 1.3.0

- More compact layout with daily values alongside system elements.

## 1.2.0

- Display of stored battery energy.

## 1.1.2

- Daily battery charge and discharge energy values.

## 1.1.1

- Clearer arrowheads for energy flows.

## 1.1.0

- Live power values on flow arrows.

## 1.0.0

- Initial release.

Individual versions are available in the [GitHub releases](https://github.com/SyntaxSorcerer7/home-assistant-solar-flow-card/releases).
