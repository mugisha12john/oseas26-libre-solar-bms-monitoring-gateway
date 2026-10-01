import type { BatteryState } from "../types.js";
import { clamp, derivePackVoltage, round, setCellVoltages } from "./common.js";

export function normalScenario(
  state: BatteryState,
  tick: number,
): BatteryState {
  const socPct = clamp(state.socPct + (tick % 2 === 0 ? 0.08 : -0.05), 70, 82);
  const temperatureC = clamp(
    state.temperatureC + (tick % 3 === 0 ? 0.04 : -0.03),
    31.2,
    34.5,
  );
  const packCurrentA = round(8.5 + Math.sin(tick / 4.5) * 0.75, 2);
  const cellVoltages = setCellVoltages(
    state.cellVoltages.map((cell, index) => {
      const trailing = index === 0 ? 0.0015 : index === 3 ? -0.0012 : 0.0008;
      return round(cell + trailing * (tick % 2 === 0 ? 1 : -1), 3);
    }),
  );

  return {
    ...state,
    socPct,
    temperatureC,
    packCurrentA,
    cellVoltages,
    packVoltageV: derivePackVoltage(cellVoltages),
  };
}
