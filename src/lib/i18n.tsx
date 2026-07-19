import * as React from "react";

export type Locale = "en" | "zh" | "fr" | "it" | "de";

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

const fr: Dict = {
  "app.tagline": "Cycloscope · télémétrie hormonale de niveau recherche",
  "app.footer": "Infrastructure de recherche, pas un outil de diagnostic.",
  "app.workspace": "Espace de travail",
  "app.brand.sub": "Télémétrie hormonale",

  "nav.dashboard": "Tableau de bord",
  "nav.telemetry": "Journal de télémétrie",
  "nav.analytics": "Analytique",
  "nav.research": "Portail de recherche",
  "nav.settings": "Paramètres",

  "lang.label": "Langue",
  "lang.en": "English",
  "lang.zh": "中文",

  "dash.eyebrow": "Tableau de bord",
  "dash.title": "Aperçu physiologique",
  "dash.desc": "Console de télémétrie sensible au cycle avec visualisation des tendances par phase.",
  "dash.cycleDay": "Jour du cycle",
  "dash.phase": "Phase",
  "dash.bbt7": "TCB · moy. 7 j",
  "dash.bbt.latest": "Dernier",
  "dash.mood7": "Humeur · 7 j",
  "dash.sleep7": "Qualité du sommeil · 7 j",
  "dash.vsPrior": "vs semaine précédente",

  "insights.title": "Insights proactifs du Copilot",
  "insights.sub": "Générés à partir de vos données comparées à la référence.",
  "insights.ask": "Demander au Copilot →",

  "tel.eyebrow": "Télémétrie",
  "tel.title": "Journal quotidien",
  "tel.desc": "Capture structurée de l'état subjectif, des mesures objectives et des biomarqueurs.",
  "tel.new": "Nouvelle entrée",
  "tel.filter.phase": "Phase",
  "tel.filter.symptoms": "Symptômes",

  "nl.title": "Enregistrer en langage naturel",
  "nl.placeholder": 'ex. « 6h de sommeil médiocre, fortes crampes 7/10, humeur 4, migraine »',
  "nl.parse": "Analyser",
  "nl.proposed": "Entrée proposée",
  "nl.confidence": "confiance",
  "nl.discard": "Ignorer",
  "nl.approve": "Approuver et enregistrer",
  "nl.parsed.ok": "Entrée créée depuis le langage naturel",
  "nl.parsed.err": "Le Copilot n'a pas pu analyser cette entrée",

  "copilot.title": "Copilot du cycle",
  "copilot.sub": "Sensible au cycle · utilise des outils · données locales",
  "copilot.new": "Nouvelle conversation",
  "copilot.close": "Fermer",
  "copilot.starters": "Essayez une amorce",
  "copilot.thinking": "Réflexion…",
  "copilot.placeholder": "Posez une question sur votre cycle, symptômes, corrélations…",
  "copilot.disclaimer": "Pas un dispositif médical. Données locales sauf cette requête.",
  "copilot.prompt.1": "Résume mes 14 derniers jours de télémétrie.",
  "copilot.prompt.2": "Quelle est la corrélation entre mon humeur et mon sommeil ?",
  "copilot.prompt.3": "Signale toute anomalie dans mes entrées récentes.",
  "copilot.prompt.4": "Dans quelle phase suis-je et qu'est-ce qui est typique ?",
};

const it: Dict = {
  "app.tagline": "Cycloscope · telemetria ormonale di livello scientifico",
  "app.footer": "Infrastruttura di ricerca, non uno strumento diagnostico.",
  "app.workspace": "Area di lavoro",
  "app.brand.sub": "Telemetria ormonale",

  "nav.dashboard": "Dashboard",
  "nav.telemetry": "Registro telemetria",
  "nav.analytics": "Analisi",
  "nav.research": "Portale di ricerca",
  "nav.settings": "Impostazioni",

  "lang.label": "Lingua",
  "lang.en": "English",
  "lang.zh": "中文",

  "dash.eyebrow": "Dashboard",
  "dash.title": "Istantanea fisiologica",
  "dash.desc": "Console di telemetria consapevole del ciclo con visualizzazione per fase.",
  "dash.cycleDay": "Giorno del ciclo",
  "dash.phase": "Fase",
  "dash.bbt7": "TCB · media 7g",
  "dash.bbt.latest": "Ultimo",
  "dash.mood7": "Umore · 7g",
  "dash.sleep7": "Qualità del sonno · 7g",
  "dash.vsPrior": "vs settimana precedente",

  "insights.title": "Insight proattivi del Copilot",
  "insights.sub": "Generati dalla tua telemetria rispetto al baseline.",
  "insights.ask": "Chiedi al Copilot →",

  "tel.eyebrow": "Telemetria",
  "tel.title": "Registro giornaliero",
  "tel.desc": "Acquisizione strutturata di stato soggettivo, misure oggettive e biomarcatori.",
  "tel.new": "Nuova voce",
  "tel.filter.phase": "Fase",
  "tel.filter.symptoms": "Sintomi",

  "nl.title": "Registra in linguaggio naturale",
  "nl.placeholder": 'es. "dormito 6h male, crampi forti 7/10, umore 4, mal di testa"',
  "nl.parse": "Analizza",
  "nl.proposed": "Voce proposta",
  "nl.confidence": "confidenza",
  "nl.discard": "Scarta",
  "nl.approve": "Approva e salva",
  "nl.parsed.ok": "Voce creata dal linguaggio naturale",
  "nl.parsed.err": "Il Copilot non è riuscito ad analizzare",

  "copilot.title": "Copilot del ciclo",
  "copilot.sub": "Consapevole del ciclo · usa strumenti · dati locali",
  "copilot.new": "Nuova conversazione",
  "copilot.close": "Chiudi",
  "copilot.starters": "Prova un suggerimento",
  "copilot.thinking": "Sto pensando…",
  "copilot.placeholder": "Chiedi del tuo ciclo, sintomi, correlazioni, baseline…",
  "copilot.disclaimer": "Non è un dispositivo medico. I dati restano locali eccetto questa richiesta.",
  "copilot.prompt.1": "Riassumi gli ultimi 14 giorni di telemetria.",
  "copilot.prompt.2": "Come si correla il mio umore con la qualità del sonno?",
  "copilot.prompt.3": "Segnala eventuali anomalie recenti.",
  "copilot.prompt.4": "In che fase sono e cosa è tipico?",
};

