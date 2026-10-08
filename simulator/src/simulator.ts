import { scenarioHandlers } from "./scenarios/index.js";
import type {
  BatteryState,
  BmsEvent,
  Scenario,
  Status,
  Telemetry,
} from "./types.js";
import { cellMetrics, round } from "./scenarios/common.js";

const timestamp = (): string => new Date().toISOString();

export class BatterySimulator {
  private readonly cycles = 324;
  private tick = 0;
  private state: BatteryState;
  private eventFlags = new Set<string>();
  private scenarioValue: Scenario;

  constructor(
    readonly siteId: string,
    readonly batteryId: string,
    scenario: Scenario = "NORMAL",
  ) {
    this.scenarioValue = scenario;
    const defaultCellVoltages = [3.234, 3.236, 3.238, 3.24];
    this.state = {
      socPct:
        scenario === "LOW_SOC"
          ? 30
          : scenario === "HIGH_TEMPERATURE"
            ? 72
            : scenario === "CELL_IMBALANCE"
              ? 76
              : scenario === "FAULT"
                ? 15
                : scenario === "RECOVERY"
                  ? 18
                  : scenario === "CHARGING"
                    ? 55
                    : scenario === "DISCHARGING"
                      ? 75
                      : scenario === "OVER_CURRENT"
                        ? 68
                        : scenario === "UNDER_VOLTAGE"
                          ? 70
                          : 78.5,
      temperatureC:
        scenario === "HIGH_TEMPERATURE"
          ? 41.5
          : scenario === "FAULT"
            ? 48
            : scenario === "RECOVERY"
              ? 45
              : 32.4,
      packCurrentA:
        scenario === "CHARGING"
          ? -12.5
          : scenario === "DISCHARGING"
            ? 8.5
            : scenario === "OVER_CURRENT"
              ? 35
              : scenario === "UNDER_VOLTAGE"
                ? 8.2
                : 8.5,
      packVoltageV: defaultCellVoltages.reduce((sum, cell) => sum + cell, 0),
      cellVoltages: [...defaultCellVoltages],
      cycles: this.cycles,
    };
  }

  get scenario(): Scenario {
    return this.scenarioValue;
  }

  setScenario(scenario: Scenario): void {
    this.scenarioValue = scenario;
    this.eventFlags.clear();
  }

  step(): Telemetry {
    this.tick += 1;
    this.state = scenarioHandlers[this.scenario](this.state, this.tick);
    const metrics = cellMetrics(this.state.cellVoltages);
    const { state, error_flags: errorFlags } = this.bmsState(metrics);

    return {
      schema_version: "1.0",
      battery_id: this.batteryId,
      site_id: this.siteId,
      timestamp: timestamp(),
      battery: {
        pack_voltage_v: round(this.state.packVoltageV, 3),
        pack_current_a: round(this.state.packCurrentA, 3),
        power_w: round(this.state.packVoltageV * this.state.packCurrentA, 3),
        soc_pct: round(this.state.socPct, 2),
        temperature_c: round(this.state.temperatureC, 2),
        soh_percent: round(Math.max(0, 100 - this.cycles * 0.02), 2),
        cycle_count: this.cycles,
        cycles: this.cycles,
      },
      cells: metrics,
      bms: {
        state,
        balancing:
          this.scenario === "CELL_IMBALANCE" || this.scenario === "RECOVERY"
            ? metrics.imbalance_v > 0.02
            : false,
        error_flags: errorFlags,
      },
    };
  }

