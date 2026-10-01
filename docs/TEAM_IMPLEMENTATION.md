# Team implementation guide

Work in phases: keep Mosquitto + simulator passing before adding a consumer.
Any new BMS producer must emit the schemas unchanged. Add tests for every new
state or field and never introduce a Home Assistant/Prospect/MPM-specific BMS
payload.

Prospect should subscribe to telemetry and events for time-series history,
including SOC, pack measurements, cells, imbalance, BMS state, and events.
MPM should use filtered/downsampled telemetry (SOC, cycles, imbalance,
maximum temperature and last seen) plus full event history. It must not be a
high-frequency telemetry sink.

