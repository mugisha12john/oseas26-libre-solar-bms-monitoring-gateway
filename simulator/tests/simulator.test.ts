import assert from "node:assert/strict";
import test from "node:test";
import { BatterySimulator } from "../src/simulator.js";
import { MessageValidator } from "../src/validation.js";

const allScenarios = [
  "NORMAL",
  "CHARGING",
  "DISCHARGING",
  "LOW_SOC",
  "HIGH_TEMPERATURE",
  "CELL_IMBALANCE",
  "OVER_CURRENT",
  "UNDER_VOLTAGE",
  "FAULT",
  "RECOVERY",
] as const;

for (const scenario of allScenarios) {
  test(`${scenario} telemetry remains schema-valid`, () => {
    const message = new BatterySimulator(
      "site-001",
      "BAT-001",
      scenario,
    ).step();
    new MessageValidator().validate("telemetry", message);
  });
}

test("normal telemetry is deterministic and remains in a stable range", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "NORMAL");
  const first = simulator.step();
  const second = simulator.step();
  assert.ok(first.battery.soc_pct > 70 && first.battery.soc_pct < 80);
  assert.ok(Math.abs(second.battery.soc_pct - first.battery.soc_pct) < 1);
  assert.equal(first.bms.state, "NORMAL");
  assert.equal(simulator.nextEvent(), undefined);
});

test("CHARGING increases SOC and uses negative current", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "CHARGING");
  const first = simulator.step();
  const second = simulator.step();
  assert.ok(second.battery.soc_pct > first.battery.soc_pct);
  assert.ok(second.battery.pack_current_a < 0);
});

test("DISCHARGING decreases SOC and uses positive current", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "DISCHARGING");
  const first = simulator.step();
  const second = simulator.step();
  assert.ok(second.battery.soc_pct < first.battery.soc_pct);
  assert.ok(second.battery.pack_current_a > 0);
});

test("LOW_SOC enters warning state and emits a LOW_SOC event once", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "LOW_SOC");
  const first = simulator.step();
  assert.ok(first.battery.soc_pct <= 30);
  assert.equal(simulator.nextEvent()?.type, "LOW_SOC");
  assert.equal(simulator.nextEvent(), undefined);
});

test("HIGH_TEMPERATURE raises temperature and emits HIGH_TEMPERATURE once", () => {
  const simulator = new BatterySimulator(
    "site-001",
    "BAT-001",
    "HIGH_TEMPERATURE",
  );
  const first = simulator.step();
  assert.ok(first.battery.temperature_c > 35);
  assert.equal(simulator.nextEvent()?.type, "HIGH_TEMPERATURE");
  assert.equal(simulator.nextEvent(), undefined);
});

test("CELL_IMBALANCE calculates correct imbalance and emits the event once", () => {
  const simulator = new BatterySimulator(
    "site-001",
    "BAT-001",
    "CELL_IMBALANCE",
  );
  const message = simulator.step();
  assert.ok(message.cells.imbalance_v > 0.05);
  assert.ok(message.cells.max_voltage_v > message.cells.min_voltage_v);
  assert.equal(simulator.nextEvent()?.type, "CELL_IMBALANCE");
  assert.equal(simulator.nextEvent(), undefined);
});

test("OVER_CURRENT exceeds the threshold and emits OVER_CURRENT", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "OVER_CURRENT");
  const message = simulator.step();
  assert.ok(message.battery.pack_current_a > 30);
  assert.equal(message.bms.state, "FAULT");
  assert.equal(simulator.nextEvent()?.type, "OVER_CURRENT");
});

test("UNDER_VOLTAGE lowers pack voltage and emits UNDER_VOLTAGE", () => {
  const simulator = new BatterySimulator(
    "site-001",
    "BAT-001",
    "UNDER_VOLTAGE",
  );
  const message = simulator.step();
  assert.ok(message.cells.min_voltage_v <= 3.15);
  assert.ok(message.cells.imbalance_v >= 0);
  assert.equal(simulator.nextEvent()?.type, "UNDER_VOLTAGE");
});

test("FAULT emits BMS_FAULT with a deterministic abnormal combination", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "FAULT");
  const message = simulator.step();
  assert.equal(message.bms.state, "FAULT");
  assert.deepEqual(message.bms.error_flags.includes("OVER_TEMPERATURE"), true);
  assert.equal(simulator.nextEvent()?.type, "BMS_FAULT");
});

test("RECOVERY transitions back toward normal without repeating the same abnormal event", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "RECOVERY");
  const first = simulator.step();
  assert.ok(
    first.battery.temperature_c > 35 ||
      first.battery.soc_pct < 25 ||
      first.cells.imbalance_v > 0.05,
  );
  const recovered = simulator.step();
  assert.ok(recovered.bms.state === "NORMAL" || recovered.battery.soc_pct > 20);
});

test("pack voltage is derived from cells and power equals voltage times current", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "NORMAL");
  const message = simulator.step();
  const sum = message.cells.voltages_v.reduce(
    (total, value) => total + value,
    0,
  );
  assert.equal(message.battery.pack_voltage_v, Number(sum.toFixed(3)));
  assert.equal(
    message.battery.power_w,
    Number(
      (message.battery.pack_voltage_v * message.battery.pack_current_a).toFixed(
        3,
      ),
    ),
  );
});

test("events are emitted once when a threshold is entered", () => {
  const simulator = new BatterySimulator("site-001", "BAT-001", "LOW_SOC");
  simulator.step();
  assert.equal(simulator.nextEvent()?.type, "LOW_SOC");
  assert.equal(simulator.nextEvent(), undefined);
});
