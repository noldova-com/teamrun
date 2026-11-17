/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const CursorModelOptionRecording: { readonly source: string; readonly option: JsonObject } = {
  "source": "cursor-agent 2026.10.22-27dcf5f (Linux, x64), live, session/new: six of the 47 models its availableModels lists, with their ids and names as listed, as its model option's values, whose current one is default[]; recorded 2026-11-03",
  "option": {
    "type": "select", "id": "model", "name": "Model", "category": "model", "currentValue": "default[]", "options": [
      { "value": "default[]", "name": "Auto" },
      { "value": "grok-4.7[context=256k,reasoning_effort=high,fast=true]", "name": "grok-4.7" },
      { "value": "composer-2.5[fast=true]", "name": "composer-2.5" },
      { "value": "claude-opus-5-5[context=300k,effort=medium,fast=false]", "name": "claude-opus-5-5" },
      { "value": "gemini-4-argon[reasoning_effort=medium]", "name": "gemini-4-argon" },
      { "value": "gpt-5.6-sol[context=272k,reasoning=medium,fast=false]", "name": "gpt-5.6-sol" }
    ]
  }
};
