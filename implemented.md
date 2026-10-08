# Implemented: Libre Solar BMS Monitoring Gateway

## Overview

This repository contains a Dockerized Libre Solar BMS monitoring MVP. The simulator produces electrically consistent battery measurements, validates canonical MQTT messages against JSON Schema, and publishes telemetry, events, and availability status. The dashboard consumes the MQTT stream through a WebSocket bridge and visibly reacts to changing battery conditions.

The existing MQTT foundation and canonical topic architecture remain in use.

## What this project implements

This project is a complete monitoring demonstration from simulated battery
measurements to a live operator dashboard. It is deliberately structured so
that the simulator can later be replaced by a real Libre Solar transport
adapter without changing the MQTT contract or the consuming integrations.

The implemented flow is:

```text
Scenario model or future Libre Solar transport
          |
     Battery measurements
          |
  Derived electrical metrics and BMS state
          |
     JSON Schema validation
          |
  Canonical MQTT telemetry/event/status
          |
  Dashboard MQTT subscriber and WebSocket bridge
          |
        Live operator view
```

The simulator is not just producing random numbers. Each scenario updates a
battery state, and the simulator derives pack voltage, power, cell metrics,
BMS state, balancing state, and error flags from that state. This makes the
demo useful for testing monitoring behavior rather than only testing message
transport.

The current MVP is a reliable observation and alarm foundation. The proposed
Battery Situation Awareness layer described below is the next step: it will
turn those observations and events into prioritized explanations and actions.

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

| Scenario           | Electrical behavior                                | Expected result                        |
| ------------------ | -------------------------------------------------- | -------------------------------------- |
| `NORMAL`           | Stable SOC, voltage, temperature, and current      | Normal BMS state                       |
| `CHARGING`         | SOC rises and current is negative                  | Charging power direction               |
| `DISCHARGING`      | SOC falls and current is positive                  | Discharging power direction            |
| `LOW_SOC`          | SOC falls into the warning range                   | `LOW_SOC` event/state                  |
| `HIGH_TEMPERATURE` | Temperature rises above the warning threshold      | `HIGH_TEMPERATURE` event/state         |
| `CELL_IMBALANCE`   | One cell diverges from the others                  | `CELL_IMBALANCE` event/state           |
| `OVER_CURRENT`     | Discharge current exceeds the protection threshold | `OVER_CURRENT` event and `FAULT` state |
| `UNDER_VOLTAGE`    | Cell voltages fall below the threshold             | `UNDER_VOLTAGE` event/state            |
| `FAULT`            | Multiple critical measurements become abnormal     | `BMS_FAULT` event and `FAULT` state    |
| `RECOVERY`         | Abnormal measurements move back toward normal      | Recovery trajectory                    |

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

## Repository structure and responsibilities

```text
.
├── docker-compose.yml
├── implemented.md
├── README.md
├── dashboard/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/server.ts
│   └── public/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEMO.md
│   ├── DEPLOYMENT.md
│   ├── MQTT_SPECIFICATION.md
│   └── TEAM_IMPLEMENTATION.md
├── gateway/README.md
├── integrations/
│   ├── home-assistant/README.md
│   ├── mpm/README.md
│   └── prospect/README.md
├── mqtt/
│   ├── mosquitto.conf
│   └── README.md
├── schemas/
│   ├── event.schema.json
│   ├── status.schema.json
│   └── telemetry.schema.json
└── simulator/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── main.ts
    │   ├── simulator.ts
    │   ├── types.ts
    │   ├── validation.ts
    │   ├── mqtt-publisher.ts
    │   ├── home-assistant.ts
    │   └── scenarios/
    │       ├── common.ts
    │       ├── index.ts
    │       └── scenario handlers
    └── tests/
        ├── schema.test.ts
        └── simulator.test.ts
```

### Root files

- `docker-compose.yml` defines the three-container demo stack: Mosquitto,
  the simulator, and the dashboard. It also provides runtime configuration
  such as MQTT host, battery identity, publish interval, and dashboard port.
- `README.md` is the short project introduction and quick-start guide.
- `implemented.md` is the detailed implementation record, operational
  walkthrough, and product direction.

### `mqtt/`

This folder contains the Mosquitto broker configuration and MQTT-specific
notes. Mosquitto is the transport hub: it receives canonical messages from
the simulator and makes them available to the dashboard and integrations.

### `schemas/`

These JSON Schema Draft 2020-12 files define the shared data contract:

- `telemetry.schema.json` defines measurements, cell data, calculated power,
  BMS state, balancing, and error flags.
- `event.schema.json` defines threshold events, severity, messages, and the
  optional measured value and unit that caused the event.
- `status.schema.json` defines retained online/offline availability messages.

Keeping this contract in one place means future hardware adapters and all
consumers can evolve independently while still exchanging predictable data.

### `simulator/`

The simulator is the current BMS data producer.

- `src/main.ts` loads environment settings, validates the selected scenario,
  connects to MQTT, publishes discovery/status/telemetry/events, and shuts
  down by publishing offline status.
- `src/simulator.ts` owns the battery state machine. It derives metrics,
  evaluates threshold-driven BMS state, and emits an event once when a
  scenario crosses its relevant threshold.
- `src/types.ts` defines the TypeScript models for scenarios, battery state,
  telemetry, events, and status.
