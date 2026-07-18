import type {
  IRKind,
  IRPlanSubtype,
  IRRelation,
  IRSourceLayer,
} from "@/lib/ir/types";

// Content for the two official example projects seeded into every new user's
// Library (see docs/superpowers/specs/2026-07-07-example-projects-seeding-design.md).
// This file is pure data — the seeding mechanics live in ./example-projects.ts.
//
// Rendering constraints baked into the shape here:
//   - The truth graph is topic-scoped and edges only render when BOTH endpoints
//     are in the same topic, so every edge below stays inside one topic.
//   - Only depends_on / refines / resolves / implies draw as flow edges, so we
//     express judgment with rejection nodes + a candidate that `resolves` an
//     open question, never with supersedes/contradicts.

export type ExampleNodeStatus = "active" | "pending";

export type ExampleNode = {
  // Local key, unique within the project, referenced by edges below.
  key: string;
  kind: IRKind;
  subtype?: IRPlanSubtype;
  status: ExampleNodeStatus;
  title: string;
  rationale: string;
  // Override the default source layer (active→manual, pending→sweep) —
  // e.g. "research" for candidates the research agent proposed.
  sourceLayer?: IRSourceLayer;
};

export type ExampleEdge = {
  from: string;
  relation: IRRelation;
  to: string;
  // AI-written free-form description of the link (ir_edges.label) — shown on
  // the quiet dependency edges and the reasoning chain.
  label?: string;
};

export type ExampleTopic = {
  key: string;
  label: string;
  isGeneral?: boolean;
  nodes: ExampleNode[];
  edges: ExampleEdge[];
};

// Pre-baked research/watchtower artifacts so a new user's first open shows
// the agent's proactivity (evidence + an active watch + a patrol alert)
// without spending tokens at signup. Quotes/claims are demo content; the
// welcome message discloses that.
export type ExampleEvidence = {
  url: string;
  title: string;
  quote: string;
  claim: string;
  stance: "supports" | "contradicts" | "neutral";
};

export type ExampleResearchRun = {
  type: "research" | "patrol";
  plan: Array<{ query: string; goal: string }>;
  brief: string;
  evidence: ExampleEvidence[];
};

export type ExampleResearch = {
  // Key of the node the runs/watch/alert anchor to.
  nodeKey: string;
  runs: ExampleResearchRun[];
  watch?: {
    cadence: "daily" | "every_3_days" | "weekly";
    reason: string;
  };
  // Watchtower alert candidate (pending open_question, sourceLayer
  // "watchtower", contradicts edge to the watched node). Seeded separately
  // from the main node batch so a pre-watchtower-migration database still
  // seeds the rest of the project.
  alert?: {
    title: string;
    rationale: string;
    edgeLabel: string;
  };
};

export type ExampleProject = {
  // Stable slug for logging/telemetry.
  slug: string;
  name: string;
  // Key of the topic whose conversation receives the welcome message.
  welcomeTopicKey: string;
  welcome: string;
  topics: ExampleTopic[];
  research?: ExampleResearch[];
};

const EN_WELCOME = [
  '👋 This is an official **Deepzeno example** — you\'re looking at how a two-person founding team reasoned through taking a B2B analytics product ("Beacon") to market.',
  "",
  "Deepzeno turns messy thinking into a **truth graph**: goals, constraints, hypotheses, the decisions you've locked in, and the options you deliberately rejected — each with its reasoning, and wired to what it depends on.",
  "",
  "**Try it in 30 seconds:**",
  "1. Open the **Positioning & Motion** topic on the left — that's the core decision.",
  "2. In the graph, switch **Truth → All**. The gray nodes are **candidates**: things the AI proposed but nobody has confirmed yet.",
  "3. Click the candidate **“Target ops leaders as the beachhead ICP”** and **Confirm** it — it answers the open question *“Who is the beachhead ICP?”* and turns into truth.",
  "4. Browse **Pricing & Packaging** and **Launch Plan** for the rest of the decision.",
  "",
  "When you're ready, hit **New project** (top right) to start your own.",
  "— The Deepzeno team",
].join("\n");

