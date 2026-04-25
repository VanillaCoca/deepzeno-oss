# Zeno V1 — Migration to vercel/chatbot

> **本文件给人看（Sean + Lixian），不是给 Codex 看的。**
> 三个 Phase 文件是给 Codex 执行的。

---

## V1 Product Principles（必读，框定所有后续设计）

1. **目标用户**：solo founder / 独立开发者 / 一人技术公司。这群人既做产品/战略判断，也亲自推动开发执行（自己写代码或与 Claude Code / Cursor / Codex 等 coding agent 深度协作）。
2. **不是目标用户**：多人团队 decision governance。当思考者、执行者、确认者不是同一个人时，需要的是 ownership / permissions / provenance / approval workflow——这是另一个产品形态，不在 V1 范围。
3. **单一判断主体**：V1 假设 project 有且只有一个 owner。所有 truth 必须由 owner 确认。`projects.user_id` 单 owner 模型不动。
4. **MCP 写入边界**：candidate-only write, truth read-only. 外部 agent（Claude Code 等）可以**提议** candidate，但永远不能直接修改 truth。所有 truth 变更都必须经过 owner 在 Zeno UI 内确认。
5. **三条 iron laws 不变**：never own execution environment / 宁漏勿错 / 永不存原始转录或自动生成的 plan 为 truth。

把这五条贴在 V1 开发期间任何讨论的最前面。它们框定了 schema、MCP、candidate confirmation、roadmap、GTM 的所有判断。

---

## 重要变更：用 vercel/chatbot，不是 supabase-community 版

原定 fork `supabase-community/vercel-ai-chatbot`。经调研发现该 fork 严重过时：
- Next.js 13（当前主流 15）
- AI SDK v2（当前 v6，API 完全不同）
- `openai-edge` 库（已废弃）
- 无 Drizzle ORM、无 Playwright 测试

**改为 fork `vercel/chatbot`（https://github.com/vercel/chatbot）**，19.6k stars，
Vercel 官方维护，Next.js 15 + AI SDK 6 + Drizzle ORM + 多模型支持。
Supabase Auth 和 Postgres 我们自己加上去——比被困在 Next.js 13 上代价小得多。

---

## 迁移策略

不是代码迁移。现有 Codex demo（A）保留作为参考，在 B 上重新实现。

### 可以直接复用的代码（从现有 repo 复制）

| 文件 | 用途 | 复用方式 |
|------|------|----------|
| `decision-extraction.ts` | 决策提取逻辑 | 核心逻辑不变，适配新的 DB 调用方式 |
| `decision-serializer.ts` | 决策序列化 | 直接复用 |
| `prompting.ts` | 提取 prompt | 直接复用 |
| `tree-panel.ts` | 树面板数据逻辑 | 适配新组件 |
| `json-utils.ts` | 工具函数 | 直接复用 |

### 必须重写的部分（用新 stack 原生方式）

| 原文件 | 原因 | 新方案 |
|--------|------|--------|
| `chat-service.ts` | 手写 streaming，不支持 AI SDK 协议 | 用 AI SDK `useChat` + `streamText` |
| `dashscope.ts` | DashScope 专用 | AI SDK provider（`@ai-sdk/anthropic` 等） |
| `file-store.ts` | 文件存储 | Supabase Postgres |
| `workspace-service.ts` | 本地 workspace 管理 | Supabase tables + RLS |
| `local-mode.ts` | 本地运行模式 | 不需要，Vercel 部署 |

### 不需要迁移的

| 原文件 | 原因 |
|--------|------|
| `debug-log.ts` | 开发调试用，新 stack 有自己的 |
| `runtime-debug.ndjson` | 调试数据 |
| `env.ts` | 会重写 |

---

## 三阶段执行计划

### Phase 1: 搭壳 + 聊天跑通
**文件**: `phase-1-scaffold.md`
**目标**: Fork → Supabase Auth → 三栏布局 → 流式聊天正常 → 数据库 schema 建好
**验收人**: Sean
**验收标准**: 能登录，能聊天，流式输出不卡不乱滚，三栏布局正确
**预计时间**: 2-3 天

