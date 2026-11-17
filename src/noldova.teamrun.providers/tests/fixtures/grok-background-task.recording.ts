/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const GrokBackgroundTaskRecording: { readonly source: string; readonly turn: readonly JsonObject[]; readonly afterTurn: readonly JsonObject[] } = {
  "source": "Grok 1.0.62, one turn that ran a 60-second wait in the background, recorded 2026-10-23",
  "turn": [
    {
      "method": "_x.ai/queue/changed",
      "params": {
        "entries": [],
        "runningPromptId": "PROMPT",
        "runningText": "Start this command as a background task and don't wait for it to finish: Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'. Then reply in one line that it started. Run no other command and change no files.",
        "runningKind": "prompt"
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "agent_message_chunk",
          "content": {
            "type": "text",
            "text": "Starting"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " command"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " in"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " background"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " without"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " waiting"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
        },
        "_meta": {
          "promptId": "PROMPT"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call",
          "toolCallId": "CALL",
          "title": "run_terminal_command",
          "rawInput": {
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "description": "Start 60s background wait command",
            "block_until_ms": 0
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
        },
        "_meta": {
          "promptId": "PROMPT"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "CALL",
          "kind": "execute",
          "title": "Execute `Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'`",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Start 60s background wait command"
              }
            }
          ],
          "locations": [],
          "rawInput": {
            "variant": "Bash",
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "description": "Start 60s background wait command",
            "is_background": false,
            "block_until_ms": 0
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
                "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
                "description": "Start 60s background wait command"
              }
            }
          }
        },
        "_meta": {
          "promptId": "PROMPT"
        }
      }
    },
    {
      "method": "_x.ai/task_backgrounded",
      "params": {
        "update": {
          "sessionUpdate": "task_backgrounded",
          "tool_call_id": "CALL",
          "task_id": "TASK",
          "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
          "cwd": "/work",
          "output_file": "/home/person/.grok/sessions/%2Fwork/SESSION/terminal/CALL.log",
          "description": "Start 60s background wait command"
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "background_tasks",
          "tasks": [
            {
              "task_id": "TASK",
              "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
              "description": "Start 60s background wait command",
              "cwd": "/work",
              "kind": "bash",
              "status": "running",
              "started_at": "2026-10-23T22:39:51.306870100+00:00",
              "output_file": "/home/person/.grok/sessions/%2Fwork/SESSION/terminal/CALL.log"
            }
          ]
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "CALL",
          "status": "completed",
          "title": "[bg] Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done' (01a16aeb)",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "Background task TASK started"
              }
            }
          ],
          "rawOutput": {
            "type": "BackgroundTaskStarted",
            "task_id": "TASK",
            "pid": 0,
            "task_type": "bash",
            "output_file": "/home/person/.grok/sessions/%2Fwork/SESSION/terminal/CALL.log",
            "status": "running",
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "summary": "Background task TASK started",
            "retrieval_hint": "Use get_command_or_subagent_output with task_ids=[\"TASK\"] when you need the output."
          }
        },
        "_meta": {
          "promptId": "PROMPT"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "CALL",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "background wait started"
              }
            }
          ],
          "rawOutput": {
            "type": "Bash",
            "output_for_prompt": "background wait started",
            "exit_code": 0,
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "truncated": false,
            "signal": null,
            "timed_out": false,
            "description": null,
            "current_dir": "/work",
            "output_file": "",
            "total_bytes": 23
          }
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "CALL",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "background wait started\r\n"
              }
            }
          ],
          "rawOutput": {
            "type": "Bash",
            "output_for_prompt": "background wait started\n",
            "exit_code": 0,
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "truncated": false,
            "signal": null,
            "timed_out": false,
            "description": null,
            "current_dir": "/work",
            "output_file": "",
            "total_bytes": 25
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
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " background"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
            "text": " wait"
          }
        },
        "_meta": {
          "promptId": "PROMPT"
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
        },
        "_meta": {
          "promptId": "PROMPT"
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
        },
        "_meta": {
          "promptId": "PROMPT"
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "PROMPT",
          "stop_reason": "end_turn",
          "usage": {
            "inputTokens": 34266,
            "outputTokens": 583,
            "cachedReadTokens": 17280,
            "cacheCreationTokens": 0,
            "reasoningTokens": 515,
            "modelCalls": 2,
            "apiDurationMs": 9598,
            "costUsdTicks": 156774000,
            "modelUsage": {
              "grok-4.6-build": {
                "inputTokens": 34266,
                "outputTokens": 583,
                "cachedReadTokens": 17280,
                "cacheCreationTokens": 0,
                "reasoningTokens": 515,
                "modelCalls": 2,
                "apiDurationMs": 9598,
                "costUsdTicks": 156774000
              }
            },
            "numTurns": 2
          },
          "elapsed_ms": 9743
        }
      }
    }
  ],
  "afterTurn": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "tool_call_update",
          "toolCallId": "CALL",
          "content": [
            {
              "type": "content",
              "content": {
                "type": "text",
                "text": "background wait started\r\nbackground wait done"
              }
            }
          ],
          "rawOutput": {
            "type": "Bash",
            "output_for_prompt": "background wait started\nbackground wait done",
            "exit_code": 0,
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "truncated": false,
            "signal": null,
            "timed_out": false,
            "description": null,
            "current_dir": "/work",
            "output_file": "",
            "total_bytes": 45
          }
        }
      }
    },
    {
      "method": "_x.ai/queue/changed",
      "params": {
        "entries": [],
        "runningPromptId": "task-completed-TASK",
        "runningText": "<system-reminder>\nBackground task \"TASK\" completed (exit code: 0).\nDescription: Start 60s background wait command | Duration: 60.2s\nUse get_command_or_subagent_output(\"TASK\") to see the full output.\n</system-reminder>",
        "runningKind": "prompt"
      }
    },
    {
      "method": "_x.ai/task_completed",
      "params": {
        "update": {
          "sessionUpdate": "task_completed",
          "task_snapshot": {
            "task_id": "TASK",
            "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
            "cwd": "/work",
            "start_time": {
              "secs_since_epoch": 1792795191,
              "nanos_since_epoch": 306870100
            },
            "end_time": {
              "secs_since_epoch": 1792795251,
              "nanos_since_epoch": 511619800
            },
            "output": "background wait started\r\nbackground wait done\r\n",
            "output_file": "/home/person/.grok/sessions/%2Fwork/SESSION/terminal/CALL.log",
            "truncated": false,
            "output_total_bytes": 47,
            "exit_code": 0,
            "signal": null,
            "completed": true,
            "kind": "bash",
            "block_waited": false,
            "explicitly_killed": false,
            "kill_result_delivered": false,
            "owner_session_id": "SESSION",
            "description": "Start 60s background wait command",
            "is_backgrounded": true
          },
          "will_wake": true
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "background_tasks",
          "tasks": [
            {
              "task_id": "TASK",
              "command": "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'",
              "description": "Start 60s background wait command",
              "cwd": "/work",
              "kind": "bash",
              "status": "completed",
              "started_at": "2026-10-23T22:39:51.306870100+00:00",
              "ended_at": "2026-10-23T22:40:51.511619800+00:00",
              "output_file": "/home/person/.grok/sessions/%2Fwork/SESSION/terminal/CALL.log",
              "exit_code": 0
            }
          ]
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
        },
        "_meta": {
          "promptId": "task-completed-TASK"
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
            "text": " background"
          }
        },
        "_meta": {
          "promptId": "task-completed-TASK"
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
            "text": " wait"
          }
        },
        "_meta": {
          "promptId": "task-completed-TASK"
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
            "text": " finished"
          }
        },
        "_meta": {
          "promptId": "task-completed-TASK"
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
        },
        "_meta": {
          "promptId": "task-completed-TASK"
        }
      }
    },
    {
      "method": "_x.ai/session_notification",
      "params": {
        "update": {
          "sessionUpdate": "turn_completed",
          "prompt_id": "task-completed-TASK",
          "stop_reason": "end_turn",
          "usage": {
            "inputTokens": 17768,
            "outputTokens": 226,
            "cachedReadTokens": 17536,
            "cacheCreationTokens": 0,
            "reasoningTokens": 221,
            "modelCalls": 1,
            "apiDurationMs": 4428,
            "costUsdTicks": 35999200,
            "modelUsage": {
              "grok-4.6-build": {
                "inputTokens": 17768,
                "outputTokens": 226,
                "cachedReadTokens": 17536,
                "cacheCreationTokens": 0,
                "reasoningTokens": 221,
                "modelCalls": 1,
                "apiDurationMs": 4428,
                "costUsdTicks": 35999200
              }
            },
            "numTurns": 1
          },
          "elapsed_ms": 4554
        }
      }
    }
  ]
};
