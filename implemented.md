# Implemented: Libre Solar BMS Monitoring Gateway

## What was implemented

This project provides a Dockerized remote-monitoring MVP for a Libre Solar
BMS. It uses one canonical MQTT data contract so that Home Assistant,
Prospect, and MPM can consume the same battery data independently.

### MQTT foundation

- Mosquitto runs through Docker Compose and exposes MQTT on port `1883`.
- Canonical topics follow:

  ```text
  libre-solar/{site_id}/{battery_id}/telemetry
  libre-solar/{site_id}/{battery_id}/event
  libre-solar/{site_id}/{battery_id}/status
  ```

- JSON Schema Draft 2020-12 definitions validate telemetry, events, and
  status before the simulator publishes messages.
- Schemas are located in `schemas/`.

### TypeScript simulator

The simulator is written in TypeScript and publishes validated MQTT data. It
models gradual battery changes instead of fully random values.

Available scenarios:

- `NORMAL`
- `LOW_SOC`
- `HIGH_TEMPERATURE`
- `CELL_IMBALANCE`
- `FAULT`

It publishes telemetry continuously, a retained online/offline status message,
and a relevant event for non-normal scenarios.

### Consumer integration preparation

- Home Assistant MQTT discovery configuration is published automatically.
- Prospect and MPM integration guidance is included in `integrations/`.
- The future real BMS/ThingSet transport has a reserved `gateway/` directory.

## How to run with Docker

From the repository root:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f simulator
```

Subscribe to all BMS MQTT messages:

```bash
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

If `mosquitto_sub` is unavailable on the host:

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

Stop the stack:

```bash
docker compose down
```

## Select a simulator scenario

Copy the environment example and set the desired scenario:

```bash
cp .env.example .env
```

For example, edit `.env` to contain:

```env
SIMULATOR_SCENARIO=FAULT
PUBLISH_INTERVAL_SECONDS=1
```

Recreate the simulator after changing configuration:

```bash
docker compose up -d --build --force-recreate simulator
```

## Run TypeScript locally

Install dependencies and run the checks:

```bash
cd simulator
npm ci
npm run build
npm test
```

For local development without Docker, start Mosquitto first, then run:

```bash
cd simulator
MQTT_HOST=localhost npm run dev
```

## Test coverage

The TypeScript tests cover:

- valid telemetry schema validation;
- invalid SOC, timestamps, missing IDs, and event severities;
- all five simulator scenarios;
- expected BMS state and event generation.

Run Docker-based tests with:

```bash
docker compose run --rm simulator npm test
```