const ZH_WELCOME = [
  "👋 这是一个 **Deepzeno 官方示例** —— 你看到的是一个家庭如何一步步想清楚「要不要离开一线、回新一线城市定居买房」。",
  "",
  "Deepzeno 把纷乱的思考整理成一张**真相图**：目标、约束、假设、你已经拍板的决策，以及被你明确排除的选项 —— 每一项都带着背后的理由，并连到它所依赖的前提。",
  "",
  "**30 秒上手：**",
  "1. 点左边的**决策主线**主题 —— 那是这个决定的核心。",
  "2. 在图上把 **Truth 切到 All**。灰色的是**候选**：AI 提出、但还没人确认的想法。",
  "3. 点候选**「先在杭州租住 6 个月过渡」**，点**确认** —— 它会解答一个开放问题，并变成真相。",
  "4. 再去**职业发展**、**生活与家庭**看这个决定的其余部分。",
  "",
  "想好了，就点右上角的**新建项目**，开始你自己的决策。",
  "—— Deepzeno 团队",
].join("\n");

const ENGLISH_EXAMPLE: ExampleProject = {
  slug: "en-gtm-saas",
  name: "✦ Deepzeno Example · Go-to-Market for a SaaS",
  welcomeTopicKey: "start",
  welcome: EN_WELCOME,
  topics: [
    {
      key: "start",
      label: "Start here",
      isGeneral: true,
      nodes: [],
      edges: [],
    },
    {
      key: "motion",
      label: "Positioning & Motion",
      nodes: [
        {
          key: "goal",
          kind: "goal",
          status: "active",
          title: "Reach $1M ARR within 18 months of launch",
          rationale:
            "A concrete revenue target forces every positioning and pricing choice to be judged on speed-to-revenue, not vanity metrics.",
        },
        {
          key: "runway",
          kind: "constraint",
          status: "active",
          title: "20-month runway — no time for a long enterprise sales cycle",
          rationale:
            "With 20 months of cash and no new raise assumed, any motion that takes 6–9 months to close its first deals is disqualified.",
        },
        {
          key: "team",
          kind: "constraint",
          status: "active",
          title: "Two founders, no dedicated sales hire yet",
          rationale:
            "Neither founder is a full-time seller, so the go-to-market motion has to work without a staffed sales team on day one.",
        },
        {
          key: "plg-hyp",
          kind: "hypothesis",
          status: "active",
          title:
            "Self-serve product-led growth converts our SMB users faster than sales-led outreach",
          rationale:
            "SMB buyers can adopt without procurement; a free trial lets the product sell itself and shortens time-to-first-value.",
        },
        {
          key: "plg-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "Go product-led: 14-day free trial with self-serve checkout",
          rationale:
            "Fits the runway and the two-person team — the product does the selling while we focus on activation, not pipeline.",
        },
        {
          key: "reject-outbound",
          kind: "rejection",
          status: "active",
          title: "Rejected: outbound sales-led motion with an SDR team",
          rationale:
            "A staffed outbound motion would burn the runway before the first cohort of deals closed, and two people can't staff it. Explicitly ruled out.",
        },
        {
          key: "ttfv",
          kind: "principle",
          status: "active",
          title: "Optimize for time-to-first-value over feature breadth",
          rationale:
            "Every roadmap and onboarding choice is judged by how fast a new team reaches its first real insight.",
        },
        {
          key: "icp-q",
          kind: "open_question",
          status: "active",
          title:
            "Who is the beachhead ICP — ops leaders or engineering managers?",
          rationale:
            "The two audiences want different onboarding, pricing, and messaging; picking one concentrates the launch.",
        },
        {
          key: "icp-candidate",
          kind: "plan",
          subtype: "decision",
          status: "pending",
          title:
            "Target ops leaders at 20–200 person companies as the beachhead",
          rationale:
            "Ops leaders feel the analytics pain first and refer laterally — a candidate to confirm once we've validated the motion.",
        },
      ],
      edges: [
        { from: "plg-hyp", relation: "depends_on", to: "goal" },
        { from: "plg-decision", relation: "refines", to: "plg-hyp" },
        { from: "plg-decision", relation: "depends_on", to: "runway" },
        { from: "plg-decision", relation: "depends_on", to: "team" },
        { from: "reject-outbound", relation: "depends_on", to: "runway" },
        { from: "ttfv", relation: "depends_on", to: "goal" },
        { from: "icp-candidate", relation: "resolves", to: "icp-q" },
        { from: "icp-candidate", relation: "depends_on", to: "plg-hyp" },
      ],
    },
    {
      key: "pricing",
      label: "Pricing & Packaging",
      nodes: [
        {
          key: "entry-price",
          kind: "constraint",
          status: "active",
          title:
            "Entry price must clear a self-serve, credit-card threshold (under $50/mo to start)",
          rationale:
            "Above that, buyers need approval and the self-serve motion stalls — the price ceiling protects the whole PLG plan.",
        },
        {
          key: "metric-q",
          kind: "open_question",
          status: "active",
          title: "Price per seat or per active workspace?",
          rationale:
            "Per-seat is familiar but penalizes team growth; per-workspace aligns with value but is harder to forecast.",
        },
        {
          key: "workspace-price",
          kind: "plan",
          subtype: "decision",
          status: "pending",
          title: "Price per active workspace, not per seat",
          rationale:
            "Aligns price with value delivered and stops punishing teams for adding members — a candidate pending forecast validation.",
        },
        {
          key: "addon-hyp",
          kind: "hypothesis",
          status: "active",
          title:
            "A usage-based add-on lifts expansion revenue without raising the entry price",
          rationale:
            "Charging for advanced usage on top of the base workspace price grows net revenue retention while keeping entry cheap.",
        },
        {
          key: "reject-annual",
          kind: "rejection",
          status: "active",
          title: "Rejected: annual-only billing at launch",
          rationale:
            "Annual-only raises trial-to-paid friction for card-paying SMBs; start monthly, add annual once retention is proven.",
        },
        {
          key: "checkout",
          kind: "plan",
          subtype: "task",
          status: "active",
          title: "Ship self-serve Stripe checkout with monthly billing",
          rationale:
            "Card-based monthly checkout is what keeps the entry price under the self-serve threshold in practice.",
        },
      ],
      edges: [
        { from: "workspace-price", relation: "resolves", to: "metric-q" },
        { from: "workspace-price", relation: "depends_on", to: "entry-price" },
        { from: "addon-hyp", relation: "refines", to: "workspace-price" },
        { from: "reject-annual", relation: "depends_on", to: "entry-price" },
        { from: "checkout", relation: "depends_on", to: "entry-price" },
      ],
    },
    {
      key: "launch",
      label: "Launch Plan",
      nodes: [
        {
          key: "vertical",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "Launch in one vertical (RevOps) first, expand later",
          rationale:
            "A single vertical sharpens messaging and references; horizontal launches dilute both while runway is tight.",
        },
        {
          key: "recruit",
          kind: "plan",
          subtype: "task",
          status: "active",
          title: "Recruit 25 design partners from founder communities",
          rationale:
            "Design partners give the activation data the PLG bet depends on before any public launch.",
        },
        {
          key: "beta",
          kind: "plan",
          subtype: "milestone",
          status: "active",
          title: "Private beta with 25 design-partner teams",
          rationale:
            "The beta is the gate: it proves time-to-first-value before we spend attention on a public launch.",
        },
        {
          key: "public-launch",
          kind: "plan",
          subtype: "milestone",
          status: "active",
          title: "Public launch on Product Hunt + founder communities",
          rationale:
            "A concentrated launch moment in communities where RevOps buyers already gather.",
        },
        {
          key: "gate-q",
          kind: "open_question",
          status: "active",
          title:
            "Gate the public launch on hitting a beta activation-rate bar?",
          rationale:
            "Launching before activation works risks burning the one launch moment on a product that doesn't retain.",
        },
      ],
      edges: [
        { from: "beta", relation: "depends_on", to: "recruit" },
        { from: "public-launch", relation: "depends_on", to: "vertical" },
        { from: "public-launch", relation: "depends_on", to: "beta" },
        { from: "gate-q", relation: "depends_on", to: "beta" },
      ],
    },
  ],
};

