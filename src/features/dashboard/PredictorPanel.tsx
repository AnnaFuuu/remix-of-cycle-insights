import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { PredictorInput, PredictionResult } from "@/lib/prediction/types";
import { predictPhase } from "@/lib/model/predict.functions";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Activity, User, Sparkles, HelpCircle, Loader2 } from "lucide-react";

type NumericKey = Exclude<keyof PredictorInput, "cramps" | "bloating">;
type OrdinalKey = "cramps" | "bloating";

const ORDINAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "predictor.symptom.veryLow" },
  { value: 2, label: "predictor.symptom.moderate" },
  { value: 3, label: "predictor.symptom.high" },
  { value: 4, label: "predictor.symptom.veryHigh" },
];

const symptomFields: { key: OrdinalKey; label: string }[] = [
  { key: "cramps", label: "predictor.cramps" },
  { key: "bloating", label: "predictor.bloating" },
];

interface FieldSpec {
  key: NumericKey;
  label: string;
  unit?: string;
  placeholder?: string;
  step?: string;
  allowNA: boolean;
  info?: string;
}

const demographics: FieldSpec[] = [
  { key: "age", label: "predictor.age", unit: "years", placeholder: "e.g. 29", allowNA: false },
  { key: "bmi", label: "predictor.bmi", unit: "kg/m²", placeholder: "e.g. 22.4", step: "0.1", allowNA: true },
];

const endocrine: FieldSpec[] = [
  { key: "lh", label: "predictor.lh", unit: "mIU/mL", placeholder: "e.g. 12.3", step: "0.1", allowNA: true },
  { key: "estradiol", label: "predictor.estradiol", unit: "pg/mL", placeholder: "e.g. 180", step: "0.1", allowNA: true },
];

const wearable: FieldSpec[] = [
  { key: "wristTempDelta", label: "predictor.wristTempDelta", unit: "°C vs baseline", placeholder: "e.g. +0.35", step: "0.01", allowNA: true },
  { key: "restingHR", label: "predictor.restingHR", unit: "bpm", placeholder: "e.g. 62", allowNA: true, info: "resting heart rate" },
  { key: "hrv", label: "predictor.hrv", unit: "ms", placeholder: "e.g. 48", allowNA: true, info: "Heart rate variability (HRV) is the variation in the beat-to-beat interval. These include 5 minute granularity recordings of your HRV during a sleep." },
  { key: "respiratoryRate", label: "predictor.respRate", unit: "br/min", placeholder: "e.g. 15", step: "0.1", allowNA: true },
  { key: "sleepScore", label: "predictor.sleepScore", unit: "0–100", placeholder: "e.g. 78", allowNA: true },
  { key: "sleepDuration", label: "predictor.sleepDuration", unit: "hours", placeholder: "e.g. 7.5", step: "0.1", allowNA: true },
  { key: "stressScore", label: "predictor.stressScore", unit: "0–100", placeholder: "e.g. 32", allowNA: true },
  { key: "glucose", label: "predictor.glucose", unit: "mmol/L", placeholder: "e.g. 5.4", step: "0.1", allowNA: true },
];

const EMPTY: PredictorInput = {
  age: 0,
  bmi: null,
  wristTempDelta: null,
  lh: null,
  estradiol: null,
  restingHR: null,
  hrv: null,
  respiratoryRate: null,
  sleepScore: null,
  sleepDuration: null,
  stressScore: null,
  glucose: null,
  cramps: null,
  bloating: null,
};

type FieldState = { value: string; na: boolean };

function initialState(): Record<NumericKey, FieldState> {
  const s = {} as Record<NumericKey, FieldState>;
  [...demographics, ...endocrine, ...wearable].forEach((f) => {
    s[f.key] = { value: "", na: false };
  });
  return s;
}