const de: Dict = {
  "app.tagline": "Cycloscope · hormonelle Telemetrie auf Forschungsniveau",
  "app.footer": "Forschungsinfrastruktur, kein Diagnosewerkzeug.",
  "app.workspace": "Arbeitsbereich",
  "app.brand.sub": "Hormonelle Telemetrie",

  "nav.dashboard": "Dashboard",
  "nav.telemetry": "Telemetrie-Protokoll",
  "nav.analytics": "Analytik",
  "nav.research": "Forschungsportal",
  "nav.settings": "Einstellungen",

  "lang.label": "Sprache",
  "lang.en": "English",
  "lang.zh": "中文",

  "dash.eyebrow": "Dashboard",
  "dash.title": "Physiologische Momentaufnahme",
  "dash.desc": "Zyklusbewusste Telemetrie-Konsole mit phasenschattierter Trendvisualisierung.",
  "dash.cycleDay": "Zyklustag",
  "dash.phase": "Phase",
  "dash.bbt7": "BKT · 7-Tage-Ø",
  "dash.bbt.latest": "Zuletzt",
  "dash.mood7": "Stimmung · 7 Tage",
  "dash.sleep7": "Schlafqualität · 7 Tage",
  "dash.vsPrior": "vs. Vorwoche",

  "insights.title": "Proaktive Copilot-Erkenntnisse",
  "insights.sub": "Automatisch aus deiner Telemetrie vs. Referenzwerten.",
  "insights.ask": "Copilot fragen →",

  "tel.eyebrow": "Telemetrie",
  "tel.title": "Tägliches Telemetrie-Protokoll",
  "tel.desc": "Strukturierte Erfassung von Zustand, Messwerten und Biomarkern.",
  "tel.new": "Neuer Eintrag",
  "tel.filter.phase": "Phase",
  "tel.filter.symptoms": "Symptome",

  "nl.title": "In natürlicher Sprache protokollieren",
  "nl.placeholder": 'z. B. "6h schlecht geschlafen, starke Krämpfe 7/10, Stimmung 4, Kopfschmerzen"',
  "nl.parse": "Analysieren",
  "nl.proposed": "Vorgeschlagener Eintrag",
  "nl.confidence": "Konfidenz",
  "nl.discard": "Verwerfen",
  "nl.approve": "Bestätigen & speichern",
  "nl.parsed.ok": "Eintrag aus natürlicher Sprache erstellt",
  "nl.parsed.err": "Copilot konnte den Eintrag nicht analysieren",

  "copilot.title": "Zyklus-Copilot",
  "copilot.sub": "Zyklusbewusst · nutzt Tools · Daten lokal",
  "copilot.new": "Neue Unterhaltung",
  "copilot.close": "Schließen",
  "copilot.starters": "Probiere einen Starter",
  "copilot.thinking": "Denke nach…",
  "copilot.placeholder": "Frag zu Zyklus, Symptomen, Korrelationen, Baselines…",
  "copilot.disclaimer": "Kein Medizinprodukt. Daten bleiben lokal, außer bei dieser Anfrage.",
  "copilot.prompt.1": "Fasse meine letzten 14 Tage Telemetrie zusammen.",
  "copilot.prompt.2": "Wie korreliert meine Stimmung mit der Schlafqualität?",
  "copilot.prompt.3": "Markiere Anomalien in meinen jüngsten Einträgen.",
  "copilot.prompt.4": "In welcher Phase bin ich und was ist typisch?",
};

const dicts: Record<Locale, Dict> = { en, zh, fr, it, de };

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
      if (saved === "en" || saved === "zh" || saved === "fr" || saved === "it" || saved === "de") setLocaleState(saved);
      else if (typeof navigator !== "undefined") {
        const nav = navigator.language.toLowerCase();
        if (nav.startsWith("zh")) setLocaleState("zh");
        else if (nav.startsWith("fr")) setLocaleState("fr");
        else if (nav.startsWith("it")) setLocaleState("it");
        else if (nav.startsWith("de")) setLocaleState("de");
      }
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