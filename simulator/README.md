# BMS simulator (TypeScript)

The simulator is deterministic and changes state gradually each publishing
interval; it is not a random-number generator. It publishes canonical
telemetry every five seconds by default, a retained `online` status at startup,
and one scenario event where appropriate.

Variables: `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`,
`SITE_ID`, `BATTERY_ID`, `SIMULATOR_SCENARIO`, and
`PUBLISH_INTERVAL_SECONDS`.

Run `npm run build`, `npm test`, or `npm run dev` from this directory. The Docker image uses the compiled JavaScript output.

