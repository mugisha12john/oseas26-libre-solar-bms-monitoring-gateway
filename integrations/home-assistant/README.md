# Home Assistant

For the exact discovery topics, JSON configuration, and sensor value paths,
see [the shared MQTT contract](../../docs/MQTT_SPECIFICATION.md#home-assistant-auto-discovery).

Enable the Home Assistant MQTT integration and connect it to the same
Mosquitto broker. The simulator publishes retained MQTT Discovery configuration
for the Libre Solar battery as one device. Every entity reads the existing
canonical telemetry topic; no Home Assistant-specific telemetry format is
created.

## Discovery entities

The simulator publishes discovery for:

- State of charge
- Pack voltage, current, and power
- Battery temperature
- Cycle count
- BMS state
- Cell 1 through Cell 4 voltage
- Minimum, maximum, and average cell voltage
- Cell imbalance
- Balancing
- Online/offline availability

All entities use a stable device identifier derived from `site_id` and
`battery_id`, for example `libre_solar_site_001_BAT_001`, and are grouped under
`Libre Solar BAT-001`. Discovery also sets a stable `object_id`, so the entity
IDs used by the dashboard remain predictable, for example
`sensor.libre_solar_site_001_bat_001_soc`.

Availability comes from the existing status topic:

```text
libre-solar/site-001/BAT-001/status
```

The telemetry topic remains:

```text
libre-solar/site-001/BAT-001/telemetry
```

## Install the dashboard

The ready-to-import Lovelace dashboard is
`integrations/home-assistant/dashboard.yaml`.

Using the Home Assistant UI:

1. Open the MQTT integration and confirm the Libre Solar device and entities
   have appeared.
2. Open **Settings -> Dashboards**.
3. Create a new dashboard or open an existing dashboard in edit mode.
4. Choose **Add dashboard card**, then **Manual**.
5. Add the cards from `dashboard.yaml` section by section, or use YAML
   dashboard mode and paste the complete file contents.
6. Save and open the **Libre Solar Battery** view.

The dashboard contains Battery Overview, Battery History, Cell Monitoring,
Battery Health, and Events and State Changes sections. SOH is intentionally
shown as not calculated because the current dashboard does not use an SOH
entity.

## Verify discovery from MQTT

Subscribe to retained Discovery messages:

```bash
mosquitto_sub -h localhost -p 1883 -t 'homeassistant/#' -v
```

Restart the simulator so it republishes retained discovery configuration:

```bash
docker compose up -d --build --force-recreate simulator
```

You should see topics such as:

```text
homeassistant/sensor/libre_solar_site_001_BAT_001/soc/config
homeassistant/sensor/libre_solar_site_001_BAT_001/pack_voltage/config
homeassistant/binary_sensor/libre_solar_site_001_BAT_001/online/config
```

## Verify scenarios

Change `SIMULATOR_SCENARIO` in `.env` and recreate only the simulator:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=LOW_SOC/' .env
docker compose up -d --force-recreate simulator
```

The SOC and BMS state entities should update in Home Assistant. Repeat with
`HIGH_TEMPERATURE`, `CELL_IMBALANCE`, and `FAULT` to verify abnormal state
cards and history graphs. Restore the default scenario when finished:

```bash
sed -i 's/^SIMULATOR_SCENARIO=.*/SIMULATOR_SCENARIO=NORMAL/' .env
docker compose up -d --force-recreate simulator
```
