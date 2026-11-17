/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const GrokApprovedToolRecording: { readonly source: string; readonly messages: readonly JsonObject[] } = {
  "source": "Grok 1.0.70, started with a [permission] allow rule for MCPTool(teamrun__capture_approved) in its profile's config.toml, one turn calling two tools of an MCP server named teamrun through use_tool, first by their bare names, which Grok asks about and then refuses as invalid, then by their full names, only teamrun__capture_other asking, recorded 2026-10-27; each run of message or thought chunks joined into one, and usage, timings, the commands list, the queue, model and announcement updates and the session, prompt and event ids left out, with the tool call ids renumbered",
  "messages": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_thought_chunk",
          "content": {
            "type": "text",
            "text": "I will call capture_approved with note \"a\" and capture_other with note \"b\" on the teamrun MCP server.\n\nI will call use_tool directly for both tools, as no other tools are allowed.\n\nI will call the tools sequentially rather than in parallel. I need to determine the exact tool name format for use_tool."
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
            "text": "I'll call `capture_approved` on teamrun with note \"a\" first, then `capture_other` with note \"b\"."
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "call-1",
          "title": "use_tool",
          "rawInput": {
            "tool_name": "capture_approved",
            "tool_input": {
              "note": "a"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "call-1",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-1",
          "kind": "other",
          "title": "capture_approved",
          "locations": [],
          "rawInput": {
            "variant": "UseTool",
            "tool_name": "capture_approved",
            "tool_input": {
              "note": "a"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "id": "0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-1",
          "kind": "other",
          "title": "capture_approved",
          "rawInput": {
            "variant": "UseTool",
            "tool_name": "capture_approved",
            "tool_input": {
              "note": "a"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            },
            "x.ai/requestingSessionId": "grok-session"
          }
        },
        "options": [
          {
            "optionId": "always-allow",
            "name": "always allow",
            "kind": "allow_always"
          },
          {
            "optionId": "allow-once",
            "name": "allow once",
            "kind": "allow_once"
          },
          {
            "optionId": "reject-once",
            "name": "reject once",
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
          "tool_call_id": "call-1"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-1",
          "status": "failed",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Tool `capture_approved` failed via `use_tool`: 'capture_approved' is not a valid MCP tool name. Tool names must be qualified as `server__tool` (e.g., `linear__save_issue`). Use `search_tool` to discover available tools."
              }
            }
          ],
          "rawOutput": {
            "error": "tool_execution_failed",
            "message": "'capture_approved' is not a valid MCP tool name. Tool names must be qualified as `server__tool` (e.g., `linear__save_issue`). Use `search_tool` to discover available tools."
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_thought_chunk",
          "content": {
            "type": "text",
            "text": "The tool names must be qualified as `server__tool`."
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
          "title": "use_tool",
          "rawInput": {
            "tool_name": "teamrun__capture_approved",
            "tool_input": {
              "note": "a"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "call-2",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-2",
          "kind": "other",
          "title": "teamrun__capture_approved",
          "locations": [],
          "rawInput": {
            "variant": "UseTool",
            "tool_name": "teamrun__capture_approved",
            "tool_input": {
              "note": "a"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "interaction_resolved",
          "tool_call_id": "call-2"
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
          "rawOutput": {
            "type": "MCP",
            "tool_name": "capture_approved",
            "server_name": "teamrun",
            "output": {
              "OkayOutput": "capture_approved ran with the note a"
            }
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "call-3",
          "title": "use_tool",
          "rawInput": {
            "tool_name": "teamrun__capture_other",
            "tool_input": {
              "note": "b"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "pending_interaction",
          "tool_call_id": "call-3",
          "kind": "permission"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-3",
          "kind": "other",
          "title": "teamrun__capture_other",
          "locations": [],
          "rawInput": {
            "variant": "UseTool",
            "tool_name": "teamrun__capture_other",
            "tool_input": {
              "note": "b"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            }
          }
        }
      }
    },
    {
      "id": "1",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-3",
          "kind": "other",
          "title": "teamrun__capture_other",
          "rawInput": {
            "variant": "UseTool",
            "tool_name": "teamrun__capture_other",
            "tool_input": {
              "note": "b"
            }
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "use_tool",
              "kind": "use_tool",
              "namespace": "grok_build",
              "label": "Use Tool",
              "read_only": false
            },
            "x.ai/requestingSessionId": "grok-session"
          }
        },
        "options": [
          {
            "optionId": "always-allow",
            "name": "always allow",
            "kind": "allow_always"
          },
          {
            "optionId": "allow-once",
            "name": "allow once",
            "kind": "allow_once"
          },
          {
            "optionId": "reject-once",
            "name": "reject once",
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
          "tool_call_id": "call-3"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "call-3",
          "status": "completed",
          "rawOutput": {
            "type": "MCP",
            "tool_name": "capture_other",
            "server_name": "teamrun",
            "output": {
              "OkayOutput": "capture_other ran with the note b"
            }
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
            "text": "`capture_approved` returned: capture_approved ran with the note a.\n\n`capture_other` returned: capture_other ran with the note b."
          }
        }
      }
    },
    {
      "method": "_x.ai/session/prompt_complete",
      "params": {
        "promptId": "prompt",
        "stopReason": "end_turn"
      }
    }
  ]
};
