# Implemented: Libre Solar BMS Monitoring Gateway

## Overview

This repository contains a Dockerized Libre Solar BMS monitoring MVP. The simulator produces electrically consistent battery measurements, validates canonical MQTT messages against JSON Schema, and publishes telemetry, events, and availability status. The dashboard consumes the MQTT stream through a WebSocket bridge and visibly reacts to changing battery conditions.

The existing MQTT foundation and canonical topic architecture remain in use.

## Implemented components

### MQTT and schemas

- Mosquitto runs through Docker Compose on port `1883`.
- Canonical topics are:

  ```text
  libre-solar/{site_id}/{battery_id}/telemetry
  libre-solar/{site_id}/{battery_id}/event
  libre-solar/{site_id}/{battery_id}/status
  ```

- Telemetry, events, and status messages use JSON Schema Draft 2020-12 files in `schemas/`.
- The simulator validates every message before publishing it.
- Status is retained and reports the simulator as online or offline.

### Electrically realistic simulator

- Battery state is generated through scenario-specific electrical behavior, then evaluated from the resulting measurements.
- Positive `pack_current_a` means discharge; negative current means charging.
- `pack_voltage_v` is derived from the sum of the individual cell voltages.
- `power_w` is calculated from pack voltage multiplied by pack current.
- Cell minimum, maximum, average, and imbalance values are derived from the same cell-voltage measurements.
- BMS state and error flags are determined from measurement thresholds rather than only from the scenario name.
- Events are emitted once when a threshold is entered, avoiding repeated event spam on every telemetry update.

Supported scenarios:

| Scenario | Electrical behavior | Expected result |
| --- | --- | --- |
| `NORMAL` | Stable SOC, voltage, temperature, and current | Normal BMS state |
| `CHARGING` | SOC rises and current is negative | Charging power direction |
| `DISCHARGING` | SOC falls and current is positive | Discharging power direction |
| `LOW_SOC` | SOC falls into the warning range | `LOW_SOC` event/state |
| `HIGH_TEMPERATURE` | Temperature rises above the warning threshold | `HIGH_TEMPERATURE` event/state |
| `CELL_IMBALANCE` | One cell diverges from the others | `CELL_IMBALANCE` event/state |
| `OVER_CURRENT` | Discharge current exceeds the protection threshold | `OVER_CURRENT` event and `FAULT` state |
| `UNDER_VOLTAGE` | Cell voltages fall below the threshold | `UNDER_VOLTAGE` event/state |
| `FAULT` | Multiple critical measurements become abnormal | `BMS_FAULT` event and `FAULT` state |
| `RECOVERY` | Abnormal measurements move back toward normal | Recovery trajectory |

### Dashboard

- The dashboard is served on port `3000`.
- It displays SOC, pack voltage, current, calculated power, temperature, and BMS state.
- It shows cell voltage bars, imbalance, balancing status, cycle count, event history, and selectable telemetry history charts.
- The BMS state indicator changes color for normal, warning, low-SOC, and fault conditions.
- Supported page routes include `/`, `/simulator`, and `/battery/BAT-001`.
- MQTT credentials are kept in the simulator configuration and are not exposed to browser code.

### Integrations and documentation

- Home Assistant MQTT discovery messages are published automatically.
- Prospect and MPM integration guidance is included under `integrations/`.
- Architecture, deployment, MQTT, demo, and team implementation documentation are available under `docs/`.

## Run from beginning to end

### 1. Prerequisites

Install and verify:

- Docker Engine
- Docker Compose v2 (`docker compose version`)
- Git

Optional host tools for inspecting MQTT messages:

- `mosquitto_sub`
- `curl`

### 2. Enter the repository

```bash
cd /home/mugisha-buban/Project/oseas26-libre-solar-bms-monitoring-gateway
```

### 3. Configure the simulator

The repository `.env` file can contain the following Docker defaults:

```dotenv
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
SITE_ID=site-001
BATTERY_ID=BAT-001
SIMULATOR_SCENARIO=NORMAL
PUBLISH_INTERVAL_SECONDS=5
```

For a new checkout, create it from the example when needed:

```bash
cp .env.example .env
```

Choose one supported value for `SIMULATOR_SCENARIO`:

```dotenv
SIMULATOR_SCENARIO=NORMAL
```

### 4. Build and start the complete stack

```bash
docker compose up -d --build
docker compose ps
```

The stack starts:

- `mosquitto`: MQTT broker
- `simulator`: telemetry, event, status, and Home Assistant discovery publisher
- `dashboard`: HTTP dashboard and MQTT-to-WebSocket bridge

### 5. Open and verify the dashboard

Open either URL in a browser:

```text
http://localhost:3000/
http://localhost:3000/battery/BAT-001
```

The page should show live values after the first simulator publish interval. The dashboard should update as telemetry arrives and should show the current BMS state, power direction, cell values, and events.

Verify the HTTP route from a terminal:

```bash
curl -I http://localhost:3000/battery/BAT-001
```

Expected result: `HTTP/1.1 200 OK`.

### 6. Inspect logs and MQTT messages

```bash
docker compose logs -f simulator
```

In another terminal, subscribe to the complete canonical topic tree:

```bash
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

If `mosquitto_sub` is not installed on the host:

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

Expected messages include telemetry every configured interval, an online status message, and scenario events where thresholds are crossed.

### 7. Demonstrate different battery conditions

Edit `.env` and choose a scenario, then recreate only the simulator:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=CELL_IMBALANCE/' .env
docker compose up -d --build --force-recreate simulator
```

Alternatively, edit the value manually and run:

```bash
docker compose up -d --build --force-recreate simulator
```

Refresh the dashboard if needed. Useful demo values are:

```text
CHARGING
DISCHARGING
LOW_SOC
HIGH_TEMPERATURE
CELL_IMBALANCE
OVER_CURRENT
UNDER_VOLTAGE
FAULT
RECOVERY
```

Observe the changes in current direction, calculated power, SOC, temperature, cell bars, BMS state, and event history.

### 8. Run validation tests

Run the simulator tests inside Docker:

```bash
docker compose run --rm simulator npm test
```

The tests cover schema validation, all scenarios, current direction, pack voltage derivation, power calculation, threshold-driven state evaluation, and single-emission event behavior.

For local TypeScript validation:

```bash
cd simulator
npm ci
npm run build
npm test
cd ../dashboard
npm ci
npm run build
cd ..
```

### 9. Stop the stack

When the demonstration is complete:

```bash
docker compose down
```

To rebuild from the current source later, use:

```bash
docker compose up -d --build --force-recreate
```

## Local simulator development without Docker

Start a local Mosquitto broker first, then configure the simulator to use `MQTT_HOST=localhost` and run:

```bash
cd simulator
npm ci
MQTT_HOST=localhost npm run dev
```

The Docker Compose workflow is the recommended end-to-end path because it starts the broker, simulator, and dashboard with consistent networking.
