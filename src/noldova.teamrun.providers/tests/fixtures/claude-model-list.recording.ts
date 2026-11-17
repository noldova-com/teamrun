/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModelInfo } from "@anthropic-ai/claude-agent-sdk";

export const ClaudeModelListRecording: { readonly source: string; readonly models: readonly ModelInfo[] } = {
  "source": "Claude Code 2.1.312 (Linux, x64), live: three rows of the Agent SDK's supportedModels, with their names and effort fields; the descriptions"
    + " and resolved models were left out, recorded 2026-11-03",
  "models": [
    { "value": "default", "displayName": "Default (recommended)", "description": "", "supportsEffort": true, "supportedEffortLevels": ["low", "medium", "high", "xhigh", "max"] },
    { "value": "claude-haiku-4-5-20251001", "displayName": "Haiku 4.5", "description": "" },
    { "value": "claude-opus-4-6", "displayName": "Opus 4.6", "description": "", "supportsEffort": true, "supportedEffortLevels": ["low", "medium", "high", "max"] }
  ]
};
