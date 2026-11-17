/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const GrokSubAgentEndsRecording: { readonly source: string; readonly failed: readonly JsonObject[]; readonly cancelled: readonly JsonObject[] } = {
  "source": "Grok 1.0.70, recorded 2026-11-03: one turn whose spawn_subagent call failed before any sub-agent started, and one whose background sub-agent was cancelled with x.ai/subagent/cancel while it ran a command, with sample ids and paths",
  "failed": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_message_chunk",
          "content": {
            "type": "text",
            "text": "I'll"
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
            "text": " spawn"
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
            "text": " the"
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
            "text": " requested"
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
            "text": " sub"
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
            "text": "agent"
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
            "text": " now"
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
            "text": "."
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "tool-1",
          "title": "spawn_subagent",
          "rawInput": {
            "prompt": "Read notes.txt in the current folder and report its marker.",
            "description": "Read notes.txt marker",
            "model": "no-such-agent-type"
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            },
            "subagentBackground": true
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "tool-1",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-1",
          "kind": "other",
          "title": "Read notes.txt marker",
          "locations": [],
          "rawInput": {
            "variant": "Task",
            "prompt": "Read notes.txt in the current folder and report its marker.",
            "description": "Read notes.txt marker",
            "run_in_background": true,
            "model": "no-such-agent-type",
            "task_id": null
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "id": "permission-0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "tool-1",
          "kind": "other",
          "title": "Read notes.txt marker",
          "rawInput": {
            "variant": "Task",
            "prompt": "Read notes.txt in the current folder and report its marker.",
            "description": "Read notes.txt marker",
            "run_in_background": true,
            "model": "no-such-agent-type",
            "task_id": null
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            },
            "x.ai/requestingSessionId": "grok-session"
          }
        },
        "options": [
          {
            "optionId": "allow-once",
            "name": "Yes, send once",
            "kind": "allow_once"
          },
          {
            "optionId": "reject-once",
            "name": "No, and tell Grok what to do differently",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "interaction_resolved",
          "tool_call_id": "tool-1"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-1",
          "status": "failed",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Tool `spawn_subagent` failed: Unknown Task.model slug 'no-such-agent-type'. Valid model slugs: grok-4.5, grok-4.6, grok-4.7, grok-4.7-build-fast. Omit `model` to inherit the parent model."
              }
            }
          ],
          "rawOutput": {
            "error": "tool_execution_failed",
            "message": "Unknown Task.model slug 'no-such-agent-type'. Valid model slugs: grok-4.5, grok-4.6, grok-4.7, grok-4.7-build-fast. Omit `model` to inherit the parent model."
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
            "text": "The"
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
            "text": " spawn"
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
            "text": "_"
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
            "text": "sub"
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
            "text": "agent"
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
            "text": " call"
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
            "text": " failed"
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
            "text": ":"
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
            "text": " `"
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
            "text": "no"
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
            "text": "-"
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
            "text": "such"
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
            "text": "-"
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
            "text": "agent"
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
            "text": "-"
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
            "text": "type"
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
            "text": "`"
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
            "text": " is"
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
            "text": " not"
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
            "text": " a"
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
            "text": " valid"
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
            "text": " sub"
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
            "text": "agent"
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
            "text": " type"
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
            "text": "."
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "prompt",
          "stop_reason": "end_turn",
          "usage": {
            "inputTokens": 33879,
            "outputTokens": 569,
            "totalTokens": 34448,
            "cachedReadTokens": 17792,
            "cacheCreationTokens": 0,
            "reasoningTokens": 496,
            "modelCalls": 2,
            "apiDurationMs": 7102,
            "costUsdTicks": 151245600,
            "modelUsage": {
              "grok-4.6-build": {
                "inputTokens": 33879,
                "outputTokens": 569,
                "totalTokens": 34448,
                "cachedReadTokens": 17792,
                "cacheCreationTokens": 0,
                "reasoningTokens": 496,
                "modelCalls": 2,
                "apiDurationMs": 7102,
                "costUsdTicks": 151245600
              }
            },
            "numTurns": 2
          },
          "elapsed_ms": 7436
        }
      }
    }
  ],
  "cancelled": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_message_chunk",
          "content": {
            "type": "text",
            "text": "I'll"
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
            "text": " start"
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
            "text": " that"
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
            "text": " sub"
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
            "text": "agent"
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
            "text": " now"
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
            "text": "."
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "tool-1",
          "title": "spawn_subagent",
          "rawInput": {
            "description": "Sleep 120 then report",
            "prompt": "Run the shell command `sleep 120` and then report done. Do nothing else.",
            "background": true
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            },
            "subagentBackground": true
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "tool-1",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-1",
          "kind": "other",
          "title": "Sleep 120 then report",
          "locations": [],
          "rawInput": {
            "variant": "Task",
            "prompt": "Run the shell command `sleep 120` and then report done. Do nothing else.",
            "description": "Sleep 120 then report",
            "run_in_background": true,
            "task_id": null
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "id": "permission-0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "tool-1",
          "kind": "other",
          "title": "Sleep 120 then report",
          "rawInput": {
            "variant": "Task",
            "prompt": "Run the shell command `sleep 120` and then report done. Do nothing else.",
            "description": "Sleep 120 then report",
            "run_in_background": true,
            "task_id": null
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "spawn_subagent",
              "kind": "task",
              "namespace": "grok_build",
              "label": "Subagent",
              "read_only": false
            },
            "x.ai/requestingSessionId": "grok-session"
          }
        },
        "options": [
          {
            "optionId": "allow-once",
            "name": "Yes, send once",
            "kind": "allow_once"
          },
          {
            "optionId": "reject-once",
            "name": "No, and tell Grok what to do differently",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "interaction_resolved",
          "tool_call_id": "tool-1"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-1",
          "status": "completed",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Subagent started in background.\nsubagent_id: grok-child\ndescription: Sleep 120 then report\n\nWhen you need its result, use get_command_or_subagent_output with task_ids=[\"grok-child\"] and a positive timeout_ms."
              }
            }
          ],
          "rawOutput": {
            "type": "Text",
            "text": "Subagent started in background.\nsubagent_id: grok-child\ndescription: Sleep 120 then report\n\nWhen you need its result, use get_command_or_subagent_output with task_ids=[\"grok-child\"] and a positive timeout_ms."
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "subagent_spawned",
          "subagent_id": "grok-child",
          "attempt_id": "attempt",
          "parent_session_id": "grok-session",
          "parent_prompt_id": "prompt",
          "child_session_id": "grok-child",
          "subagent_type": "general-purpose",
          "description": "Sleep 120 then report",
          "effective_context_source": "new",
          "model": "grok-4.7",
          "agentAddress": "agent-address"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "user_message_chunk",
          "content": {
            "type": "text",
            "text": "Run the shell command `sleep 120` and then report done. Do nothing else."
          },
          "_meta": {
            "modelId": "grok-4.7",
            "promptIndex": 0
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
            "text": "The"
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
            "text": " sub"
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
            "text": "agent"
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
            "text": " started"
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
            "text": "."
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "prompt",
          "stop_reason": "end_turn",
          "usage": {
            "inputTokens": 36099,
            "outputTokens": 661,
            "totalTokens": 36760,
            "cachedReadTokens": 19840,
            "cacheCreationTokens": 0,
            "reasoningTokens": 608,
            "modelCalls": 2,
            "apiDurationMs": 9138,
            "modelUsage": {
              "grok-4.7-build": {
                "inputTokens": 36099,
                "outputTokens": 661,
                "totalTokens": 36760,
                "cachedReadTokens": 19840,
                "cacheCreationTokens": 0,
                "reasoningTokens": 608,
                "modelCalls": 2,
                "apiDurationMs": 9138
              }
            },
            "numTurns": 2,
            "usageIsIncomplete": true
          },
          "elapsed_ms": 9313
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "tool-2",
          "title": "run_terminal_command",
          "rawInput": {
            "command": "sleep 120",
            "description": "Sleep for 120 seconds then finish",
            "block_until_ms": 130000
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "run_terminal_command",
              "kind": "execute",
              "namespace": "grok_build",
              "label": "Run Command",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "tool-2",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-2",
          "kind": "execute",
          "title": "Execute `sleep 120`",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Sleep for 120 seconds then finish"
              }
            }
          ],
          "locations": [],
          "rawInput": {
            "variant": "Bash",
            "command": "sleep 120",
            "description": "Sleep for 120 seconds then finish",
            "is_background": false,
            "block_until_ms": 130000
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "run_terminal_command",
              "kind": "execute",
              "namespace": "grok_build",
              "label": "Run Command",
              "read_only": false,
              "input": {
                "command": "sleep 120",
                "description": "Sleep for 120 seconds then finish"
              }
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "interaction_resolved",
          "tool_call_id": "tool-2"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "tool-2",
          "status": "in_progress",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": ""
              }
            }
          ],
          "rawOutput": {
            "type": "Bash",
            "output": [],
            "output_for_prompt": "",
            "exit_code": 0,
            "command": "sleep 120",
            "truncated": false,
            "signal": null,
            "timed_out": false,
            "description": null,
            "current_dir": "/work",
            "output_file": "",
            "total_bytes": 0
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "subagent_progress",
          "subagent_id": "grok-child",
          "attempt_id": "attempt",
          "parent_session_id": "grok-session",
          "child_session_id": "grok-child",
          "duration_ms": 2149,
          "turn_count": 1,
          "tool_call_count": 0,
          "tokens_used": 1095,
          "context_window_tokens": 256000,
          "context_usage_pct": 0,
          "tools_used": [],
          "error_count": 0
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "subagent_progress",
          "subagent_id": "grok-child",
          "attempt_id": "attempt",
          "parent_session_id": "grok-session",
          "child_session_id": "grok-child",
          "duration_ms": 10150,
          "turn_count": 1,
          "tool_call_count": 0,
          "tokens_used": 1095,
          "context_window_tokens": 256000,
          "context_usage_pct": 0,
          "tools_used": [],
          "error_count": 0
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "sessionId": "grok-child",
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "prompt",
          "stop_reason": "cancelled",
          "usage": {
            "inputTokens": 10766,
            "outputTokens": 109,
            "totalTokens": 10875,
            "cachedReadTokens": 1792,
            "cacheCreationTokens": 0,
            "reasoningTokens": 75,
            "modelCalls": 1,
            "apiDurationMs": 1742,
            "costUsdTicks": 66293200,
            "modelUsage": {
              "grok-4.7-build": {
                "inputTokens": 10766,
                "outputTokens": 109,
                "totalTokens": 10875,
                "cachedReadTokens": 1792,
                "cacheCreationTokens": 0,
                "reasoningTokens": 75,
                "modelCalls": 1,
                "apiDurationMs": 1742,
                "costUsdTicks": 66293200
              }
            },
            "numTurns": 1
          },
          "elapsed_ms": 14867
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "subagent_finished",
          "subagent_id": "grok-child",
          "attempt_id": "attempt",
          "child_session_id": "grok-child",
          "status": "cancelled",
          "error": "Subagent was cancelled",
          "tool_calls": 0,
          "turns": 1,
          "duration_ms": 15016,
          "tokens_used": 0,
          "will_wake": false
        }
      }
    }
  ]
};