### Phase 2: 决策系统 + 提取管道
**文件**: `phase-2-decision-system.md`
**目标**: 完整的决策循环——聊天→提取→候选确认→树面板→context 注入
**验收人**: Sean
**验收标准**: 对话中做出一个决策→自动提取→确认→下次对话时模型知道这个决策
**预计时间**: 5-7 天

### Phase 3: 交互打磨
**文件**: `phase-3-interaction-polish.md`
**目标**: 侧边栏完整实现、sandbox 导航、滚动行为、动画、过渡效果
**验收人**: Sean（这个阶段会有多轮反馈）
**验收标准**: 产品可以拿去给投资人和用户演示
**预计时间**: 5-7 天

---

## Lixian 的工作流程

1. Fork `vercel/chatbot` 到 ESSENTIC 的 GitHub org。
2. 把 Phase 1 文件丢给 Codex，让它在这个 fork 上执行。
3. 跑起来后通知 Sean 验收。
4. Sean 验收通过 → 进入 Phase 2。有反馈 → 修改后重新验收。
5. 重复直到 Phase 3 完成。

**每个 Phase 只给 Codex 看对应的那一个文件。** 不要一次性给三个。

---

## 给 Codex 的上下文提示

如果 Codex 对 vercel/chatbot 的结构不熟悉，可以在 task prompt 里加一行：

```
Read the existing codebase first. Pay attention to:
- app/ directory structure (Next.js App Router)
- lib/ai/ (model configuration)
- lib/db/ (Drizzle ORM schema)
- components/ (UI components using shadcn/ui)
```

Codex 在 repo 内工作时会自动读到这些文件，不需要额外喂。

---

## 现有 demo（A）的处理

保留不动。它的用途：
- Sean 截图/录屏作为交互参考
- 提取 prompt 和序列化逻辑的代码直接复制
- 对比 A 和 B 的体验差异，验证迁移决策是否正确

不要在 A 上继续开发新功能。

---

## V2 路线图（仅作记录，V1 不要碰）

V2 拆成两个独立阶段，**不要**混做：

### V2-A: Agent-originated truth maintenance（仍是 solo product）

让 coding agent 不只是被动消费 SSOT，而是能主动维护 truth 的实施状态。新增能力：
- `update_decision_status` MCP tool：允许 `active → implemented` 或 `active → superseded`，必须带 evidence（commit hash / PR URL）
- `decisions.code_anchor` 字段：把决策锚定到具体的文件/函数/commit
- `implemented` 作为一等 status
- 更结构化的 agent-originated candidate 类型（conflict_warning / technical_constraint / api_limitation 等）

仍然服务 solo founder。仍然单一 owner 确认。

### V2-B: Team governance（产品形态变化）

- Multi-owner projects
- Reviewer roles, approval workflow
- Decision provenance, audit trail
- Permissioned MCP access per role
- Conflict resolution

这一步不再是 V1 的自然延伸，需要重新审视核心数据模型。可能要等 A 轮以后。

---

## Sean 验收前 Lixian 的额外职责

Codex 提交 phase 2 后，Lixian 必须在交给 Sean 验收前手动跑一轮 extraction 准确率验证：

1. 准备 5-10 段真实对话样本（覆盖明确决策、纯讨论、显式拒绝、不确定表达等场景）
2. 跑 extraction，人工检查 candidate 输出
3. 重点确认两件事：
   - **rejection 假阳性率**：纯比较/吐槽不应该被提取成 rejection
   - **open_question 召回率**：用户说"以后再说"、"看情况"等不确定表达应该被识别为 open_question 而不是塞进 plan
4. 如准确率不达标，先迭代 prompt 再交付 Sean 验收

这是一道防止 SSOT 早期被噪音污染的人工闸。
