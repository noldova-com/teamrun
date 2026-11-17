/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const GrokQuestionRecording: { readonly source: string; readonly accepted: { readonly messages: readonly JsonObject[]; readonly reply: JsonObject };
  readonly cancelled: { readonly messages: readonly JsonObject[]; readonly reply: JsonObject }; } = {
  "source": "Grok 1.0.70, two turns that each asked the same two questions with ask_user_question, recorded 2026-10-25: one the client answered, one it cancelled",
  "accepted": {
    "messages": [
      {
        "method": "_x.ai/queue/changed",
        "params": {
          "entries": [
            {
              "id": "prompt",
              "version": 0,
              "kind": "prompt",
              "text": "Use your ask_user_question tool once to ask me exactly two questions: which color I prefer, with the options Red and Blue, and which sizes I want, as a multi-select with the options Small and Large. Then tell me, in one sentence, what I answered. Don't edit any file or run any command.",
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
          "runningText": "Use your ask_user_question tool once to ask me exactly two questions: which color I prefer, with the options Red and Blue, and which sizes I want, as a multi-select with the options Small and Large. Then tell me, in one sentence, what I answered. Don't edit any file or run any command.",
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
              "text": "I will ask the user two questions: their preferred color (Red or Blue) and their desired sizes (Small or Large). Then I will summarize their answers in one sentence."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-4",
            "agentTimestampMs": 1792958451384,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "AgentThoughtChunk",
            "chunkId": 1
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "session_summary_generated",
            "session_summary": "Ask color preference and multi-select sizes"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "session_info_update",
            "title": "Ask color preference and multi-select sizes"
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
              "text": "\n\nI will use the exact option labels Red, Blue, Small, and Large without adding \"(Recommended)\". Each option needs a description."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-12",
            "agentTimestampMs": 1792958456981,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "AgentThoughtChunk",
            "chunkId": 9
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
              "text": "I'll ask those two questions now."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-14",
            "agentTimestampMs": 1792958457096,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "AgentMessageChunk",
            "chunkId": 11
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "response_completed",
            "usage": {
              "input_tokens": 13507,
              "output_tokens": 897,
              "cache_read_input_tokens": 1536,
              "cache_creation_input_tokens": 0,
              "reasoning_tokens": 781
            }
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call",
            "toolCallId": "tool",
            "title": "ask_user_question",
            "rawInput": {
              "questions": [
                {
                  "question": "Which color do you prefer?",
                  "options": [
                    {
                      "label": "Red",
                      "description": "Prefer the color red."
                    },
                    {
                      "label": "Blue",
                      "description": "Prefer the color blue."
                    }
                  ]
                },
                {
                  "question": "Which sizes do you want?",
                  "options": [
                    {
                      "label": "Small",
                      "description": "Include the small size."
                    },
                    {
                      "label": "Large",
                      "description": "Include the large size."
                    }
                  ],
                  "multi_select": true
                }
              ]
            },
            "_meta": {
              "x.ai/tool": {
                "version": 1,
                "name": "ask_user_question",
                "kind": "ask_user",
                "namespace": "grok_build",
                "label": "Ask User",
                "read_only": true
              }
            }
          },
          "_meta": {
            "totalTokens": 15947,
            "requestTrimmedTokens": 0,
            "eventId": "event-22",
            "agentTimestampMs": 1792958457607,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "ToolCall",
            "updateParams": {
              "toolCallId": "tool",
              "title": "ask_user_question",
              "kind": "Other",
              "status": "Pending"
            }
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "pending_interaction",
            "tool_call_id": "tool",
            "kind": "permission"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tool",
            "kind": "other",
            "title": "Ask 2 questions",
            "locations": [],
            "rawInput": {
              "variant": "AskUserQuestion",
              "questions": [
                {
                  "question": "Which color do you prefer?",
                  "options": [
                    {
                      "label": "Red",
                      "description": "Prefer the color red."
                    },
                    {
                      "label": "Blue",
                      "description": "Prefer the color blue."
                    }
                  ],
                  "multiSelect": null
                },
                {
                  "question": "Which sizes do you want?",
                  "options": [
                    {
                      "label": "Small",
                      "description": "Include the small size."
                    },
                    {
                      "label": "Large",
                      "description": "Include the large size."
                    }
                  ],
                  "multiSelect": true
                }
              ]
            },
            "_meta": {
              "x.ai/tool": {
                "version": 1,
                "name": "ask_user_question",
                "kind": "ask_user",
                "namespace": "grok_build",
                "label": "Ask User",
                "read_only": true
              }
            }
          },
          "_meta": {
            "totalTokens": 15947,
            "requestTrimmedTokens": 0,
            "eventId": "event-23",
            "agentTimestampMs": 1792958457607,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "ToolCallUpdate",
            "updateParams": {
              "toolCallId": "tool",
              "status": null
            }
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "interaction_resolved",
            "tool_call_id": "tool"
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "pending_interaction",
            "tool_call_id": "tool",
            "kind": "question"
          }
        }
      },
      {
        "id": "question",
        "method": "_x.ai/ask_user_question",
        "params": {
          "toolCallId": "tool",
          "questions": [
            {
              "question": "Which color do you prefer?",
              "options": [
                {
                  "label": "Red",
                  "description": "Prefer the color red."
                },
                {
                  "label": "Blue",
                  "description": "Prefer the color blue."
                }
              ],
              "multiSelect": null
            },
            {
              "question": "Which sizes do you want?",
              "options": [
                {
                  "label": "Small",
                  "description": "Include the small size."
                },
                {
                  "label": "Large",
                  "description": "Include the large size."
                }
              ],
              "multiSelect": true
            }
          ],
          "mode": "default"
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "interaction_resolved",
            "tool_call_id": "tool"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tool",
            "status": "completed",
            "content": [
              {
                "type": "content",
                "content": {
                  "type": "text",
                  "text": "User has answered your questions: \"Which color do you prefer?\"=\"Red\", \"Which sizes do you want?\"=\"Small, Large\" user notes: And one more note.. You can now continue with the user's answers in mind."
                }
              }
            ],
            "rawOutput": {
              "type": "AskUserQuestion",
              "UserAnswered": {
                "message": "User has answered your questions: \"Which color do you prefer?\"=\"Red\", \"Which sizes do you want?\"=\"Small, Large\" user notes: And one more note.. You can now continue with the user's answers in mind.",
                "answers": [
                  {
                    "question": "Which color do you prefer?",
                    "options": [
                      "Red",
                      "Blue"
                    ],
                    "descriptions": [
                      "Prefer the color red.",
                      "Prefer the color blue."
                    ],
                    "picked": [
                      "Red"
                    ]
                  },
                  {
                    "question": "Which sizes do you want?",
                    "options": [
                      "Small",
                      "Large"
                    ],
                    "descriptions": [
                      "Include the small size.",
                      "Include the large size."
                    ],
                    "multiSelect": true,
                    "picked": [
                      "Small",
                      "Large"
                    ],
                    "typed": "And one more note."
                  }
                ]
              }
            }
          },
          "_meta": {
            "totalTokens": 15947,
            "requestTrimmedTokens": 0,
            "eventId": "event-24",
            "agentTimestampMs": 1792958457609,
            "promptId": "prompt",
            "streamStartMs": 1792958449935,
            "turnStartMs": 1792958449545,
            "updateType": "ToolCallUpdate",
            "updateParams": {
              "toolCallId": "tool",
              "status": "Completed"
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
              "text": "You prefer Red, and you want both Small and Large."
            }
          },
          "_meta": {
            "totalTokens": 15996,
            "requestTrimmedTokens": 0,
            "eventId": "event-27",
            "agentTimestampMs": 1792958459084,
            "promptId": "prompt",
            "streamStartMs": 1792958458591,
            "turnStartMs": 1792958449545,
            "updateType": "AgentMessageChunk",
            "chunkId": 1
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "response_completed",
            "usage": {
              "input_tokens": 1018,
              "output_tokens": 69,
              "cache_read_input_tokens": 14976,
              "cache_creation_input_tokens": 0,
              "reasoning_tokens": 57
            }
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
            "usage": {
              "inputTokens": 31037,
              "outputTokens": 966,
              "totalTokens": 32003,
              "cachedReadTokens": 16512,
              "cacheCreationTokens": 0,
              "reasoningTokens": 838,
              "modelCalls": 2,
              "apiDurationMs": 9550,
              "costUsdTicks": 146546800,
              "modelUsage": {
                "grok-4.7-build": {
                  "inputTokens": 31037,
                  "outputTokens": 966,
                  "totalTokens": 32003,
                  "cachedReadTokens": 16512,
                  "cacheCreationTokens": 0,
                  "reasoningTokens": 838,
                  "modelCalls": 2,
                  "apiDurationMs": 9550,
                  "costUsdTicks": 146546800
                }
              },
              "numTurns": 2
            },
            "elapsed_ms": 9662
          },
          "_meta": {
            "eventId": "event-42",
            "agentTimestampMs": 1792958459208
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
      "outcome": "accepted",
      "answers": {
        "Which color do you prefer?": [
          "Red"
        ],
        "Which sizes do you want?": [
          "Small",
          "Large"
        ]
      },
      "annotations": {
        "Which sizes do you want?": {
          "notes": "And one more note."
        }
      }
    }
  },
  "cancelled": {
    "messages": [
      {
        "method": "_x.ai/queue/changed",
        "params": {
          "entries": [
            {
              "id": "prompt",
              "version": 0,
              "kind": "prompt",
              "text": "Use your ask_user_question tool once to ask me exactly two questions: which color I prefer, with the options Red and Blue, and which sizes I want, as a multi-select with the options Small and Large. Then tell me, in one sentence, what I answered. Don't edit any file or run any command.",
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
          "runningText": "Use your ask_user_question tool once to ask me exactly two questions: which color I prefer, with the options Red and Blue, and which sizes I want, as a multi-select with the options Small and Large. Then tell me, in one sentence, what I answered. Don't edit any file or run any command.",
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
              "text": "I will ask the user two questions using the ask_user_question tool. I will then summarize their answers in one sentence."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-4",
            "agentTimestampMs": 1792958479662,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "AgentThoughtChunk",
            "chunkId": 1
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "session_summary_generated",
            "session_summary": "Ask two questions: color and sizes"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "session_info_update",
            "title": "Ask two questions: color and sizes"
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
              "text": "\n\nI must use the exact option labels the user requested. I will not append \"(Recommended)\" to them."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-10",
            "agentTimestampMs": 1792958483846,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "AgentThoughtChunk",
            "chunkId": 7
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
              "text": "I'll ask those two questions now."
            }
          },
          "_meta": {
            "totalTokens": 1399,
            "requestTrimmedTokens": 0,
            "eventId": "event-15",
            "agentTimestampMs": 1792958485323,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "AgentMessageChunk",
            "chunkId": 12
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "response_completed",
            "usage": {
              "input_tokens": 13506,
              "output_tokens": 877,
              "cache_read_input_tokens": 1536,
              "cache_creation_input_tokens": 0,
              "reasoning_tokens": 761
            }
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call",
            "toolCallId": "tool",
            "title": "ask_user_question",
            "rawInput": {
              "questions": [
                {
                  "question": "Which color do you prefer?",
                  "options": [
                    {
                      "label": "Red",
                      "description": "Prefer the color red."
                    },
                    {
                      "label": "Blue",
                      "description": "Prefer the color blue."
                    }
                  ]
                },
                {
                  "question": "Which sizes do you want?",
                  "options": [
                    {
                      "label": "Small",
                      "description": "Include the small size."
                    },
                    {
                      "label": "Large",
                      "description": "Include the large size."
                    }
                  ],
                  "multi_select": true
                }
              ]
            },
            "_meta": {
              "x.ai/tool": {
                "version": 1,
                "name": "ask_user_question",
                "kind": "ask_user",
                "namespace": "grok_build",
                "label": "Ask User",
                "read_only": true
              }
            }
          },
          "_meta": {
            "totalTokens": 15926,
            "requestTrimmedTokens": 0,
            "eventId": "event-23",
            "agentTimestampMs": 1792958485838,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "ToolCall",
            "updateParams": {
              "toolCallId": "tool",
              "title": "ask_user_question",
              "kind": "Other",
              "status": "Pending"
            }
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "pending_interaction",
            "tool_call_id": "tool",
            "kind": "permission"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tool",
            "kind": "other",
            "title": "Ask 2 questions",
            "locations": [],
            "rawInput": {
              "variant": "AskUserQuestion",
              "questions": [
                {
                  "question": "Which color do you prefer?",
                  "options": [
                    {
                      "label": "Red",
                      "description": "Prefer the color red."
                    },
                    {
                      "label": "Blue",
                      "description": "Prefer the color blue."
                    }
                  ],
                  "multiSelect": null
                },
                {
                  "question": "Which sizes do you want?",
                  "options": [
                    {
                      "label": "Small",
                      "description": "Include the small size."
                    },
                    {
                      "label": "Large",
                      "description": "Include the large size."
                    }
                  ],
                  "multiSelect": true
                }
              ]
            },
            "_meta": {
              "x.ai/tool": {
                "version": 1,
                "name": "ask_user_question",
                "kind": "ask_user",
                "namespace": "grok_build",
                "label": "Ask User",
                "read_only": true
              }
            }
          },
          "_meta": {
            "totalTokens": 15926,
            "requestTrimmedTokens": 0,
            "eventId": "event-24",
            "agentTimestampMs": 1792958485838,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "ToolCallUpdate",
            "updateParams": {
              "toolCallId": "tool",
              "status": null
            }
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "interaction_resolved",
            "tool_call_id": "tool"
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "pending_interaction",
            "tool_call_id": "tool",
            "kind": "question"
          }
        }
      },
      {
        "id": "question",
        "method": "_x.ai/ask_user_question",
        "params": {
          "toolCallId": "tool",
          "questions": [
            {
              "question": "Which color do you prefer?",
              "options": [
                {
                  "label": "Red",
                  "description": "Prefer the color red."
                },
                {
                  "label": "Blue",
                  "description": "Prefer the color blue."
                }
              ],
              "multiSelect": null
            },
            {
              "question": "Which sizes do you want?",
              "options": [
                {
                  "label": "Small",
                  "description": "Include the small size."
                },
                {
                  "label": "Large",
                  "description": "Include the large size."
                }
              ],
              "multiSelect": true
            }
          ],
          "mode": "default"
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "interaction_resolved",
            "tool_call_id": "tool"
          }
        }
      },
      {
        "method": "session/update",
        "params": {
          "update": {
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tool",
            "status": "completed",
            "content": [
              {
                "type": "content",
                "content": {
                  "type": "text",
                  "text": "User declined to answer the questions. Continue with the task using your best judgment, or ask different questions."
                }
              }
            ],
            "rawOutput": {
              "type": "AskUserQuestion",
              "UserAnswered": {
                "message": "User declined to answer the questions. Continue with the task using your best judgment, or ask different questions."
              }
            }
          },
          "_meta": {
            "totalTokens": 15926,
            "requestTrimmedTokens": 0,
            "eventId": "event-25",
            "agentTimestampMs": 1792958485840,
            "promptId": "prompt",
            "streamStartMs": 1792958478080,
            "turnStartMs": 1792958477682,
            "updateType": "ToolCallUpdate",
            "updateParams": {
              "toolCallId": "tool",
              "status": "Completed"
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
              "text": "The user declined to answer the questions."
            }
          },
          "_meta": {
            "totalTokens": 15954,
            "requestTrimmedTokens": 0,
            "eventId": "event-28",
            "agentTimestampMs": 1792958487450,
            "promptId": "prompt",
            "streamStartMs": 1792958486847,
            "turnStartMs": 1792958477682,
            "updateType": "AgentThoughtChunk",
            "chunkId": 1
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
              "text": "You declined to answer, so you selected neither a color nor any sizes."
            }
          },
          "_meta": {
            "totalTokens": 15954,
            "requestTrimmedTokens": 0,
            "eventId": "event-30",
            "agentTimestampMs": 1792958488521,
            "promptId": "prompt",
            "streamStartMs": 1792958486847,
            "turnStartMs": 1792958477682,
            "updateType": "AgentMessageChunk",
            "chunkId": 3
          }
        }
      },
      {
        "method": "_x.ai/session_notification",
        "params": {
          "update": {
            "sessionUpdate": "response_completed",
            "usage": {
              "input_tokens": 971,
              "output_tokens": 192,
              "cache_read_input_tokens": 14976,
              "cache_creation_input_tokens": 0,
              "reasoning_tokens": 177
            }
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
            "usage": {
              "inputTokens": 30989,
              "outputTokens": 1069,
              "totalTokens": 32058,
              "cachedReadTokens": 16512,
              "cacheCreationTokens": 0,
              "reasoningTokens": 938,
              "modelCalls": 2,
              "apiDurationMs": 10828,
              "costUsdTicks": 148321600,
              "modelUsage": {
                "grok-4.7-build": {
                  "inputTokens": 30989,
                  "outputTokens": 1069,
                  "totalTokens": 32058,
                  "cachedReadTokens": 16512,
                  "cacheCreationTokens": 0,
                  "reasoningTokens": 938,
                  "modelCalls": 2,
                  "apiDurationMs": 10828,
                  "costUsdTicks": 148321600
                }
              },
              "numTurns": 2
            },
            "elapsed_ms": 10930
          },
          "_meta": {
            "eventId": "event-48",
            "agentTimestampMs": 1792958488612
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
      "outcome": "cancelled"
    }
  }
};