- `src/validation.ts` loads the JSON Schemas and rejects invalid messages
  before they can be published.
- `src/mqtt-publisher.ts` owns the canonical topic names, MQTT connection,
  retained messages, QoS, validation call, and publishing behavior.
- `src/home-assistant.ts` creates Home Assistant MQTT discovery payloads.
- `src/scenarios/` contains the individual electrical behavior handlers for
  normal operation, charging, discharging, low SOC, high temperature, cell
  imbalance, over-current, under-voltage, fault, and recovery.
- `tests/` verifies schema validity, electrical direction and calculations,
  threshold behavior, scenario outcomes, recovery, and one-time event
  emission.

### `dashboard/`

The dashboard is the live presentation layer.

- `src/server.ts` subscribes to `libre-solar/#`, keeps the latest telemetry,
  status, and recent events in memory, serves the static dashboard, and
  exposes snapshots over WebSocket at `/ws`.
- `public/index.html` defines the dashboard view and its supported routes.
- `public/styles.css` provides the visual layout and state styling.
- `public/app.js` renders live values, cell voltage bars, event history,
  health details, balancing state, and selectable SOC/voltage/current/power/
  temperature history charts.

The dashboard also detects stale telemetry and changes the displayed status to
offline after the configured timeout.

### `integrations/`, `gateway/`, and `docs/`

- `integrations/home-assistant/` documents automatic discovery and entity
  consumption in Home Assistant.
- `integrations/prospect/` and `integrations/mpm/` document how external
  consumers can use the canonical MQTT contract.
- `gateway/README.md` records the future hardware gateway direction.
- `docs/` contains the architecture, deployment, demo, MQTT specification,
  and team implementation guidance that support the codebase.

## Unique feature: Battery Situation Awareness

The strongest product opportunity is to make the system answer the operator's
question: **What should I do now?**

Most monitoring software displays a value such as `temperature = 43°C`. This
project can go further by combining the current measurement, its recent
history, threshold state, event severity, and affected battery into an
actionable situation:

```text
Raw BMS data
      ↓
Understand what is happening
      ↓
Detect what matters
      ↓
Explain why it matters
      ↓
Recommend what to check
      ↓
Notify the operator
```

### Example situation

```text
BAT-001 needs attention

Cell imbalance increased to 72 mV during the last 30 minutes.
Cell 4 is significantly higher than the other cells.

Possible cause: cell imbalance or a balancing problem.

Recommended action: inspect Cell 4 and its connection, then verify BMS
balancing behavior.

Priority: High
Trend: Worsening
```

Another situation could say:

```text
Temperature trend detected

Battery temperature increased from 32°C to 43°C in 20 minutes.
The critical threshold has not been reached, but the rate of increase is
abnormal.

Recommendation: check battery load, ventilation, and surrounding temperature.
Priority: Medium
Trend: Worsening
```

### Features to add

1. **Attention Queue**

   Provide one prioritized view of what requires work instead of making an
   operator inspect every battery:

   ```text
   WHAT NEEDS MY ATTENTION?

   High     BAT-014  High temperature
   High     BAT-007  Severe cell imbalance
   Medium   BAT-021  Low SOC
   Medium   BAT-003  Unusual temperature trend
   Normal   21 batteries operating normally
   ```

   Queue entries should be ordered by priority, recency, severity, and
   whether the situation is getting better or worse.

2. **Why? explanation**

   Every warning should explain the evidence behind it: the current value,
   threshold, change over time, affected cell or battery, and the event or
   rule that produced the warning. This makes an alert auditable and helps an
   operator trust the recommendation.

3. **What should I check? guidance**

   Each serious situation should include practical technician checks. For
   example, cell imbalance can recommend inspecting the identified cell and
   wiring, while a temperature trend can recommend checking load, airflow,
   ambient temperature, and sensor placement.

4. **Trend and risk direction**

   Show whether a situation is improving, stable, or worsening instead of
   displaying only the latest value:

   ```text
   Temperature: 32°C → 35°C → 38°C → 42°C
   Trend: Increasing
   Risk: Increasing
   ```

   The same treatment should apply to cell imbalance, SOC, voltage, current,
   and other measurements. A trend detector should use a time window and a
   minimum change so normal measurement noise does not create false alarms.

5. **Notifications and acknowledgement**

   Important situations should be publishable as a separate actionable event
   or notification, with acknowledgement and resolution state. This allows
   the dashboard, Home Assistant, and future integrations to notify the right
   operator without losing the original evidence.

### Suggested implementation boundary

Battery Situation Awareness should be implemented as a decision-support
service between canonical MQTT data and the dashboard:

```text
Canonical telemetry and events
              ↓
Situation analyzer
  - rolling history per battery
  - threshold and trend rules
  - severity and risk scoring
  - explanation and recommendation builder
              ↓
Actionable situation messages
              ↓
Attention queue, dashboard, and notifications
```

The existing simulator and schemas already provide the measurements and
events needed to start this work. The next additions should define a versioned
situation schema, retain a bounded history per battery, implement rules for
temperature/imbalance/SOC/voltage/current, and add focused tests for direction,
priority, explanations, recommendations, deduplication, acknowledgement,
and recovery. The current MVP should remain compatible while this layer is
introduced incrementally.

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
