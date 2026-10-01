# Libre Solar BMS Remote Monitoring Gateway

An open, TypeScript-based, Dockerized MVP that publishes realistic Libre Solar BMS monitoring
data to one canonical MQTT contract. The included simulator makes the complete
demo runnable without battery hardware.

## Quick start

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f simulator
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

The simulator publishes to `libre-solar/site-001/BAT-001/{telemetry,event,status}`.
Stop it with `docker compose down`. Copy `.env.example` to `.env` only when you
want to override defaults; it is never required for local startup.

Set `SIMULATOR_SCENARIO` in `.env` to `NORMAL`, `LOW_SOC`,
`HIGH_TEMPERATURE`, `CELL_IMBALANCE`, or `FAULT`, then recreate the simulator:

```bash
docker compose up -d --build --force-recreate simulator
```

The simulator validates every telemetry, event, and status message before
publishing. Run unit tests with:

```bash
docker compose run --rm simulator npm test
```

See [the architecture](docs/ARCHITECTURE.md), [MQTT contract](docs/MQTT_SPECIFICATION.md),
[demo](docs/DEMO.md), and [deployment notes](docs/DEPLOYMENT.md).

