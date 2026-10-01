# Libre Solar BMS Remote Monitoring Gateway

An open, TypeScript-based, Dockerized MVP that publishes realistic Libre Solar BMS monitoring
data to one canonical MQTT contract. The included simulator makes the complete
demo runnable without battery hardware.

## Quick start

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f simulator
docker compose logs -f dashboard
mosquitto_sub -h localhost -p 1883 -t 'libre-solar/#' -v
```

The simulator publishes to `libre-solar/site-001/BAT-001/{telemetry,event,status}`.
Stop it with `docker compose down`. Copy `.env.example` to `.env` only when you
want to override defaults; it is never required for local startup.

Set `SIMULATOR_SCENARIO` in `.env` to any supported value:
`NORMAL`, `CHARGING`, `DISCHARGING`, `LOW_SOC`, `HIGH_TEMPERATURE`, `CELL_IMBALANCE`,
`OVER_CURRENT`, `UNDER_VOLTAGE`, `FAULT`, or `RECOVERY`, then recreate the simulator:

```bash
docker compose up -d --build --force-recreate simulator
```

Current convention: positive `pack_current_a` indicates discharge, while negative values indicate charging current.
The simulator validates every telemetry, event, and status message before publishing.
Run unit tests with:

```bash
docker compose run --rm simulator npm test
```

## Scenario summary

| Scenario         | Main behavior                            | Event                                                                                               |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| NORMAL           | Stable operation                         | None                                                                                                |
| CHARGING         | SOC increases                            | None                                                                                                |
| DISCHARGING      | SOC decreases                            | None                                                                                                |
| LOW_SOC          | SOC enters a low range                   | LOW_SOC                                                                                             |
| HIGH_TEMPERATURE | Temperature rises                        | HIGH_TEMPERATURE                                                                                    |
| CELL_IMBALANCE   | Cell divergence increases                | CELL_IMBALANCE                                                                                      |
| OVER_CURRENT     | Current exceeds the protection threshold | OVER_CURRENT                                                                                        |
| UNDER_VOLTAGE    | Voltage falls below threshold            | UNDER_VOLTAGE                                                                                       |
| FAULT            | Critical abnormal state                  | BMS_FAULT                                                                                           |
| RECOVERY         | Abnormal state returns toward normal     | Recovery event not emitted because the canonical event schema does not define a recovery-type event |

See [the architecture](docs/ARCHITECTURE.md), [MQTT contract](docs/MQTT_SPECIFICATION.md),
[demo](docs/DEMO.md), and [deployment notes](docs/DEPLOYMENT.md).
