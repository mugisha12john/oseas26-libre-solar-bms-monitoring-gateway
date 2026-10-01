# MQTT specification

Base topic: `libre-solar/{site_id}/{battery_id}/{message_type}`.

| Message type | Topic suffix | Purpose |
| --- | --- | --- |
| telemetry | `telemetry` | Continuous, validated BMS measurements |
| event | `event` | Significant warning/fault events |
| status | `status` | Retained `online` or `offline` availability |

Payload definitions are JSON Schema Draft 2020-12 files in `schemas/`. All
timestamps are RFC 3339 UTC strings. Values use SI-oriented field names (for
example `pack_voltage_v`, `soc_pct`, and `temperature_c`). `soc_pct` is a BMS
measurement; this MVP deliberately does not claim that SOH is measured.

Home Assistant discovery config is retained under
`homeassistant/{sensor|binary_sensor}/libre_solar_site_001_BAT_001/.../config`.
Each entity uses the canonical telemetry topic and a `value_json` template.

Publish a status test message:

```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'libre-solar/site-001/BAT-001/status' \
  -m '{"schema_version":"1.0","battery_id":"BAT-001","site_id":"site-001","status":"online","timestamp":"2026-09-30T18:00:00Z"}'
```

