/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const GrokFailedImageRecording: { readonly source: string; readonly messages: readonly JsonObject[]; readonly reply: JsonObject } = {
  "source": "Grok 1.0.70, one turn whose image_gen call failed on an aspect ratio Grok's image service refuses, recorded 2026-10-26; each run of message or thought chunks joined into one, and usage, signatures, the commands list and the session, prompt and event ids left out",
  "messages": [
    {
      "method": "_x.ai/queue/changed",
      "params": {
        "entries": [
          {
            "id": "prompt",
            "version": 0,
            "kind": "prompt",
            "text": "Call your image_gen tool exactly once, with prompt \"a small red square on a white background\" and aspect_ratio \"7:1\", exactly as written. Do not change the values, do not call it again and call no other tool. If the call fails, reply with its error in one line.",
            "position": 0
          }
        ]
      }
    },
    {
      "method": "_x.ai/queue/changed",
      "params": {
        "entries": [],
        "runningPromptId": "prompt",
        "runningText": "Call your image_gen tool exactly once, with prompt \"a small red square on a white background\" and aspect_ratio \"7:1\", exactly as written. Do not change the values, do not call it again and call no other tool. If the call fails, reply with its error in one line.",
        "runningKind": "prompt"
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_thought_chunk",
          "content": {
            "type": "text",
            "text": "I will call the image_gen tool once with the exact prompt and aspect ratio provided.\n\nI will not load the imagine skill first. I will call no other tool."
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
            "text": "I'll generate the image once with the prompt and aspect ratio you specified."
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_delta_chunk",
          "tool_call_id": "call-1",
          "tool_index": 0,
          "name": "image_gen"
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_delta_chunk",
          "tool_index": 0,
          "arguments_delta": "{\"prompt\":\"a small red square on a white background\",\"aspect_ratio\":\"7:1\"}"
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "response_completed"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "call-1",
          "title": "image_gen",
          "rawInput": {
            "prompt": "a small red square on a white background",
            "aspect_ratio": "7:1"
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "image_gen",
              "kind": "image_gen",
              "namespace": "grok_build",
              "label": "Generate Image",
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
          "title": "imagine: a small red square on a white background",
          "locations": [],
          "rawInput": {
            "variant": "ImageGen",
            "prompt": "a small red square on a white background",
            "aspect_ratio": "7:1"
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "image_gen",
              "kind": "image_gen",
              "namespace": "grok_build",
              "label": "Generate Image",
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
          "title": "imagine: a small red square on a white background",
          "rawInput": {
            "variant": "ImageGen",
            "prompt": "a small red square on a white background",
            "aspect_ratio": "7:1"
          },
          "_meta": {
            "x.ai/tool": {
              "version": 1,
              "name": "image_gen",
              "kind": "image_gen",
              "namespace": "grok_build",
              "label": "Generate Image",
              "read_only": false
            }
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
                "text": "Tool `image_gen` failed: Image generation failed with HTTP 422 Unprocessable Entity: Failed to deserialize the JSON body into the target type: aspect_ratio: unknown variant `7:1`, expected one of `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2`, `9:19.5`, `19.5:9`, `9:20`, `20:9`, `1"
              }
            }
          ],
          "rawOutput": {
            "error": "tool_execution_failed",
            "message": "Image generation failed with HTTP 422 Unprocessable Entity: Failed to deserialize the JSON body into the target type: aspect_ratio: unknown variant `7:1`, expected one of `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2`, `9:19.5`, `19.5:9`, `9:20`, `20:9`, `1"
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "session_summary_generated",
          "session_summary": "Generate small red square 7:1 image"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "session_info_update",
          "title": "Generate small red square 7:1 image"
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
            "text": "Image generation failed with HTTP 422 Unprocessable Entity: Failed to deserialize the JSON body into the target type: aspect_ratio: unknown variant `7:1`, expected one of `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2`, `9:19.5`, `19.5:9`, `9:20`, `20:9`, `1`"
          }
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "response_completed"
        }
      }
    },
    {
      "method": "_x.ai/queue/changed",
      "params": {
        "entries": []
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "prompt",
          "stop_reason": "end_turn",
          "elapsed_ms": 5517
        }
      }
    },
    {
      "method": "_x.ai/session/prompt_complete",
      "params": {
        "promptId": "prompt",
        "stopReason": "end_turn",
        "agentResult": null
      }
    }
  ],
  "reply": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow-once"
    }
  }
};
