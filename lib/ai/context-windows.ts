// Per-model context-window sizes (in tokens) used to decide when a conversation
// must be compacted before it overflows the model.
//
// These are deliberately *conservative* safety thresholds, not exact spec
// numbers. ZENO lets each topic pick a different model (and openai-compatible
// providers like DeepSeek / DashScope can be pointed at arbitrary models via
// env), so when we cannot identify the exact model we fall back to a small,
// safe window. Compacting a little early is harmless; overflowing is not.
//
// Keys are the registry model ids from `lib/ai/models.ts` (e.g.
// "anthropic:claude-sonnet-4-6"). Adjust here as providers raise their limits.

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "anthropic:claude-sonnet-4-6": 200_000,
  "openai:gpt-4.1": 1_000_000,
  "gateway:moonshotai/kimi-k2.5": 128_000,
};

const PROVIDER_CONTEXT_WINDOWS: Record<string, number> = {
  anthropic: 200_000,
  openai: 128_000,
  moonshotai: 128_000,
  deepseek: 64_000,
  alibaba: 32_000,
};

// Conservative floor for unknown models/providers.
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 32_000;

export function getContextWindowTokens({
  modelId,
  provider,
}: {
  modelId?: string | null;
  provider?: string | null;
}): number {
  if (modelId && MODEL_CONTEXT_WINDOWS[modelId]) {
    return MODEL_CONTEXT_WINDOWS[modelId];
  }

  if (provider && PROVIDER_CONTEXT_WINDOWS[provider]) {
    return PROVIDER_CONTEXT_WINDOWS[provider];
  }

  return DEFAULT_CONTEXT_WINDOW_TOKENS;
}