export function PredictorPanel() {
  const { t } = useI18n();
  const [fields, setFields] = React.useState<Record<NumericKey, FieldState>>(() => initialState());
  const [symptoms, setSymptoms] = React.useState<Record<OrdinalKey, number | "na" | "">>({
    cramps: "",
    bloating: "",
  });
  const [submitted, setSubmitted] = React.useState<PredictorInput | null>(null);
  const [result, setResult] = React.useState<PredictionResult | null>(null);
  const [predicting, setPredicting] = React.useState(false);
  const [predictError, setPredictError] = React.useState<string | null>(null);
  const runPredict = useServerFn(predictPhase);

  const setValue = (k: NumericKey, v: string) =>
    setFields((prev) => ({ ...prev, [k]: { ...prev[k], value: v } }));
  const setNA = (k: NumericKey, na: boolean) =>
    setFields((prev) => ({ ...prev, [k]: { value: na ? "" : prev[k].value, na } }));

  const ageValid = fields.age.value !== "" && !Number.isNaN(Number(fields.age.value));

  const buildPayload = (): PredictorInput => {
    const out: PredictorInput = { ...EMPTY };
    for (const f of [...demographics, ...endocrine, ...wearable]) {
      const s = fields[f.key];
      const num = s.na || s.value === "" ? null : Number(s.value);
      (out as unknown as Record<string, number | null>)[f.key] =
        num !== null && Number.isNaN(num) ? null : num;
    }
    out.age = Number(fields.age.value);
    for (const s of symptomFields) {
      const v = symptoms[s.key];
      out[s.key] = v === "" || v === "na" ? null : v;
    }
    return out;
  };

  const onPredict = async () => {
    if (!ageValid) return;
    const payload = buildPayload();
    setSubmitted(payload);
    setResult(null);
    setPredictError(null);
    setPredicting(true);
    try {
      const r = await runPredict({ data: payload });
      setResult(r);
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : String(e));
    } finally {
      setPredicting(false);
    }
  };

  const onReset = () => {
    setFields(initialState());
    setSymptoms({ cramps: "", bloating: "" });
    setSubmitted(null);
    setResult(null);
    setPredictError(null);
  };

  const lhOrE2Missing =
    submitted && (submitted.lh === null || submitted.estradiol === null);

  return (
    <div className="px-6 pt-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("predictor.title")}
              </CardTitle>
              <CardDescription className="mt-1">{t("predictor.desc")}</CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0">
              {t("predictor.stage.badge")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldGroup
            icon={<User className="h-4 w-4" />}
            title={t("predictor.group.demographics")}
            fields={demographics}
            fieldsState={fields}
            setValue={setValue}
            setNA={setNA}
            t={t}
          />

          <FieldGroup
            icon={<FlaskConical className="h-4 w-4" />}
            title={t("predictor.group.endocrine")}
            subtitle={t("predictor.group.endocrine.sub")}
            tint="endocrine"
            fields={endocrine}
            fieldsState={fields}
            setValue={setValue}
            setNA={setNA}
            t={t}
          />

          <FieldGroup
            icon={<Activity className="h-4 w-4" />}
            title={t("predictor.group.wearable")}
            fields={wearable}
            fieldsState={fields}
            setValue={setValue}
            setNA={setNA}
            t={t}
          />

          <div className="rounded-lg border border-border/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-primary"><Sparkles className="h-4 w-4" /></span>
              <span className="text-sm font-semibold text-foreground">{t("predictor.group.symptoms")}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {symptomFields.map((f) => {
                const v = symptoms[f.key];
                const isNA = v === "na";
                return (
                  <div key={f.key} className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t(f.label as never)}
                    </Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ORDINAL_OPTIONS.map((o) => {
                        const selected = v === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              setSymptoms((prev) => ({ ...prev, [f.key]: o.value }))
                            }
                            disabled={isNA}
                            className={
                              "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                              (selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/60 bg-background hover:bg-muted") +
                              (isNA ? " opacity-50" : "")
                            }
                          >
                            {t(o.label as never)}
                          </button>
                        );
                      })}
                      <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={isNA}
                          onCheckedChange={(c) =>
                            setSymptoms((prev) => ({
                              ...prev,
                              [f.key]: c ? "na" : "",
                            }))
                          }
                        />
                        N/A
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
            <Button onClick={onPredict} disabled={!ageValid}>
              {t("predictor.predict")}
            </Button>
            <Button variant="ghost" onClick={onReset}>
              {t("predictor.reset")}
            </Button>
            {!ageValid && (
              <span className="text-xs text-muted-foreground">{t("predictor.ageRequired")}</span>
            )}
          </div>

          {submitted && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("predictor.result.title")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lhOrE2Missing ? t("predictor.result.impute") : t("predictor.result.direct")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{t("predictor.result.pending")}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  {t("predictor.result.payload")}
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-3 text-[11px] leading-relaxed">
{JSON.stringify(submitted, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FieldGroup({
  icon,
  title,
  subtitle,
  tint,
  fields,
  fieldsState,
  setValue,
  setNA,
  t,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tint?: "endocrine";
  fields: FieldSpec[];
  fieldsState: Record<NumericKey, FieldState>;
  setValue: (k: NumericKey, v: string) => void;
  setNA: (k: NumericKey, na: boolean) => void;
  t: (k: never) => string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        tint === "endocrine"
          ? "rounded-lg border border-primary/20 bg-primary/5 p-4"
          : "rounded-lg border border-border/50 p-4"
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const s = fieldsState[f.key];
          return (
            <FieldInput
              key={f.key}
              f={f}
              s={s}
              setValue={setValue}
              setNA={setNA}
              t={t}
            />
          );
        })}
        {children}
      </div>
    </div>
  );
}

function FieldInput({
  f,
  s,
  setValue,
  setNA,
  t,
}: {
  f: FieldSpec;
  s: FieldState;
  setValue: (k: NumericKey, v: string) => void;
  setNA: (k: NumericKey, na: boolean) => void;
  t: (k: never) => string;
}) {
  const [showInfo, setShowInfo] = React.useState(false);
  const infoRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!showInfo) return;
    const onDocClick = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showInfo]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {t(f.label as never)}
          {f.unit && <span className="ml-1 opacity-60">({f.unit})</span>}
          {!f.allowNA && <span className="ml-1 text-destructive">*</span>}
          {f.info && (
            <span ref={infoRef} className="relative">
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="ml-1 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="More info"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
              {showInfo && (
                <span className="absolute left-full top-1/2 z-10 ml-1.5 w-max max-w-[16rem] -translate-y-1/2 rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                  {f.info}
                </span>
              )}
            </span>
          )}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step={f.step ?? "1"}
          placeholder={s.na ? "N/A" : f.placeholder}
          value={s.value}
          disabled={s.na}
          onChange={(e) => setValue(f.key, e.target.value)}
          className="h-9"
        />
        {f.allowNA && (
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={s.na}
              onCheckedChange={(c) => setNA(f.key, Boolean(c))}
            />
            N/A
          </label>
        )}
      </div>
    </div>
  );
}