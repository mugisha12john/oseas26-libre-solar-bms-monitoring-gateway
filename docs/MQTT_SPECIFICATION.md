# MQTT specification

Base topic: `libre-solar/{site_id}/{battery_id}/{message_type}`.

| Message type | Topic suffix | Purpose                                                   |
| ------------ | ------------ | --------------------------------------------------------- |
| telemetry    | `telemetry`  | Continuous, validated BMS measurements                    |
| event        | `event`      | Significant warning/fault events                          |
| status       | `status`     | Retained `online` or `offline` availability               |
| alert        | `alert`      | Actionable rule-based explanation and recommended checks  |
| control      | `control`    | Simulator commands such as scenario or time-scale changes |

Payload definitions are JSON Schema Draft 2020-12 files in `schemas/`. All
timestamps are ISO-8601/RFC 3339 UTC strings ending in `Z`. Values use
SI-oriented field names (for example `pack_voltage_v`, `soc_pct`, and
`temperature_c`). Telemetry includes `soh_percent` and `cycle_count`; `cycles`
is retained as an optional legacy alias for existing consumers.

Status includes `last_seen`. Alert payloads include `alert_id`, `battery_id`,
`severity`, `rule_id`, `title`, measured `evidence`, a deterministic
`explanation`, `recommended_checks`, and `created_at`.

Control payloads use `command` values `SET_SCENARIO` or `SET_TIME_SCALE` and a
command-specific `value`. The control contract is defined now for the runtime
simulator controls implemented in later steps.

Home Assistant discovery config is retained under
`homeassistant/{sensor|binary_sensor}/libre_solar_site_001_BAT_001/.../config`.
Each entity uses the canonical telemetry topic and a `value_json` template.

Publish a status test message:

```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/status' \
  -m '{"schema_version":"1.0","battery_id":"BAT-001","site_id":"site-001","status":"online","timestamp":"2026-09-30T18:00:00Z","last_seen":"2026-09-30T18:00:00Z"}'
```
