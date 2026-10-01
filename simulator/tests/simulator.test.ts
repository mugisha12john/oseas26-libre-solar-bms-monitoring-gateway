import assert from "node:assert/strict";
import test from "node:test";
import { BatterySimulator } from "../src/simulator.js";
import { MessageValidator } from "../src/validation.js";

test("normal telemetry is schema-valid", () => {
  const message = new BatterySimulator("site-001", "BAT-001").step();
  new MessageValidator().validate("telemetry", message);
  assert.equal(message.bms.state, "NORMAL");
});

test("LOW_SOC produces low SOC and a LOW_SOC event", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "LOW_SOC");
  assert.ok(simulator.step().battery.soc_pct < 20);
  assert.equal(simulator.nextEvent()?.type, "LOW_SOC");
});

test("HIGH_TEMPERATURE produces elevated temperature", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "HIGH_TEMPERATURE");
  assert.ok(simulator.step().battery.temperature_c > 42);
  assert.equal(simulator.nextEvent()?.type, "HIGH_TEMPERATURE");
});

test("CELL_IMBALANCE gradually produces divergent cells", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "CELL_IMBALANCE");
  assert.ok(simulator.step().cells.imbalance_v > 0.06);
  assert.equal(simulator.nextEvent()?.type, "CELL_IMBALANCE");
});

test("FAULT produces a fault state and event", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "FAULT");
  assert.equal(simulator.step().bms.state, "FAULT");
  assert.equal(simulator.nextEvent()?.type, "BMS_FAULT");
});

