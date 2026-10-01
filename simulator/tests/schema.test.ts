import assert from "node:assert/strict";
import test from "node:test";
import { BatterySimulator } from "../src/simulator.js";
import { MessageValidator } from "../src/validation.js";

const validator = new MessageValidator();
const telemetry = () => new BatterySimulator("site-001", "BAT-001").step();

test("valid telemetry passes", () => assert.doesNotThrow(() => validator.validate("telemetry", telemetry())));
test("SOC above 100 fails", () => {
  const invalid = telemetry();
  invalid.battery.soc_pct = 101;
  assert.throws(() => validator.validate("telemetry", invalid), /Invalid telemetry/);
});
test("invalid timestamp fails", () => {
  const invalid = telemetry();
  invalid.timestamp = "today";
  assert.throws(() => validator.validate("telemetry", invalid), /Invalid telemetry/);
});
test("missing battery ID fails", () => {
  const invalid = telemetry() as Record<string, unknown>;
  delete invalid.battery_id;
  assert.throws(() => validator.validate("telemetry", invalid), /Invalid telemetry/);
});
test("invalid event severity fails", () => {
  const invalid = { schema_version: "1.0", event_id: "evt-1", battery_id: "BAT-001", site_id: "site-001", timestamp: new Date().toISOString(), type: "LOW_SOC", severity: "URGENT", message: "bad severity" };
  assert.throws(() => validator.validate("event", invalid), /Invalid event/);
});
