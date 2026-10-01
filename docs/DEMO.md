# Demo runbook

1. Run `docker compose up -d --build`.
2. In another terminal, subscribe to `libre-solar/#` as shown in the README.
3. Observe retained status and repeating telemetry.
4. Add `SIMULATOR_SCENARIO=LOW_SOC` to `.env`, then run
   `docker compose up -d --build --force-recreate simulator`; observe the
   `LOW_SOC` telemetry state and event. Repeat for `CELL_IMBALANCE`,
   `HIGH_TEMPERATURE`, and `FAULT`.
5. In Home Assistant, configure the MQTT integration to this broker. Retained
   discovery messages create the battery entities automatically.

