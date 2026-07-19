import type { LabPanel, LabAssay, LabAnalyte, WearableSample } from "./types";

// Demo data removed. Lab panels and wearable samples now come only from
// real ingestion (mcPHASES importer or future wearable connectors).
export function seedLabPanels(_cycleLength = 28, _lutealLength = 14): LabPanel[] {
  return [];
}

export function seedWearableSeries(_days = 120, _cycleLength = 28, _lutealLength = 14): WearableSample[] {
  return [];
}

export function panelAssay(panel: LabPanel, a: LabAnalyte): LabAssay | undefined {
  return panel.assays.find((x) => x.analyte === a);
}
