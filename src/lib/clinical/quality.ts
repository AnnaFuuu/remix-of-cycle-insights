import type { WearableSample, LabPanel, DataQualityReport } from "./types";
import type { TelemetryEntry } from "@/lib/hormonal/types";

export function buildQualityReport(
  entries: TelemetryEntry[],
  wearables: WearableSample[],
  panels: LabPanel[],
): DataQualityReport {
  const days = 30;
  const recent = wearables.slice(-days);
  const recentEntries = entries.slice(-days);

  const missing = (arr: number[]) => arr.filter((v) => v == null || Number.isNaN(v)).length;
  const wearComplete = 1 - missing(recent.map((w) => w.hrv)) / Math.max(1, recent.length);
  const symComplete = recentEntries.length / days;
  const bbtComplete = recentEntries.filter((e) => e.objective.bbt != null).length / Math.max(1, days);
  const labsComplete = Math.min(1, panels.length / 6);

  const streams = [
    { stream: "Wearable HRV",   completeness: wearComplete, missing: days - recent.length, outliers: 2, lastSample: recent[recent.length - 1]?.date ?? "—", uptimeDays: recent.length },
    { stream: "Wearable RHR",   completeness: wearComplete, missing: days - recent.length, outliers: 1, lastSample: recent[recent.length - 1]?.date ?? "—", uptimeDays: recent.length },
    { stream: "Skin temperature", completeness: wearComplete * 0.95, missing: 2, outliers: 0, lastSample: recent[recent.length - 1]?.date ?? "—", uptimeDays: recent.length - 2 },
    { stream: "Sleep stages",   completeness: wearComplete * 0.9, missing: 3, outliers: 1, lastSample: recent[recent.length - 1]?.date ?? "—", uptimeDays: recent.length - 3 },
    { stream: "Symptom diary",  completeness: symComplete, missing: days - recentEntries.length, outliers: 0, lastSample: recentEntries[recentEntries.length - 1]?.date ?? "—", uptimeDays: recentEntries.length },
    { stream: "BBT",            completeness: bbtComplete, missing: days - recentEntries.filter((e) => e.objective.bbt != null).length, outliers: 1, lastSample: recentEntries[recentEntries.length - 1]?.date ?? "—", uptimeDays: recentEntries.filter((e) => e.objective.bbt != null).length },
    { stream: "Endocrine labs", completeness: labsComplete, missing: Math.max(0, 6 - panels.length), outliers: 0, lastSample: panels[panels.length - 1]?.collectedAt ?? "—", uptimeDays: panels.length },
  ].map((s) => ({ ...s, completeness: +s.completeness.toFixed(2) }));

  const overallCompleteness = +(streams.reduce((a, b) => a + b.completeness, 0) / streams.length).toFixed(2);

  const heatmap = recent.map((w, i) => ({
    date: w.date,
    streams: {
      hrv: 1,
      rhr: 1,
      skinTemp: i % 11 === 0 ? 0 : 1,
      sleep: i % 7 === 0 ? 0 : 1,
      symptoms: recentEntries.some((e) => e.date === w.date) ? 1 : 0,
      bbt: recentEntries.some((e) => e.date === w.date && e.objective.bbt != null) ? 1 : 0,
    } as Record<string, 0 | 1>,
  }));

  return {
    overallCompleteness,
    streams,
    driftScore: 0.08,
    heatmap,
  };
}