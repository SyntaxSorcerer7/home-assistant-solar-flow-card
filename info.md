# Solar Flow Card for Home Assistant

**English** | [Deutsch](README.de.md)

[![HACS](https://img.shields.io/badge/HACS-Default-41BDF5.svg)](https://hacs.dev/)
[![GitHub release downloads](https://img.shields.io/github/downloads/SyntaxSorcerer7/home-assistant-solar-flow-card/total?label=release%20downloads)](https://github.com/SyntaxSorcerer7/home-assistant-solar-flow-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Where is your home's electricity coming from, and how much have you supplied yourself today?** Solar Flow Card brings your solar system's readings together in an animated house diagram and tiles for PV, inverter, home, grid and battery storage. See at a glance when you import or export electricity and when your battery supplies power.

![Solar Flow Card showing PV inputs, two batteries, home consumption and grid flows](docs/images/solar-flow-card-current.png)

The card supports **one to four direct PV inputs** at the inverter and **up to two batteries**, each with **one or two PV inputs**. With daily energy sensors, it also shows daily generation, consumption, grid imports and exports, battery energy and self-sufficiency. Optional tariffs add import costs, savings from self-supply and the value of exported electricity.

English is the default. To use German, choose **Deutsch** under **Appearance → Language** in the card editor or set `language: de` in YAML.

[Installation](README.md#installation) · [Editor setup](README.md#editor-setup) · [Daily energy sensors](README.md#creating-daily-energy-sensors) · [YAML configuration](README.md#yaml-configuration) · [Changelog](CHANGELOG.md)
