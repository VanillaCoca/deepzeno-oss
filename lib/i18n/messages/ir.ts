// IR node vocabulary shown in the Ideas/Candidates list and detail surfaces.
// Keyed by getIRKindKey(kind, subtype) so the type label tracks the language
// switcher (previously the labels were hard-coded English).
type IRMessages = Record<"en" | "zh" | "fr", Record<string, string>>;

export const irMessages: IRMessages = {
  en: {
    "ir.kind.goal": "Goal",
    "ir.kind.constraint": "Constraint",
    "ir.kind.decision": "Decision",
    "ir.kind.task": "Task",
    "ir.kind.milestone": "Milestone",
    "ir.kind.hypothesis": "Hypothesis",
    "ir.kind.principle": "Principle",
    "ir.kind.open_question": "Open question",
    "ir.kind.rejection": "Rejection",
    "ir.kind.unclassified": "Unclassified",
    "ir.kind.plan": "Plan",
    "ir.from.conversation": "From conversation",
  },
  zh: {
    "ir.kind.goal": "目标",
    "ir.kind.constraint": "约束",
    "ir.kind.decision": "决策",
    "ir.kind.task": "任务",
    "ir.kind.milestone": "里程碑",
    "ir.kind.hypothesis": "假设",
    "ir.kind.principle": "原则",
    "ir.kind.open_question": "开放问题",
    "ir.kind.rejection": "排除",
    "ir.kind.unclassified": "未分类",
    "ir.kind.plan": "计划",
    "ir.from.conversation": "来自对话",
  },
  fr: {
    "ir.kind.goal": "Objectif",
    "ir.kind.constraint": "Contrainte",
    "ir.kind.decision": "Décision",
    "ir.kind.task": "Tâche",
    "ir.kind.milestone": "Jalon",
    "ir.kind.hypothesis": "Hypothèse",
    "ir.kind.principle": "Principe",
    "ir.kind.open_question": "Question ouverte",
    "ir.kind.rejection": "Rejet",
    "ir.kind.unclassified": "Non classé",
    "ir.kind.plan": "Plan",
    "ir.from.conversation": "De la conversation",
  },
};
