import type { BmsEvent, Scenario, Status, Telemetry } from "./types.js";

const timestamp = (): string => new Date().toISOString();
const round = (value: number, places = 3): number => Number(value.toFixed(places));

export class BatterySimulator {
  private socPct: number;
  private temperatureC: number;
  private cellVoltages: number[];
  private tick = 0;
  private eventEmitted = false;
  readonly cycles = 324;

  constructor(readonly siteId: string, readonly batteryId: string, readonly scenario: Scenario = "NORMAL") {
    this.socPct = scenario === "LOW_SOC" ? 19.5 : 78.4;
    this.temperatureC = scenario === "HIGH_TEMPERATURE" ? 41.5 : 32.4;
    this.cellVoltages = [3.234, 3.236, 3.238, 3.24];
    if (scenario === "CELL_IMBALANCE") this.cellVoltages[3] = 3.31;
  }

  step(): Telemetry {
    this.tick += 1;
    if (this.scenario === "NORMAL") {
      this.socPct = Math.max(0, this.socPct - 0.04);
      this.temperatureC += this.tick % 2 ? 0.03 : -0.02;
    } else if (this.scenario === "LOW_SOC") {
      this.socPct = Math.max(0, this.socPct - 0.15);
      this.temperatureC = 31.5;
    } else if (this.scenario === "HIGH_TEMPERATURE") {
      this.temperatureC = Math.min(46, this.temperatureC + 0.8);
      this.socPct = Math.max(0, this.socPct - 0.03);
    } else if (this.scenario === "CELL_IMBALANCE") {
      this.cellVoltages[3] = Math.min(3.42, this.cellVoltages[3] + 0.006);
      this.socPct = Math.max(0, this.socPct - 0.03);
    } else {
      this.socPct = Math.max(0, this.socPct - 0.01);
    }

    const voltages = this.cellVoltages.map((value) => round(value));
    const minimum = Math.min(...voltages);
    const maximum = Math.max(...voltages);
    const average = voltages.reduce((sum, value) => sum + value, 0) / voltages.length;
    const { state, error_flags: errorFlags } = this.state();
    return {
      schema_version: "1.0", battery_id: this.batteryId, site_id: this.siteId, timestamp: timestamp(),
      battery: { pack_voltage_v: round(voltages.reduce((sum, value) => sum + value, 0)), pack_current_a: this.scenario === "FAULT" ? 0 : round(8.4 + (this.tick % 4) * 0.1, 2), soc_pct: round(this.socPct, 2), temperature_c: round(this.temperatureC, 2), cycles: this.cycles },
      cells: { voltages_v: voltages, min_voltage_v: minimum, max_voltage_v: maximum, avg_voltage_v: round(average), imbalance_v: round(maximum - minimum) },
      bms: { state, balancing: this.scenario === "CELL_IMBALANCE", error_flags: errorFlags }
    };
  }

  nextEvent(): BmsEvent | undefined {
    if (this.eventEmitted || this.scenario === "NORMAL") return undefined;
    this.eventEmitted = true;
    const definitions: Record<Exclude<Scenario, "NORMAL">, [BmsEvent["type"], BmsEvent["severity"], string, number | undefined, string | undefined]> = {
      LOW_SOC: ["LOW_SOC", "WARNING", "Battery state of charge is below the warning threshold", this.socPct, "%"],
      HIGH_TEMPERATURE: ["HIGH_TEMPERATURE", "WARNING", "Battery temperature exceeded warning threshold", this.temperatureC, "°C"],
      CELL_IMBALANCE: ["CELL_IMBALANCE", "WARNING", "Cell voltage imbalance exceeded warning threshold", Math.max(...this.cellVoltages) - Math.min(...this.cellVoltages), "V"],
      FAULT: ["BMS_FAULT", "CRITICAL", "BMS reported a simulated protection fault", undefined, undefined]
    };
    const [type, severity, message, value, unit] = definitions[this.scenario];
    return { schema_version: "1.0", event_id: `sim-${this.scenario.toLowerCase()}-${String(this.tick).padStart(4, "0")}`, battery_id: this.batteryId, site_id: this.siteId, timestamp: timestamp(), type, severity, message, ...(value === undefined ? {} : { value: round(value), unit }) };
  }

  status(status: Status["status"]): Status {
    return { schema_version: "1.0", battery_id: this.batteryId, site_id: this.siteId, status, timestamp: timestamp() };
  }

  private state(): Pick<Telemetry["bms"], "state" | "error_flags"> {
    if (this.scenario === "LOW_SOC") return { state: "LOW_SOC", error_flags: [] };
    if (this.scenario === "HIGH_TEMPERATURE" || this.scenario === "CELL_IMBALANCE") return { state: "WARNING", error_flags: [] };
    if (this.scenario === "FAULT") return { state: "FAULT", error_flags: ["SIMULATED_PROTECTION_FAULT"] };
    return { state: "NORMAL", error_flags: [] };
  }
}