  nextEvent(): BmsEvent | undefined {
    const metrics = cellMetrics(this.state.cellVoltages);
    const imbalance = metrics.imbalance_v;
    const minCellVoltage = metrics.min_voltage_v;
    const maxCellVoltage = metrics.max_voltage_v;
    const current = this.state.packCurrentA;
    const lowSocThreshold = this.state.socPct <= 30;
    const temperatureThreshold = this.state.temperatureC >= 35;
    const overCurrentThreshold = current >= 30;
    const underVoltageThreshold = minCellVoltage <= 3.15;
    const faultThreshold =
      this.state.socPct <= 20 ||
      this.state.temperatureC >= 45 ||
      imbalance >= 0.08 ||
      this.scenario === "FAULT";

    if (this.scenario === "NORMAL") return undefined;
    if (
      this.scenario === "LOW_SOC" &&
      lowSocThreshold &&
      !this.eventFlags.has("LOW_SOC")
    ) {
      this.eventFlags.add("LOW_SOC");
      return this.makeEvent(
        "LOW_SOC",
        "WARNING",
        "Battery state of charge is below the warning threshold",
        this.state.socPct,
        "%",
      );
    }
    if (
      this.scenario === "HIGH_TEMPERATURE" &&
      temperatureThreshold &&
      !this.eventFlags.has("HIGH_TEMPERATURE")
    ) {
      this.eventFlags.add("HIGH_TEMPERATURE");
      return this.makeEvent(
        "HIGH_TEMPERATURE",
        "WARNING",
        "Battery temperature exceeded warning threshold",
        this.state.temperatureC,
        "°C",
      );
    }
    if (
      this.scenario === "CELL_IMBALANCE" &&
      imbalance >= 0.05 &&
      !this.eventFlags.has("CELL_IMBALANCE")
    ) {
      this.eventFlags.add("CELL_IMBALANCE");
      return this.makeEvent(
        "CELL_IMBALANCE",
        "WARNING",
        "Cell voltage imbalance exceeded warning threshold",
        imbalance,
        "V",
      );
    }
    if (
      this.scenario === "OVER_CURRENT" &&
      overCurrentThreshold &&
      !this.eventFlags.has("OVER_CURRENT")
    ) {
      this.eventFlags.add("OVER_CURRENT");
      return this.makeEvent(
        "OVER_CURRENT",
        "CRITICAL",
        "Pack current exceeded the configured over-current threshold",
        current,
        "A",
      );
    }
    if (
      this.scenario === "UNDER_VOLTAGE" &&
      underVoltageThreshold &&
      !this.eventFlags.has("UNDER_VOLTAGE")
    ) {
      this.eventFlags.add("UNDER_VOLTAGE");
      return this.makeEvent(
        "UNDER_VOLTAGE",
        "WARNING",
        "Pack voltage fell below the configured under-voltage threshold",
        minCellVoltage,
        "V",
      );
    }
    if (
      this.scenario === "FAULT" &&
      faultThreshold &&
      !this.eventFlags.has("BMS_FAULT")
    ) {
      this.eventFlags.add("BMS_FAULT");
      return this.makeEvent(
        "BMS_FAULT",
        "CRITICAL",
        "BMS reported a simulated protection fault",
        undefined,
        undefined,
      );
    }
    if (
      this.scenario === "RECOVERY" &&
      this.state.socPct > 25 &&
      this.state.temperatureC < 35 &&
      imbalance < 0.02 &&
      !this.eventFlags.has("RECOVERY")
    ) {
      this.eventFlags.add("RECOVERY");
      return undefined;
    }
    return undefined;
  }

  status(status: Status["status"]): Status {
    return {
      schema_version: "1.0",
      battery_id: this.batteryId,
      site_id: this.siteId,
      status,
      timestamp: timestamp(),
      last_seen: timestamp(),
    };
  }

  private makeEvent(
    type: BmsEvent["type"],
    severity: BmsEvent["severity"],
    message: string,
    value?: number,
    unit?: string,
  ): BmsEvent {
    const event: BmsEvent = {
      schema_version: "1.0",
      event_id: `sim-${this.scenario.toLowerCase()}-${String(this.tick).padStart(4, "0")}`,
      battery_id: this.batteryId,
      site_id: this.siteId,
      timestamp: timestamp(),
      type,
      severity,
      message,
    };
    if (value !== undefined) event.value = round(value, 3);
    if (unit) event.unit = unit;
    return event;
  }

  private bmsState(
    metrics: ReturnType<typeof cellMetrics>,
  ): Pick<Telemetry["bms"], "state" | "error_flags"> {
    const imbalance = metrics.imbalance_v;
    const lowSoc = this.state.socPct <= 30;
    const hot = this.state.temperatureC >= 35;
    const overCurrent = this.state.packCurrentA >= 30;
    const underVoltage = metrics.min_voltage_v <= 3.15;
    const fault =
      this.state.socPct <= 20 ||
      this.state.temperatureC >= 45 ||
      imbalance >= 0.08 ||
      this.scenario === "FAULT";

    if (this.scenario === "FAULT" || fault)
      return {
        state: "FAULT",
        error_flags: ["OVER_TEMPERATURE", "CELL_VOLTAGE_FAULT", "LOW_SOC"],
      };
    if (lowSoc) return { state: "LOW_SOC", error_flags: ["LOW_SOC"] };
    if (overCurrent)
      return {
        state: "FAULT",
        error_flags: ["OVER_CURRENT", "HIGH_TEMPERATURE"],
      };
    if (underVoltage)
      return { state: "WARNING", error_flags: ["UNDER_VOLTAGE"] };
    if (hot || imbalance >= 0.05)
      return { state: "WARNING", error_flags: ["HIGH_TEMPERATURE"] };
    return { state: "NORMAL", error_flags: [] };
  }
}
