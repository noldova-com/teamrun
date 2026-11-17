/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const CopilotModelListRecording: { readonly source: string; readonly answer: JsonObject } = {
  "source": "GitHub Copilot CLI 1.0.105 (Linux, x64), live, on a paid plan: rows of the session.model.list answer with skipCache,"
    + " with their billing, limits and other capability fields left out, recorded 2026-11-03",
  "answer": {
    "list": [
      { "id": "auto", "name": "Auto", "provider": { "id": "copilot", "label": "GitHub Copilot", "kind": "copilot" } },
      { "id": "claude-opus-5.5", "name": "Claude Opus 5.5", "object": "model", "vendor": "Anthropic", "version": "claude-opus-5.5",
        "capabilities": { "supports": { "adaptive_thinking": "adaptive_only",
          "parallel_tool_calls": true, "reasoning_effort": ["low", "medium", "high", "xhigh", "max"], "streaming": true, "structured_outputs": true, "tool_calls": true,
          "vision": true } },
        "policy": { "state": "enabled" } },
      { "id": "claude-haiku-4.5", "name": "Claude Haiku 4.5", "object": "model", "vendor": "Anthropic", "version": "claude-haiku-4.5",
        "capabilities": { "supports": { "max_thinking_budget": 32000,
          "min_thinking_budget": 1024, "parallel_tool_calls": true, "streaming": true, "tool_calls": true, "vision": true, "adaptive_thinking": "unsupported" } },
        "policy": { "state": "enabled" } },
      { "id": "gpt-6-sol", "name": "GPT-6 Sol", "object": "model", "vendor": "OpenAI", "version": "gpt-6-sol",
        "capabilities": { "supports": { "parallel_tool_calls": true,
          "reasoning_effort": ["none", "low", "medium", "high", "xhigh", "max"], "streaming": true, "structured_outputs": true, "tool_calls": true, "vision": true,
          "adaptive_thinking": "unsupported" } },
        "policy": { "state": "enabled" } },
      { "id": "gpt-5.3-codex", "name": "GPT-5.3-Codex", "object": "model", "vendor": "OpenAI", "version": "gpt-5.3-codex", "is_chat_default": true,
        "capabilities": { "supports": { "parallel_tool_calls": true,
          "reasoning_effort": ["low", "medium", "high", "xhigh"], "streaming": true, "structured_outputs": true, "tool_calls": true, "vision": true,
          "adaptive_thinking": "unsupported" } },
        "policy": { "state": "enabled" } },
      { "id": "kimi-k3", "name": "Kimi K3", "object": "model", "vendor": "Moonshot AI", "version": "kimi-k3",
        "capabilities": { "supports": { "parallel_tool_calls": true,
          "reasoning_effort": ["low", "high", "max"], "streaming": true, "structured_outputs": true, "tool_calls": true, "vision": true,
          "adaptive_thinking": "unsupported" } },
        "policy": { "state": "enabled" } }
    ]
  }
};
