# Battery Measurements and Dynamic Scenario Control

This file records the simulator measurements, BMS thresholds, and the live
control method used for demonstrations.

## Status meanings

The project has two different status concepts:

- **Availability status:** `online` or `offline`, published on the retained
  `status` topic.
- **BMS state:** `NORMAL`, `LOW_SOC`, `WARNING`, or `FAULT`, derived from
  telemetry measurements.

The simulator scenario is a deterministic input that produces measurements.
It is not itself the BMS state. The BMS state is calculated from the resulting
measurements.

## Canonical topics

For the default battery:

```text
Telemetry: libre-solar/site-001/BAT-001/telemetry
Events:    libre-solar/site-001/BAT-001/event
Status:    libre-solar/site-001/BAT-001/status
Control:   libre-solar/site-001/BAT-001/control
```

The topic is generated from `SITE_ID` and `BATTERY_ID`; the implementation does
not hardcode `BAT-001`.

## Current measurements and thresholds

| Condition         | Measurement rule                            | Result                                 |
| ----------------- | ------------------------------------------- | -------------------------------------- |
| Normal            | All measurements remain within normal range | `NORMAL`                               |
| Low SOC           | `soc_pct <= 30`                             | `LOW_SOC` and `LOW_SOC` event          |
| High temperature  | `temperature_c >= 35`                       | `WARNING` and `HIGH_TEMPERATURE` event |
| Fault temperature | `temperature_c >= 45`                       | `FAULT`                                |
| Cell imbalance    | `imbalance_v >= 0.05`                       | `WARNING` and `CELL_IMBALANCE` event   |
| Severe imbalance  | `imbalance_v >= 0.08`                       | `FAULT`                                |
| Over-current      | `pack_current_a >= 30`                      | `FAULT` and `OVER_CURRENT` event       |
| Under-voltage     | `min_voltage_v <= 3.15`                     | `WARNING` and `UNDER_VOLTAGE` event    |
| Critical SOC      | `soc_pct <= 20`                             | `FAULT`                                |

Events are emitted once when a condition is entered. The simulator does not
publish the same event on every telemetry message.

## High-temperature measurements

The `HIGH_TEMPERATURE` scenario starts at approximately `41.5°C` and rises by
approximately `0.9°C` per telemetry step until it reaches `46°C`.

With the default configuration:

```dotenv
PUBLISH_INTERVAL_SECONDS=5
```

the expected progression is:

| Elapsed time | Approximate temperature | BMS state |
| -----------: | ----------------------: | --------- |
|        Start |                  41.5°C | `WARNING` |
|    5 seconds |                  42.4°C | `WARNING` |
|   10 seconds |                  43.3°C | `WARNING` |
|   15 seconds |                  44.2°C | `WARNING` |
|   20 seconds |                  45.1°C | `FAULT`   |
|   25 seconds |                  46.0°C | `FAULT`   |

The first telemetry message at or above `35°C` causes the high-temperature
warning event. The state becomes `FAULT` when the temperature reaches `45°C`.

## Other scenario behavior

### `NORMAL`

- SOC remains near `78.5%`
- Temperature remains near `32.4°C`
- Current remains positive, representing discharge
- BMS state is `NORMAL`
- No threshold event is emitted

### `CHARGING`

- SOC increases gradually
- Current is negative
- Power is negative because the battery is receiving energy
- BMS state is normally `NORMAL`

### `DISCHARGING`

- SOC decreases gradually
- Current is positive
- Power is positive because the battery is delivering energy

### `LOW_SOC`

- SOC starts near the warning range and decreases
- The `LOW_SOC` event is emitted when SOC is at or below `30%`
- The BMS state becomes `LOW_SOC`

### `CELL_IMBALANCE`

- One cell diverges from the others
- `imbalance_v` increases
- The affected cell can be inspected through `cells.voltages_v`
- The `CELL_IMBALANCE` event is emitted at `50 mV`

### `OVER_CURRENT`

- Pack current starts above `30 A`
- BMS state becomes `FAULT`
- An `OVER_CURRENT` critical event is emitted

### `UNDER_VOLTAGE`

- The minimum cell voltage falls to or below `3.15 V`
- BMS state becomes `WARNING`
- An `UNDER_VOLTAGE` event is emitted

### `FAULT`

- Multiple abnormal measurements are combined
- BMS state is `FAULT`
- A `BMS_FAULT` event is emitted

### `RECOVERY`

- Abnormal measurements move toward normal values
- The simulator shows the recovery trajectory
- The canonical event schema currently has no recovery event type

## Dynamic scenario control

`.env` still provides the startup default:

```dotenv
SIMULATOR_SCENARIO=NORMAL
```

After startup, scenario changes are sent through the validated MQTT control
topic. No container restart and no `.env` edit is required.

### Change to high temperature

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/control' \
  -m '{"schema_version":"1.0","command":"SET_SCENARIO","value":"HIGH_TEMPERATURE"}'
```

### Change to cell imbalance

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/control' \
  -m '{"schema_version":"1.0","command":"SET_SCENARIO","value":"CELL_IMBALANCE"}'
```

### Return to normal

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/control' \
  -m '{"schema_version":"1.0","command":"SET_SCENARIO","value":"NORMAL"}'
```

Supported runtime scenario values are:

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

Invalid control payloads are rejected by JSON Schema validation and do not
change the active scenario.

## Dynamic time scale

The simulator can also change its publish speed at runtime. A time scale of
`2` publishes twice as fast; a time scale of `0.5` publishes half as fast.

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/control' \
  -m '{"schema_version":"1.0","command":"SET_TIME_SCALE","value":2}'
```

Return to the normal speed:

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/control' \
  -m '{"schema_version":"1.0","command":"SET_TIME_SCALE","value":1}'
```

## Observe the live data

Subscribe to telemetry and events in a separate terminal:

```bash
docker run --rm --network host eclipse-mosquitto:2.0 \
  mosquitto_sub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/#' -v
```

Watch the dashboard at:

```text
http://localhost:3000/
```

The dashboard updates from the next telemetry message. When a new scenario
starts, its measurements and BMS state are visible without restarting the
simulator container.

## Architecture decision

The recommended demonstration workflow is:

```text
.env
  -> startup default only

MQTT control topic
  -> schema validation
  -> runtime simulator state change
  -> telemetry, BMS state, and event updates
  -> dashboard and Home Assistant
```

This keeps the simulator replaceable by a real BMS transport later and avoids
hardcoding demo state into the dashboard or the MQTT consumers.
