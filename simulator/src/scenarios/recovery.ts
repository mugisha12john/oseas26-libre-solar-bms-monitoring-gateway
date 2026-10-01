import type { BatteryState } from "../types.js";
import { clamp, derivePackVoltage, round, setCellVoltages } from "./common.js";

export function recoveryScenario(
  state: BatteryState,
  tick: number,
): BatteryState {
  const socPct = clamp(state.socPct + 3.6, 12, 80);
  const temperatureC = clamp(state.temperatureC - 2.5, 28, 46);
  const packCurrentA = round(
    (tick % 3 === 0 ? 6.5 : 2.5) * (tick % 2 === 0 ? -1 : 1),
    2,
  );
  const cellVoltages = setCellVoltages(
    state.cellVoltages.map((cell, index) => {
      if (index === 3)
        return round(cell - 0.02 + (tick % 2 === 0 ? 0.008 : 0), 3);
      return round(cell + 0.016, 3);
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
