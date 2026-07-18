# Cycloscope → AI Agent 升级方案

参考 Hack-Nation 挑战文档，评分维度是 **Women's Health Impact / Technical Excellence / Foundation Value**。当前 Cycloscope 已经覆盖了 "Application Infrastructure" 层，但更像一个 dashboard，不像 agent。下面这套改造把它变成一个 **agent-first** 的产品，同时保留研究导出/开放科学的定位。

---

## 产品定位：Cycle Copilot

一个懂内分泌周期、能读你的 telemetry、能自己调用工具的 AI agent。Sarah（文档里的用户）可以自然语言问诊、语音记录、拿到解释性的 phase-aware 洞察，并且 agent 会主动预警。

---

## 一、四个 Agent 触点（贯穿全 app）

1. **Copilot 抽屉（全局）** — 右侧可展开的聊天面板，任何页面都能唤起。默认助手身份 "Cycle Copilot"，用一张生成的 logo 替换 Sparkles。
2. **Dashboard 上的 Proactive Insights 卡片** — agent 每次数据变更后跑一次分析，输出 3 条 phase-aware 洞察 + 异常预警（对比 BASELINE），带 "解释一下" 按钮直连聊天。
3. **Telemetry Log 的自然语言录入** — 输入 "昨晚睡了 6h，痛经 7/10，情绪低落"，agent 解析成结构化 entry，弹确认卡后写入。
4. **Research Portal 的 Narrative 生成** — 一键让 agent 基于导出包写一段可复现研究摘要（cohort 描述 + 方法学）。

---

## 二、Agent 能力（tool-using，需确认写入）

Agent 通过 AI SDK + Lovable AI Gateway 调用以下工具：

| Tool | 类型 | 说明 |
|---|---|---|
| `get_recent_entries` | read | 取最近 N 天 telemetry |
| `get_phase_summary` | read | 当前 phase + baseline 对比 |
| `compute_correlation` | read | 跑 Pearson（睡眠×情绪等） |
| `detect_anomalies` | read | 对比 BASELINE 标记 z-score 异常 |
| `parse_entry_from_text` | read | NL → 结构化 TelemetryEntry 草稿 |
| `create_entry` | write（needsApproval） | 写入 store |
| `update_settings` | write（needsApproval） | 改 profile |
| `generate_export_narrative` | read | 生成研究叙述 |

写操作全部走 `needsApproval`，UI 里出现 Approve/Deny 卡片。

---

## 三、对话形态

- **单一持久会话**，存 localStorage（与项目 local-first 隐私原则一致，无需 Cloud）。
- 顶部一个 "New conversation" 清空按钮。
- 消息用 `UIMessage.parts` 渲染；tool call 折叠展示（AI Elements 的 `Tool` 组件，默认收起）。

---

## 四、技术栈

- **后端**：TanStack server route `src/routes/api/chat.ts`，用 `streamText` + `toUIMessageStreamResponse`，`stopWhen: stepCountIs(50)`。
- **模型**：`google/gemini-3.5-flash`（便宜快，够用；工具调用稳定）。
- **Gateway helper**：新建 `src/lib/ai-gateway.server.ts`（照 `ai-sdk-lovable-gateway` 模板）。
- **Secret**：`LOVABLE_API_KEY`（自动 provision）。
- **前端**：`useChat` + `DefaultChatTransport`，AI Elements 组件（`conversation` / `message` / `prompt-input` / `tool` / `shimmer`）。
- **Tool 执行**：读工具在 server 侧直接跑（server 不持有用户数据，因此改为 **client-side tool execution** — server 声明工具、client 在 `onToolCall` 里用当前 store 执行并回 result）。这是关键设计点：telemetry 在 localStorage，只有浏览器能读。
- **系统提示**：注入当前 phase / cycle day / 最近 7 天摘要 / 免责声明（Not a medical device）。

---

## 五、落地文件

新增：
- `src/lib/ai-gateway.server.ts` — Gateway provider
- `src/routes/api/chat.ts` — streaming chat 端点，声明所有 tools（无 execute，交给 client）
- `src/lib/agent/tools.ts` — 共享 Zod schemas（server 声明 + client 执行）
- `src/lib/agent/client-tools.ts` — client 侧 `onToolCall` handler，读写 hormonal store
- `src/lib/agent/insights.ts` — proactive insight 生成（复用 detect_anomalies 逻辑）
- `src/components/agent/CopilotDrawer.tsx` — 全局抽屉聊天
- `src/components/agent/ProactiveInsights.tsx` — Dashboard 卡片
- `src/components/agent/NLQuickLog.tsx` — Telemetry Log 顶部 NL 输入
- `src/components/agent/ToolApprovalCard.tsx` — 写操作确认卡
- `src/assets/copilot-logo.png` — 生成的 agent 头像（DNA/波形风格，非 Sparkles）
- AI Elements 组件：`bun x ai-elements@latest add conversation message prompt-input tool shimmer`

修改：
- `src/routes/__root.tsx` — 挂 `<CopilotDrawer />` 到 shell
- `src/features/dashboard/Dashboard.tsx` — 顶部加 `<ProactiveInsights />`
- `src/features/telemetry/TelemetryLog.tsx` — 顶部加 `<NLQuickLog />`
- `src/features/research/Research.tsx` — 加 "Generate narrative" 按钮
- `src/components/app-sidebar.tsx` — 加 "Copilot" 快捷入口
- `bunfig.toml` — 若 AI Elements 触发 supply-chain guard，加白名单

---

## 六、Hackathon 加分点对齐

- **Impact**：agent 让 Sarah 场景真正闭环（NL 录入 + 主动预警 + 解释）。
- **Technical Excellence**：tool-using agent + client-side execution（隐私零外泄）+ 可复现的 baseline 对比。
- **Foundation Value**：agent 生成的 narrative 直接接研究导出，强化 open-science 输出物。
- **Responsible design**：所有写操作 human-in-the-loop，系统提示带医疗免责，数据不出设备（tool 在浏览器跑）。

---

## 技术细节（供 review）

- Client-side tool execution：server route 里 tool 定义**不带** `execute`；`useChat` 用 `onToolCall` 分派到 `client-tools.ts`，从 `useHormonalStore` 读数据、返回 JSON result。AI SDK 会自动把 result 塞回下一轮。
- 写工具：`create_entry` / `update_settings` 在 client tool handler 里先 return "pending approval"，同时把 draft 放进 React state → 渲染 `ToolApprovalCard`；用户点 Approve 后调用 store，再手动 `addToolResult` 触发后续。
- Insights 生成不走 LLM（省 credit + 稳定）：纯本地 `detect_anomalies`；只有用户点 "解释一下" 才把该 insight + 上下文塞进聊天让 agent 展开。
- Chat textarea 默认聚焦；user message 用 `primary`/`primary-foreground`，assistant 无背景。
