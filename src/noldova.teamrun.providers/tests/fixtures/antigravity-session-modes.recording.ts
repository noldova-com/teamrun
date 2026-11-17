/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const AntigravitySessionModesRecording: {
  readonly source: string;
  readonly sessionNew: {
    readonly modes: { readonly currentModeId: string; readonly availableModes: readonly { readonly id: string; readonly name: string; readonly description: string }[] };
    readonly configOptions: readonly [
      { readonly currentValue: string; readonly options: readonly { readonly value: string; readonly name: string; readonly description: string }[]; readonly id: string;
        readonly name: string; readonly category: string; readonly type: string },
      { readonly currentValue: string; readonly options: readonly { readonly value: string; readonly name: string; readonly description: string }[]; readonly id: string;
        readonly name: string; readonly category: string; readonly type: string }
    ];
  };
} = {
  "source": "Antigravity's ACP server 1.3.0 (macOS, arm64), live: the session/new result of a session started with no prompt, after a Google sign-in, recorded 2026-10-27",
  "sessionNew": {
    "modes": {
      "currentModeId": "default",
      "availableModes": [
        { "id": "default", "name": "Default", "description": "Default permission prompt flow" },
        { "id": "auto_edit", "name": "Auto Edit", "description": "Auto-approve file edit tools" },
        { "id": "yolo", "name": "YOLO", "description": "Auto-approve all tools" }
      ]
    },
    "configOptions": [
      {
        "currentValue": "gemini-3.8-flash-high",
        "options": [
          { "value": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash (High)", "description": "gemini-3.8-flash-high" },
          { "value": "gemini-3.8-flash-medium", "name": "Gemini 3.8 Flash (Medium)", "description": "gemini-3.8-flash-medium" },
          { "value": "gemini-3.8-flash-low", "name": "Gemini 3.8 Flash (Low)", "description": "gemini-3.8-flash-low" }
        ],
        "id": "model",
        "name": "Model",
        "category": "model",
        "type": "select"
      },
      {
        "currentValue": "default",
        "options": [
          { "value": "default", "name": "Default", "description": "Default permission prompt flow" },
          { "value": "auto_edit", "name": "Auto Edit", "description": "Auto-approve file edit tools" },
          { "value": "yolo", "name": "YOLO", "description": "Auto-approve all tools" }
        ],
        "id": "mode",
        "name": "Session Mode",
        "category": "mode",
        "type": "select"
      }
    ]
  }
};