const CHINESE_EXAMPLE: ExampleProject = {
  slug: "zh-relocation",
  name: "✦ Deepzeno 示例 · 新一线城市定居决策",
  welcomeTopicKey: "start",
  welcome: ZH_WELCOME,
  topics: [
    {
      key: "start",
      label: "从这里开始",
      isGeneral: true,
      nodes: [],
      edges: [],
    },
    {
      key: "main",
      label: "决策主线",
      nodes: [
        {
          key: "goal",
          kind: "goal",
          status: "active",
          title: "3 年内在定居城市拥有自住房，且家庭月现金流为正",
          rationale:
            "把「买房」和「不被房贷拖垮」绑在一起当目标，任何城市或预算选择都要同时满足这两条。",
        },
        {
          key: "savings",
          kind: "constraint",
          status: "active",
          title: "家庭可动用存款约 80 万，一线首付缺口大",
          rationale:
            "80 万在一线连首付都紧张，在新一线可覆盖一套两居的首付并留出装修与应急金。",
        },
        {
          key: "spouse-loc",
          kind: "constraint",
          status: "active",
          title: "配偶目前工作在一线，两年内异地成本高",
          rationale:
            "若一方留一线、一方去新一线，通勤与两地生活成本会侵蚀买房带来的现金流改善。",
        },
        {
          key: "income-hyp",
          kind: "hypothesis",
          status: "active",
          title: "回新一线后家庭总收入约降 30%，但房价与生活成本下降更多",
          rationale:
            "收入虽降，但房价、通勤、育儿等刚性支出下降幅度更大，净现金流反而转正。",
        },
        {
          key: "city-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "在几个新一线里选择杭州作为定居城市",
          rationale:
            "杭州的产业与配偶职业匹配度最高，房价相对可控 —— 在收入下降与生活成本之间取得平衡。",
        },
        {
          key: "reject-stay",
          kind: "rejection",
          status: "active",
          title: "排除：留在一线继续租房、攒首付到 40 岁",
          rationale:
            "按当前存款增速，一线首付还要再攒 6–8 年，期间无自住房、育儿与养老压力叠加 —— 明确放弃。",
        },
        {
          key: "cashflow-principle",
          kind: "principle",
          status: "active",
          title: "重大取舍以「家庭净现金流与生活质量」为尺，而非城市光环",
          rationale:
            "面子与城市等级不作为决策依据，一切回到现金流与生活质量本身。",
        },
        {
          key: "transition-q",
          kind: "open_question",
          status: "active",
          title: "先落户买房，还是先低成本过渡验证？",
          rationale:
            "直接买房沉没成本高；先过渡能验证通勤、社交与配偶求职，但会多花半年租金。",
        },
        {
          key: "transition-candidate",
          kind: "plan",
          subtype: "decision",
          status: "pending",
          title: "先在杭州租住 6 个月过渡，再定落户与购房片区",
          rationale:
            "用半年低成本试住验证生活与求职，再下买房决定 —— 候选，待确认。",
        },
      ],
      edges: [
        { from: "income-hyp", relation: "depends_on", to: "goal" },
        { from: "city-decision", relation: "refines", to: "income-hyp" },
        { from: "city-decision", relation: "depends_on", to: "savings" },
        { from: "city-decision", relation: "depends_on", to: "spouse-loc" },
        { from: "reject-stay", relation: "depends_on", to: "savings" },
        { from: "cashflow-principle", relation: "depends_on", to: "goal" },
        {
          from: "transition-candidate",
          relation: "resolves",
          to: "transition-q",
        },
        {
          from: "transition-candidate",
          relation: "depends_on",
          to: "city-decision",
        },
      ],
    },
    {
      key: "career",
      label: "职业发展",
      nodes: [
        {
          key: "spouse-job",
          kind: "constraint",
          status: "active",
          title: "配偶需在杭州找到对等或更好的职位，否则家庭收入再降",
          rationale:
            "配偶收入是家庭现金流的另一半，落空则「净现金流为正」的目标不成立。",
        },
        {
          key: "remote-q",
          kind: "open_question",
          status: "active",
          title: "我方现岗位能否转远程或杭州分部？",
          rationale: "若能保住一线级别薪资，整套决策的收入风险将大幅下降。",
        },
        {
          key: "transfer-candidate",
          kind: "plan",
          subtype: "decision",
          status: "pending",
          title: "先争取现公司的杭州分部 / 远程名额，保住一线级别薪资",
          rationale:
            "在换城市之前先锁定收入，是风险最低的路径 —— 候选，待与公司确认可行性。",
        },
        {
          key: "industry-hyp",
          kind: "hypothesis",
          status: "active",
          title: "杭州的互联网 / 电商产业能提供与一线相当的岗位",
          rationale:
            "杭州头部产业密集，对等岗位供给是配偶求职与转岗的前提假设。",
        },
        {
          key: "reject-quit",
          kind: "rejection",
          status: "active",
          title: "排除：裸辞后再到杭州找工作",
          rationale: "无收入空窗期叠加房贷首付支出，风险过高 —— 放弃裸辞。",
        },
        {
          key: "interviews",
          kind: "plan",
          subtype: "task",
          status: "active",
          title: "3 个月内在杭州目标公司做 5 场信息面试",
          rationale: "用信息面试低成本验证岗位供给假设，再决定是否真的搬。",
        },
      ],
      edges: [
        { from: "transfer-candidate", relation: "resolves", to: "remote-q" },
        {
          from: "transfer-candidate",
          relation: "depends_on",
          to: "spouse-job",
        },
        {
          from: "transfer-candidate",
          relation: "depends_on",
          to: "industry-hyp",
        },
        { from: "reject-quit", relation: "depends_on", to: "spouse-job" },
        { from: "interviews", relation: "depends_on", to: "industry-hyp" },
      ],
    },
    {
      key: "family",
      label: "生活与家庭",
      nodes: [
        {
          key: "school",
          kind: "constraint",
          status: "active",
          title: "孩子明年上小学，需在片区学位确定前落定",
          rationale:
            "学位有时间窗，错过则要么择校成本高、要么再等一年，直接约束买房节奏。",
        },
        {
          key: "district-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "优先选学区达标、通勤 30 分钟内的片区，牺牲部分面积",
          rationale:
            "学区与通勤是每天都在消耗的成本，比面积更影响长期生活质量。",
        },
        {
          key: "commute-hyp",
          kind: "hypothesis",
          status: "active",
          title: "新一线的通勤与育儿时间成本显著低于一线",
          rationale:
            "通勤与育儿时间是回新一线最大的隐性收益，支撑「牺牲面积换通勤」的取舍。",
        },
        {
          key: "elders-q",
          kind: "open_question",
          status: "active",
          title: "双方父母是否随迁、是否需要三居？",
          rationale: "是否随迁直接决定户型与预算，牵动首付与月供测算。",
        },
        {
          key: "compare-task",
          kind: "plan",
          subtype: "task",
          status: "active",
          title: "做杭州 3 个候选片区的「学区 + 房价 + 通勤」对照表",
          rationale: "把片区决策落到可比的数字上，避免凭感觉选。",
        },
      ],
      edges: [
        { from: "district-decision", relation: "depends_on", to: "school" },
        {
          from: "district-decision",
          relation: "depends_on",
          to: "commute-hyp",
        },
        {
          from: "compare-task",
          relation: "depends_on",
          to: "district-decision",
        },
        { from: "elders-q", relation: "depends_on", to: "school" },
      ],
    },
  ],
};

