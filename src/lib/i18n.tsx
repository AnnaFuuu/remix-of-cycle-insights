import * as React from "react";

export type Locale = "en" | "zh";

type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "Cycloscope · research-grade hormonal telemetry",
  "app.footer": "Research infrastructure, not a diagnostic tool.",
  "app.workspace": "Workspace",
  "app.brand.sub": "Hormonal telemetry",

  "nav.dashboard": "Dashboard",
  "nav.telemetry": "Telemetry Log",
  "nav.analytics": "Analytics",
  "nav.research": "Research Portal",
  "nav.settings": "Settings",

  "lang.label": "Language",
  "lang.en": "English",
  "lang.zh": "中文",

  // Dashboard
  "dash.eyebrow": "Dashboard",
  "dash.title": "Physiological snapshot",
  "dash.desc": "Cycle-aware telemetry console with phase-shaded trend visualization.",
  "dash.cycleDay": "Cycle day",
  "dash.phase": "Phase",
  "dash.bbt7": "BBT · 7d avg",
  "dash.bbt.latest": "Latest",
  "dash.mood7": "Mood · 7d",
  "dash.sleep7": "Sleep quality · 7d",
  "dash.vsPrior": "vs prior week",

  // Insights
  "insights.title": "Copilot proactive insights",
  "insights.sub": "Auto-generated from your telemetry vs. population baseline.",
  "insights.ask": "Ask Copilot →",

  // Telemetry
  "tel.eyebrow": "Telemetry",
  "tel.title": "Daily telemetry log",
  "tel.desc": "Structured capture of subjective state, objective measurements, and optional biomarker overrides.",
  "tel.new": "New entry",
  "tel.filter.phase": "Phase",
  "tel.filter.symptoms": "Symptoms",

  // NL log
  "nl.title": "Log with natural language",
  "nl.placeholder": 'e.g. "slept 6h poorly, bad cramps 7/10, mood 4, headache came back"',
  "nl.parse": "Parse",
  "nl.proposed": "Proposed entry",
  "nl.confidence": "confidence",
  "nl.discard": "Discard",
  "nl.approve": "Approve & save",
  "nl.parsed.ok": "Entry created from natural language",
  "nl.parsed.err": "Copilot couldn't parse that entry",

  // Copilot
  "copilot.title": "Cycle Copilot",
  "copilot.sub": "Cycle-aware · tool-using · on-device data",
  "copilot.new": "New conversation",
  "copilot.close": "Close",
  "copilot.starters": "Try a starter prompt",
  "copilot.thinking": "Thinking…",
  "copilot.placeholder": "Ask about your cycle, symptoms, correlations, baselines…",
  "copilot.disclaimer": "Not a medical device. Data stays on-device except this chat request.",
  "copilot.prompt.1": "Summarize my last 14 days of telemetry.",
  "copilot.prompt.2": "How does my mood correlate with sleep quality?",
  "copilot.prompt.3": "Flag any anomalies in my recent entries.",
  "copilot.prompt.4": "What phase am I in and what's typical for it?",
};

const zh: Dict = {
  "app.tagline": "Cycloscope · 科研级激素遥测",
  "app.footer": "本工具用于研究，非诊断设备。",
  "app.workspace": "工作区",
  "app.brand.sub": "激素遥测",

  "nav.dashboard": "仪表盘",
  "nav.telemetry": "遥测记录",
  "nav.analytics": "数据分析",
  "nav.research": "研究门户",
  "nav.settings": "设置",

  "lang.label": "语言",
  "lang.en": "English",
  "lang.zh": "中文",

  "dash.eyebrow": "仪表盘",
  "dash.title": "生理状态快照",
  "dash.desc": "结合周期相位阴影的趋势可视化控制台。",
  "dash.cycleDay": "周期第几天",
  "dash.phase": "相位",
  "dash.bbt7": "基础体温 · 7 日均值",
  "dash.bbt.latest": "最新",
  "dash.mood7": "情绪 · 7 日",
  "dash.sleep7": "睡眠质量 · 7 日",
  "dash.vsPrior": "较上周",

  "insights.title": "Copilot 主动洞察",
  "insights.sub": "基于你的遥测数据与群体基线自动生成。",
  "insights.ask": "咨询 Copilot →",

  "tel.eyebrow": "遥测",
  "tel.title": "每日遥测记录",
  "tel.desc": "结构化记录主观状态、客观测量与可选的生物标志物。",
  "tel.new": "新增记录",
  "tel.filter.phase": "相位",
  "tel.filter.symptoms": "症状",

  "nl.title": "用自然语言记录",
  "nl.placeholder": '例如：“昨晚只睡了 6 小时且质量差，痛经 7/10，情绪 4，头痛又来了”',
  "nl.parse": "解析",
  "nl.proposed": "建议的记录",
  "nl.confidence": "置信度",
  "nl.discard": "放弃",
  "nl.approve": "确认并保存",
  "nl.parsed.ok": "已由自然语言创建记录",
  "nl.parsed.err": "Copilot 无法解析该输入",

  "copilot.title": "周期 Copilot",
  "copilot.sub": "感知相位 · 可调用工具 · 数据在本地",
  "copilot.new": "新对话",
  "copilot.close": "关闭",
  "copilot.starters": "试试这些起始问题",
  "copilot.thinking": "思考中…",
  "copilot.placeholder": "问我关于周期、症状、相关性、基线的问题…",
  "copilot.disclaimer": "非医疗设备。除本次对话外，数据仅存于设备本地。",
  "copilot.prompt.1": "总结我最近 14 天的遥测数据。",
  "copilot.prompt.2": "我的情绪与睡眠质量的相关性如何？",
  "copilot.prompt.3": "在我近期的记录中标出任何异常。",
  "copilot.prompt.4": "我现在处于哪个相位？该相位常见的表现是什么？",
};

const dicts: Record<Locale, Dict> = { en, zh };

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof en) => string;
}

const I18nCtx = React.createContext<Ctx | null>(null);
const STORAGE_KEY = "hnhh.locale.v1";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "en" || saved === "zh") setLocaleState(saved);
      else if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) setLocaleState("zh");
    } catch { /* ignore */ }
  }, []);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = React.useCallback((key: keyof typeof en) => dicts[locale][key] ?? en[key] ?? String(key), [locale]);

  return <I18nCtx.Provider value={{ locale, setLocale, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = React.useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}