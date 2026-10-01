export function discoveryMessages(siteId: string, batteryId: string): Array<[string, string]> {
  const baseTopic = `libre-solar/${siteId}/${batteryId}`;
  const deviceId = `libre_solar_${siteId}_${batteryId}`.replaceAll("-", "_");
  const device = { identifiers: [deviceId], name: `Libre Solar ${batteryId}`, manufacturer: "Libre Solar", model: "BMS monitoring gateway" };
  const metrics = [
    ["soc", "Battery SOC", "battery.soc_pct", "%", "battery", "measurement"],
    ["pack_voltage", "Pack Voltage", "battery.pack_voltage_v", "V", "voltage", "measurement"],
    ["pack_current", "Pack Current", "battery.pack_current_a", "A", "current", "measurement"],
    ["temperature", "Battery Temperature", "battery.temperature_c", "°C", "temperature", "measurement"],
    ["min_cell_voltage", "Minimum Cell Voltage", "cells.min_voltage_v", "V", "voltage", "measurement"],
    ["max_cell_voltage", "Maximum Cell Voltage", "cells.max_voltage_v", "V", "voltage", "measurement"],
    ["cell_imbalance", "Cell Imbalance", "cells.imbalance_v", "V", "voltage", "measurement"],
    ["cycles", "Battery Cycles", "battery.cycles", undefined, undefined, "total_increasing"],
    ["bms_state", "BMS State", "bms.state", undefined, undefined, undefined]
  ] as const;
  const messages = metrics.map(([key, name, path, unit, deviceClass, stateClass]) => {
    const config: Record<string, unknown> = { name, unique_id: `${deviceId}_${key}`, state_topic: `${baseTopic}/telemetry`, value_template: `{{ value_json.${path} }}`, device };
    if (unit) config.unit_of_measurement = unit;
    if (deviceClass) config.device_class = deviceClass;
    if (stateClass) config.state_class = stateClass;
    return [`homeassistant/sensor/${deviceId}/${key}/config`, JSON.stringify(config)] as [string, string];
  });
  messages.push([`homeassistant/binary_sensor/${deviceId}/balancing/config`, JSON.stringify({ name: "Balancing", unique_id: `${deviceId}_balancing`, state_topic: `${baseTopic}/telemetry`, value_template: "{{ value_json.bms.balancing }}", payload_on: "True", payload_off: "False", device })]);
  return messages;
}

