# Contributing to Solar Flow Card

Solar Flow Card is a Home Assistant dashboard card that displays solar production, battery activity, household consumption, and grid flows. You can build the card, run the tests, and try the browser previews without a Home Assistant instance.

## Get started

Install Git, Node.js 22 (the version used by the release workflow), and Python 3 for the local preview server. The project has no npm dependencies to install.

Fork the repository on GitHub, clone your fork, and create a branch for your change. Run these commands from the repository root:

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
```

The build combines the two JavaScript source files into `solar-flow-card.js` at the repository root. HACS and GitHub releases use that generated file. Edit the files in `src/` and include the regenerated bundle in your pull request whenever its contents change.

## Find your way around

| Path | Where to start |
| --- | --- |
| [`src/solar-flow-card.js`](src/solar-flow-card.js) | Card configuration, Home Assistant sensor readings, daily values, and the visual editor. |
| [`src/solar-energy-flow.js`](src/solar-energy-flow.js) | SVG house graphic and energy flow animations. |
| [`tests/solar-flow-card.test.mjs`](tests/solar-flow-card.test.mjs) | Tests for sensor mapping, calculations, configuration, history, and the built bundle. |
| [`examples/`](examples/) | Standalone graphics demo using sample values. |
| [`README.md`](README.md) | Installation instructions, supported sensors, and example configurations. |

Home Assistant passes configuration to `setConfig()` and sensor updates through `hass`. The card converts those readings into display values and passes them to the graphic through its `data` property. Start in the card source for sensor or configuration changes, and in the graphics source for SVG or animation changes.

## Try your changes in a browser

Start a local server from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

- [Graphics demo](http://127.0.0.1:8000/examples/solar-energy-flow.html) loads the graphics source directly. Try switching between zero, one, and two batteries.
- [Card preview](http://127.0.0.1:8000/tests/preview.html) shows the built card with sample sensor values. Try [four direct inputs and two batteries](http://127.0.0.1:8000/tests/preview.html?direct=4&battery=2).
- [Editor preview](http://127.0.0.1:8000/tests/editor-preview.html) shows the configuration form alongside the card.

Rebuild before refreshing the card or editor preview after a source change. If your change affects Home Assistant integration, try the generated bundle on a test dashboard using the [manual installation instructions](README.md#manual-installation).

## Submit a contribution

1. For a bug, capture the steps to reproduce it, the expected behavior, and the actual result. Include your Home Assistant version and a sanitized configuration if they help reproduce the issue. For a larger feature, open an issue to discuss the intended behavior.
2. Keep your branch focused. Update the relevant documentation for user-facing changes and add or update a test when fixing behavior the existing tests do not cover.
3. Rebuild and run the tests. Review `git status` before committing and keep local Home Assistant settings, credentials, and browser test output out of the commit.
4. Push your branch to your fork and open a pull request. Describe what changed, why it matters, and which checks you ran. Link the issue if there is one and include a screenshot if the appearance changed.
