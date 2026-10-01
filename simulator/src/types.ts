export type Scenario = "NORMAL" | "LOW_SOC" | "HIGH_TEMPERATURE" | "CELL_IMBALANCE" | "FAULT";

export interface Telemetry {
  schema_version: "1.0";
  battery_id: string;
  site_id: string;
  timestamp: string;
  battery: { pack_voltage_v: number; pack_current_a: number; soc_pct: number; temperature_c: number; cycles: number };
  cells: { voltages_v: number[]; min_voltage_v: number; max_voltage_v: number; avg_voltage_v: number; imbalance_v: number };
  bms: { state: "NORMAL" | "LOW_SOC" | "WARNING" | "FAULT"; balancing: boolean; error_flags: string[] };
}

export interface BmsEvent {
  schema_version: "1.0";
  event_id: string;
  battery_id: string;
  site_id: string;
  timestamp: string;
  type: "LOW_SOC" | "HIGH_TEMPERATURE" | "LOW_TEMPERATURE" | "CELL_IMBALANCE" | "OVER_VOLTAGE" | "UNDER_VOLTAGE" | "OVER_CURRENT" | "BMS_FAULT";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  value?: number;
  unit?: string;
}

export interface Status {
  schema_version: "1.0";
  battery_id: string;
  site_id: string;
  status: "online" | "offline";
  timestamp: string;
}

