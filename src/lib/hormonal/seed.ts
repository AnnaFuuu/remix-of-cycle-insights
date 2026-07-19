import type { TelemetryEntry, SyntheticCohortRecord } from "./types";

// Demo data removed. Real data must be ingested via the mcPHASES importer
// or logged manually through the Telemetry Log. These stubs remain so
// existing imports don't break.
export function generateSeed(_cycleLength = 28, _lutealLength = 14, _days = 30): TelemetryEntry[] {
  return [];
}

export function generateCohort(_size = 40, _cycleLength = 28, _lutealLength = 14): SyntheticCohortRecord[] {
  return [];
}
