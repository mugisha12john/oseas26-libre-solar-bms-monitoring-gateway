# Deployment notes

The bundled Mosquitto configuration permits anonymous plaintext MQTT only for
local development. Do not expose port 1883 publicly in that mode. Production
deployment should use a broker with TLS, `allow_anonymous false`, a password
file or external authentication, restricted ACLs per site/battery, and secure
secrets injected through the deployment platform.

Containers must address the broker as `mosquitto:1883`; `localhost` is only
correct for host-side clients. Set `MQTT_HOST`, `MQTT_PORT`, credentials,
`SITE_ID`, and `BATTERY_ID` with environment variables.

