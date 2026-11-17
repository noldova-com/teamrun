/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const CodexModelListRecording: { readonly source: string; readonly rows: readonly JsonObject[] } = {
  "source": "Codex CLI 0.165.0 (Linux, x64), live: two rows of the app-server model/list answer, recorded 2026-11-03",
  "rows": [
    {
      "id": "gpt-6.1-sol",
      "model": "gpt-6.1-sol",
      "upgrade": null,
      "upgradeInfo": null,
      "availabilityNux": {
        "message": "Maximize usage with GPT-6.1 Sol. Try it on complex work for near-Astra performance at a lower cost."
      },
      "displayName": "GPT-6.1-Sol",
      "description": "Latest workhorse model for coding and everyday work.",
      "modelSpecialty": null,
      "hidden": false,
      "supportedReasoningEfforts": [
        {
          "reasoningEffort": "low",
          "description": "Fast responses with lighter reasoning"
        },
        {
          "reasoningEffort": "medium",
          "description": "Balances speed and reasoning depth for everyday tasks"
        },
        {
          "reasoningEffort": "high",
          "description": "Greater reasoning depth for complex problems"
        },
        {
          "reasoningEffort": "xhigh",
          "description": "Extra high reasoning depth for complex problems"
        },
        {
          "reasoningEffort": "max",
          "description": "Maximum reasoning depth for the hardest problems"
        },
        {
          "reasoningEffort": "ultra",
          "description": "Maximum reasoning with automatic task delegation"
        }
      ],
      "defaultReasoningEffort": "low",
      "inputModalities": [
        "text",
        "image"
      ],
      "supportsPersonality": false,
      "multiAgentVersion": "v2",
      "additionalSpeedTiers": [
        "fast"
      ],
      "serviceTiers": [
        {
          "id": "priority",
          "name": "Fast",
          "description": "2x speed, increased usage"
        }
      ],
      "defaultServiceTier": null,
      "availableAccessPrograms": {
        "cyber": [
          "standard"
        ]
      },
      "isDefault": true
    },
    {
      "id": "gpt-6-luna",
      "model": "gpt-6-luna",
      "upgrade": null,
      "upgradeInfo": null,
      "availabilityNux": null,
      "displayName": "GPT-6-Luna",
      "description": "Fast and affordable model for easier tasks.",
      "modelSpecialty": null,
      "hidden": false,
      "supportedReasoningEfforts": [
        {
          "reasoningEffort": "low",
          "description": "Fast responses with lighter reasoning"
        },
        {
          "reasoningEffort": "medium",
          "description": "Balances speed and reasoning depth for everyday tasks"
        },
        {
          "reasoningEffort": "high",
          "description": "Greater reasoning depth for complex problems"
        },
        {
          "reasoningEffort": "xhigh",
          "description": "Extra high reasoning depth for complex problems"
        },
        {
          "reasoningEffort": "max",
          "description": "Maximum reasoning depth for the hardest problems"
        }
      ],
      "defaultReasoningEffort": "medium",
      "inputModalities": [
        "text",
        "image"
      ],
      "supportsPersonality": false,
      "multiAgentVersion": "v2",
      "additionalSpeedTiers": [
        "fast"
      ],
      "serviceTiers": [
        {
          "id": "priority",
          "name": "Fast",
          "description": "1.5x speed"
        }
      ],
      "defaultServiceTier": null,
      "availableAccessPrograms": {
        "cyber": [
          "standard"
        ]
      },
      "isDefault": false
    }
  ]
};
