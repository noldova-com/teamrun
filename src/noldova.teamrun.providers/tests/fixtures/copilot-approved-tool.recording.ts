/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const CopilotApprovedToolRecording: { readonly source: string; readonly messages: readonly JsonObject[] } = {
  "source": "GitHub Copilot CLI 1.0.104 over ACP, started with --allow-tool=teamrun(capture_approved), one turn calling two tools of an HTTP MCP server named teamrun, only capture_other asking, recorded 2026-10-27; the message chunks joined into one, and usage, the session title, the commands list, the config options and the session id left out, with the tool call ids renumbered",
  "messages": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "call-1",
          "title": "teamrun-capture_approved",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "note": "a"
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "call-2",
          "title": "teamrun-capture_other",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "note": "b"
          }
        }
      }
    },
    {
      "id": "0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-2",
          "title": "capture_other",
          "kind": "other",
          "status": "pending",
          "rawInput": {
            "note": "b"
          }
        },
        "options": [
          {
            "optionId": "allow_once",
            "kind": "allow_once",
            "name": "Allow once"
          },
          {
            "optionId": "allow_always",
            "kind": "allow_always",
            "name": "Always allow"
          },
          {
            "optionId": "reject_once",
            "kind": "reject_once",
            "name": "Deny"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-1",
          "status": "completed",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "capture_approved ran with the note a"
              }
            }
          ],
          "rawOutput": {
            "content": "capture_approved ran with the note a",
            "detailedContent": "capture_approved ran with the note a",
            "contents": [
              {
                "type": "text",
                "text": "capture_approved ran with the note a"
              }
            ]
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-2",
          "status": "completed",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "capture_other ran with the note b"
              }
            }
          ],
          "rawOutput": {
            "content": "capture_other ran with the note b",
            "detailedContent": "capture_other ran with the note b",
            "contents": [
              {
                "type": "text",
                "text": "capture_other ran with the note b"
              }
            ]
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_message_chunk",
          "content": {
            "type": "text",
            "text": "- capture_approved: \"capture_approved ran with the note a\"\n- capture_other: \"capture_other ran with the note b\""
          }
        }
      }
    }
  ]
};