const IMMIGRATION_WELCOME = [
  "👋 这是一个 **Deepzeno 官方示例** —— 一个家庭如何把「全家技术移民加拿大」这件大事,拆成一张可以持续维护的真相图。",
  "",
  "这个示例专门展示 Deepzeno 的两件核心能力:",
  "",
  "**1. 前置假设看得见。** 打开左边的**路径决策**主题:「走联邦 EE 通道」这个决定,用箭头连着它脚下的三条前提——政策假设、语言假设、预算约束(入口处的 ①②③ 表示它们缺一不可)。不用点开任何节点,谁建立在谁之上一目了然;悬停任意一条线,能看到 AI 写的依赖说明。",
  "",
  "**2. Agent 主动做调研。** 注意「EE 抽分线不大幅上涨」这条假设旁边的📡雷达标:Zeno 已经把它列入**自动巡检**——点开它,能看到 agent 之前抓取的政策证据(Research 区),以及巡检设置(Monitoring 区)。巡检发现了相反信号,于是在待决区主动放了一张**告警候选**:「该假设可能已被推翻?」——确认或驳回,都由你判断,Zeno 永远不替你改真相。",
  "",
  "**30 秒上手:**",
  "1. 点**路径决策**,看依赖箭头与 ①②③ 汇聚;",
  "2. 点那张告警候选卡,看 agent 附上的反方证据;",
  "3. 图右上角 **调研 Agent** 按钮里,可以调巡检频率、换调研模型(默认 DeepSeek)、或点「立即巡检」。",
  "",
  "_注:此示例中的调研证据与巡检记录为演示数据(链接指向真实官网,引文为演示文字)。_",
  "—— Deepzeno 团队",
].join("\n");

