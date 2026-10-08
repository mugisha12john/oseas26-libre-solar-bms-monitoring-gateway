# Runbook: Libre Solar BMS Monitoring Gateway

This guide explains how to run each part of the project independently and how to run the complete Dockerized demonstration.

## 1. Prerequisites

Required:

- Docker Engine
- Docker Compose v2
- Node.js and npm for host-based development

Optional:

- `mosquitto_pub`
- `mosquitto_sub`
- `curl`

Verify the tools:

```bash
docker --version
docker compose version
node --version
npm --version
```

From the repository root:

```bash
cd /home/mugisha-buban/Project/oseas26-libre-solar-bms-monitoring-gateway
```

## 2. Configuration

The Docker Compose defaults are stored in `.env`. Start with `.env.example` when creating a new checkout:

```bash
cp .env.example .env
```

Important settings:

```dotenv
MQTT_HOST=mosquitto
MQTT_PORT=1883
SITE_ID=site-001
BATTERY_ID=BAT-001
SIMULATOR_SCENARIO=NORMAL
PUBLISH_INTERVAL_SECONDS=5
DASHBOARD_PORT=3000
OFFLINE_TIMEOUT_MS=15000
```

Use `MQTT_HOST=mosquitto` when the simulator or dashboard runs inside Compose. Use `MQTT_HOST=localhost` when running a TypeScript process directly on the host.

Supported simulator scenarios:

```text
NORMAL
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

## 3. Run the MQTT broker only

Start Mosquitto without starting the simulator or dashboard:

```bash
docker compose up -d mosquitto
docker compose ps mosquitto
```

View broker logs:

```bash
docker compose logs -f mosquitto
```

Stop only the broker:

```bash
docker compose stop mosquitto
```

The broker is exposed at `localhost:1883`.

## 4. Run the simulator only in Docker

Start Mosquitto first, then build and start the simulator:

```bash
docker compose up -d mosquitto
docker compose up -d --build simulator
```

View simulator logs:

```bash
docker compose logs -f simulator
```

The simulator publishes to:

```text
libre-solar/site-001/BAT-001/telemetry
libre-solar/site-001/BAT-001/event
libre-solar/site-001/BAT-001/status
```

Change the scenario without changing source code by editing `.env`, then recreate the simulator:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=CELL_IMBALANCE/' .env
docker compose up -d --build --force-recreate simulator
```

Stop the simulator only:

```bash
docker compose stop simulator
```

## 5. Run the simulator directly on the host

Start the broker:

```bash
docker compose up -d mosquitto
```

Install simulator dependencies and build it:

```bash
cd simulator
npm ci
npm run build
```

Run tests:

```bash
npm test
```

Run the simulator against the Docker broker:

```bash
MQTT_HOST=localhost \
MQTT_PORT=1883 \
SIMULATOR_SCENARIO=NORMAL \
PUBLISH_INTERVAL_SECONDS=5 \
npm run dev
```

Run a different scenario:

```bash
MQTT_HOST=localhost SIMULATOR_SCENARIO=HIGH_TEMPERATURE npm run dev
```

Return to the repository root before running other project commands:

```bash
cd ..
```

## 6. Run the dashboard only in Docker

The dashboard needs a broker and a publisher to display live data. Start Mosquitto and the simulator, then start the dashboard:

```bash
docker compose up -d mosquitto simulator
docker compose up -d --build dashboard
```

Open:

```text
http://localhost:3000/
http://localhost:3000/simulator
http://localhost:3000/battery/BAT-001
```

View dashboard logs:

```bash
docker compose logs -f dashboard
```

The dashboard subscribes to `libre-solar/#`, keeps recent messages in memory, and exposes browser snapshots through `/ws`.

Stop the dashboard only:

```bash
docker compose stop dashboard
```

## 7. Run the dashboard directly on the host

Start Mosquitto and the simulator first. Then install and build the dashboard:

```bash
docker compose up -d mosquitto simulator
cd dashboard
npm ci
npm run build
```

Run it against the host-exposed broker:

```bash
MQTT_HOST=localhost \
MQTT_PORT=1883 \
DASHBOARD_PORT=3000 \
OFFLINE_TIMEOUT_MS=15000 \
npm run dev
```

Open `http://localhost:3000/`.

## 8. Run schema validation and tests

Run the complete simulator build and test suite:

```bash
cd simulator
npm ci
npm run build
npm test
cd ..
```

The tests cover:

- Telemetry schema validation
- UTC timestamp validation
- Required SOH and cycle count fields
- Status `last_seen`
- Alert payload validation
- Control command validation
- All simulator scenarios
- Current direction and SOC movement
- Pack voltage and power calculations
- Threshold-driven BMS states
- One-time event emission

Run the same tests inside Docker:

```bash
docker compose run --rm simulator npm test
```

Build the dashboard separately:

```bash
cd dashboard
npm ci
npm run build
cd ..
```

## 9. Inspect MQTT messages

Subscribe to every canonical message:

```bash
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

If `mosquitto_sub` is not installed, use the Docker client:

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

Publish a valid status message manually:

```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/status' \
  -m '{"schema_version":"1.0","battery_id":"BAT-001","site_id":"site-001","status":"online","timestamp":"2026-10-06T12:00:00Z","last_seen":"2026-10-06T12:00:00Z"}'
```

The simulator validates messages before publishing them. The alert and control schemas are available for STEP 1 contract testing; the analyzer and runtime control consumer are planned for later implementation steps.

## 10. Run the complete system together

Build and start all current services:

```bash
docker compose up -d --build
```

Check service state:

```bash
docker compose ps
```

Expected services:

```text
mosquitto
simulator
dashboard
```

Follow all logs:

```bash
docker compose logs -f
```

Open the dashboard:

```text
http://localhost:3000/
```

In another terminal, inspect MQTT traffic:

```bash
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

Run the full validation test container while the stack is running:

```bash
docker compose run --rm simulator npm test
```

## 11. Demonstrate each scenario

Set one scenario and recreate only the simulator:

```bash
for scenario in NORMAL CHARGING DISCHARGING LOW_SOC HIGH_TEMPERATURE CELL_IMBALANCE OVER_CURRENT UNDER_VOLTAGE FAULT RECOVERY; do
  sed -i "s/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=$scenario/" .env
  docker compose up -d --force-recreate simulator
  echo "Running scenario: $scenario"
  sleep 8
done
```

For a live pitch, use one scenario at a time and watch the dashboard while inspecting MQTT messages:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=CELL_IMBALANCE/' .env
docker compose up -d --force-recreate simulator
```

Then try:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=HIGH_TEMPERATURE/' .env
docker compose up -d --force-recreate simulator
```

## 12. Stop and clean up

Stop containers but keep named volumes:

```bash
docker compose stop
```

Stop and remove containers and networks:

```bash
docker compose down
```

Remove containers, networks, and stored Mosquitto data:

```bash
docker compose down -v
```

Do not use `down -v` when you need to preserve broker data or retained messages.

## 13. One-command quick start

From the repository root:

```bash
docker compose up -d --build && docker compose ps
```

Then open:

```text
http://localhost:3000/
```

## 14. Current implementation boundary

Implemented now:

- Mosquitto MQTT broker
- TypeScript battery simulator
- Ten deterministic scenarios
- JSON Schema validation for telemetry, events, status, alerts, and controls
- MQTT publishing and retained status
- Dashboard and WebSocket bridge
- Home Assistant discovery payload generation

Planned in later steps:

- LiFePO4 electrical and thermal model
- Runtime scenario and time-scale control consumption
- Separate rule-based analyzer service
- Alert generation from telemetry trends and hysteresis
- Mock Home Assistant and MPM subscribers
- Fleet attention queue and operator recommendations