const IMMIGRATION_EXAMPLE: ExampleProject = {
  slug: "zh-immigration",
  name: "✦ Deepzeno 示例 · 全家移民规划",
  welcomeTopicKey: "start",
  welcome: IMMIGRATION_WELCOME,
  topics: [
    {
      key: "start",
      label: "从这里开始",
      isGeneral: true,
      nodes: [],
      edges: [],
    },
    {
      key: "route",
      label: "路径决策",
      nodes: [
        {
          key: "goal",
          kind: "goal",
          status: "active",
          title: "18 个月内完成全家加拿大技术移民登陆",
          rationale:
            "把「要不要移民」升级成「怎么在窗口期内落地」:时间盒逼着每个选择按可行性排序,而不是无限比较。",
        },
        {
          key: "budget",
          kind: "constraint",
          status: "active",
          title: "总预算上限 60 万人民币(含安家储备金)",
          rationale:
            "不动用父母养老金是硬边界。任何单路径花费超过 35 万的方案直接出局。",
        },
        {
          key: "school-window",
          kind: "constraint",
          status: "active",
          title: "大女儿 2028 年 9 月前必须入学,窗口不可后移",
          rationale: "超过这个时间点转学衔接成本陡增,全家时间表都从它倒推。",
        },
        {
          key: "policy-hyp",
          kind: "hypothesis",
          status: "active",
          title: "假设:EE 抽分线未来 12 个月不会大幅上涨",
          rationale:
            "整条联邦 EE 路径建立在「当前分数够得着」之上。政策一收紧,主通道立即需要重审——这是全项目最脆弱的前提。",
        },
        {
          key: "ielts-hyp",
          kind: "hypothesis",
          status: "active",
          title: "假设:雅思 6 个月内可达 4 个 7(CLB 9)",
          rationale:
            "语言分是 CRS 打分的最大可控变量。达不到 CLB 9,分数模型整体塌方。",
        },
        {
          key: "route-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "决定:主通道走联邦 EE,雇主担保仅作备选",
          rationale:
            "EE 流程透明、周期可控、不依赖单一雇主。它同时押在政策假设与语言假设上——任一条动摇,这个决定要回沙盒重审。",
        },
        {
          key: "eca-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "决定:今年 Q4 前完成学历认证(ECA)与雅思首考",
          rationale:
            "定了通道才排得出关键路径:ECA 是入池前置,首考留出二刷余量。",
        },
        {
          key: "quebec-rejected",
          kind: "rejection",
          status: "active",
          title: "排除:魁北克技术移民路径",
          rationale:
            "法语门槛对全家过高,且该省政策近年波动频繁,与「窗口不可后移」约束冲突。",
        },
        {
          key: "backup-q",
          kind: "open_question",
          status: "active",
          title: "是否同步申请省提名(OINP/BCPNP)作为备份?",
          rationale:
            "省提名能对冲联邦抽分风险,但材料成本高。要不要付这份保险费,取决于政策假设有多稳。",
        },
        {
          key: "oinp-candidate",
          kind: "plan",
          subtype: "decision",
          status: "pending",
          sourceLayer: "research",
          title: "候选:同步准备安省 OINP 人力资本类材料",
          rationale:
            "调研显示 OINP 人力资本类与 EE 材料重合度约 80%,边际成本低——作为对冲值得做。来自调研管线的建议,待你确认。",
        },
      ],
      edges: [
        {
          from: "route-decision",
          relation: "depends_on",
          to: "policy-hyp",
          label: "抽分稳定才成立",
        },
        {
          from: "route-decision",
          relation: "depends_on",
          to: "ielts-hyp",
          label: "语言分是入池门槛",
        },
        {
          from: "route-decision",
          relation: "depends_on",
          to: "budget",
          label: "预算内可行",
        },
        {
          from: "eca-decision",
          relation: "depends_on",
          to: "route-decision",
          label: "定通道后才排期",
        },
        {
          from: "eca-decision",
          relation: "depends_on",
          to: "school-window",
          label: "从入学窗口倒推",
        },
        {
          from: "backup-q",
          relation: "depends_on",
          to: "policy-hyp",
          label: "政策风险引出备份",
        },
        {
          from: "oinp-candidate",
          relation: "resolves",
          to: "backup-q",
          label: "对冲联邦抽分风险",
        },
      ],
    },
    {
      key: "prep",
      label: "语言与资金准备",
      nodes: [
        {
          key: "study-time",
          kind: "constraint",
          status: "active",
          title: "两人每周可投入学习时间合计 ≤10 小时",
          rationale: "双职工带娃的真实上限。任何备考计划超出它就是自欺。",
        },
        {
          key: "fx-hyp",
          kind: "hypothesis",
          status: "active",
          title: "假设:人民币兑加元汇率 12 个月内波动小于 8%",
          rationale: "换汇节奏与安家资金规划都押在汇率大体平稳上。",
        },
        {
          key: "ielts-plan",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "决定:报名周末雅思强化班,10 月完成首考",
          rationale:
            "在每周 10 小时约束下,自学效率不够,外部结构化训练是必需品。",
        },
        {
          key: "fx-plan",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "决定:资金分三批换汇,首批本月完成",
          rationale: "分批摊平汇率波动;若汇率假设被推翻,后两批策略要重定。",
        },
        {
          key: "account-q",
          kind: "open_question",
          status: "active",
          title: "是否需要在国内提前开立加元账户?",
          rationale: "涉及换汇通道与后续学费支付方式,尚未比较清楚成本差异。",
        },
      ],
      edges: [
        {
          from: "ielts-plan",
          relation: "depends_on",
          to: "study-time",
          label: "在时间上限内可行",
        },
        {
          from: "fx-plan",
          relation: "depends_on",
          to: "fx-hyp",
          label: "汇率平稳才分批",
        },
        {
          from: "account-q",
          relation: "depends_on",
          to: "fx-plan",
          label: "换汇方式决定账户需求",
        },
      ],
    },
    {
      key: "settle",
      label: "安家与子女教育",
      nodes: [
        {
          key: "settle-principle",
          kind: "principle",
          status: "active",
          title: "原则:落地城市以学区质量与华人社区支持优先",
          rationale: "第一年适应成本主要落在孩子身上,城市选择为她服务。",
        },
        {
          key: "city-decision",
          kind: "plan",
          subtype: "decision",
          status: "active",
          title: "决定:首选大多伦多区,备选卡尔加里",
          rationale: "教育资源与就业市场最厚;卡尔加里以生活成本低作为保底。",
        },
        {
          key: "vancouver-rejected",
          kind: "rejection",
          status: "active",
          title: "排除:温哥华",
          rationale: "房价直接击穿预算约束,不再投入比较精力。",
        },
        {
          key: "school-q",
          kind: "open_question",
          status: "active",
          title: "小学成绩单与出生证明公证何时启动?",
          rationale:
            "公证与认证周期约 6-8 周,需要从入学窗口倒排,但尚未确认清单。",
        },
      ],
      edges: [
        {
          from: "city-decision",
          relation: "depends_on",
          to: "settle-principle",
          label: "按此原则筛选城市",
        },
        {
          from: "school-q",
          relation: "depends_on",
          to: "city-decision",
          label: "定城市后才定学校",
        },
      ],
    },
  ],
  research: [
    {
      nodeKey: "policy-hyp",
      runs: [
        {
          type: "research",
          plan: [
            {
              query: "Express Entry CRS cutoff trend 2026",
              goal: "确认近 6 个月抽分走势",
            },
            {
              query: "IRCC immigration levels plan federal skilled worker",
              goal: "确认联邦技术移民配额是否调整",
            },
          ],
          brief: [
            "## 调研简报:EE 抽分线是否会大幅上涨(演示数据)",
            "",
            "- 官方 Express Entry 页面确认抽签机制与类别未变 [0]。",
            "- 但最近两轮全类别抽分连续上行,累计上涨超过 60 分 [1]。",
            "- 行业分析认为配额向省提名与特定职业倾斜,联邦通道竞争趋紧 [2]。",
            "",
            "**结论:** 该假设短期仍勉强成立,但反向信号明显,建议保持每日巡检并准备省提名对冲(见候选)。",
          ].join("\n"),
          evidence: [
            {
              url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html",
              title: "Express Entry — Canada.ca",
              quote:
                "(演示引文)Express Entry is an online system that we use to manage immigration applications from skilled workers.",
              claim: "EE 抽签机制与申请框架本身未发生结构性变化。",
              stance: "supports",
            },
            {
              url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html",
              title: "Express Entry rounds of invitations — Canada.ca",
              quote:
                "(演示引文)Recent all-program rounds show minimum CRS scores rising in consecutive draws.",
              claim: "最近两轮全类别抽分连续上涨,与「不大幅上涨」的假设相悖。",
              stance: "contradicts",
            },
            {
              url: "https://www.cicnews.com/",
              title: "CIC News — Express Entry 分析(演示)",
              quote:
                "(演示引文)Analysts expect federal high-skilled admissions to tighten as allocations shift toward provincial programs.",
              claim: "分析认为配额向省提名倾斜,联邦通道竞争将加剧。",
              stance: "contradicts",
            },
          ],
        },
      ],
      watch: {
        cadence: "daily",
        reason: "可证伪假设 · 2 个判断建立在它之上 · 已有网络证据需要保鲜",
      },
      alert: {
        title: "「EE 抽分线不大幅上涨」可能已被推翻——近两轮连续上涨?",
        rationale:
          "Watchtower 巡检发现:新抓取的抽分数据与该前提相矛盾(演示数据)。若确认,「主通道走联邦 EE」与备份问题都需要回沙盒重审。",
        edgeLabel: "巡检发现新信号",
      },
    },
  ],
};

export const EXAMPLE_PROJECTS: ExampleProject[] = [
  IMMIGRATION_EXAMPLE,
  ENGLISH_EXAMPLE,
  CHINESE_EXAMPLE,
];
