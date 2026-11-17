/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export const AntigravitySubAgentRecording: { readonly source: string; readonly ended: readonly JsonObject[]; readonly endedStopReason: string;
  readonly cancelled: readonly JsonObject[]; readonly cancelledStopReason: string;
  readonly failed: readonly JsonObject[]; readonly failedStopReason: string } = {
  "source": "Antigravity 1.3.0 (agy_acp_server) over ACP, signed in, recorded 2026-11-03: one turn whose invoke_subagent started a research sub-agent that read a file, ended with end_turn, one cancelled while its sub-agent ran, and one whose sub-agent of an unknown type failed to start, with sample ids and paths",
  "ended": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "title": "Run invoke_subagent?",
          "kind": "other",
          "status": "pending",
          "rawInput": {
            "Subagents": [
              {
                "Model": "inherit",
                "Prompt": "Please read notes.txt in the current directory (and if not found there, check the active workspace root directories). Report the contents and specifically the marker contained in notes.txt.",
                "Role": "Codebase Researcher",
                "TypeName": "research",
                "Workspace": "inherit"
              }
            ]
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-1",
          "kind": "other",
          "status": "pending",
          "title": "Run invoke_subagent?",
          "rawInput": {
            "Subagents": [
              {
                "Model": "inherit",
                "Prompt": "Please read notes.txt in the current directory (and if not found there, check the active workspace root directories). Report the contents and specifically the marker contained in notes.txt.",
                "Role": "Codebase Researcher",
                "TypeName": "research",
                "Workspace": "inherit"
              }
            ]
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always",
            "kind": "allow_always"
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "title": "Running start_subagent",
          "kind": "other",
          "status": "in_progress",
          "rawInput": {},
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "status": "completed",
          "rawOutput": "Read notes.txt",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "I have launched a sub-agent using `invoke_subagent",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "` to read `notes.txt` and retrieve its marker. I will wait for it to complete before proceeding.",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "CommandLine": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "Cwd": "/home/user",
            "NotificationTimeoutSeconds": 10,
            "RunPersistent": false,
            "WaitMsBeforeAsync": 5000
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-1",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-3",
          "kind": "execute",
          "status": "pending",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "rawInput": {
            "CommandLine": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "Cwd": "/home/user",
            "NotificationTimeoutSeconds": 10,
            "RunPersistent": false,
            "WaitMsBeforeAsync": 5000
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always (risky)",
            "kind": "allow_always",
            "_meta": {
              "agy.security.warning": {
                "severity": "high",
                "risk": "prompt_injection",
                "title": "Allowing always can be risky",
                "message": "Untrusted files or tool output could contain a prompt injection that silently re-runs this action. This approval is scoped to the exact command and the current workspace only."
              }
            }
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "kind": "execute",
          "status": "in_progress",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "rawInput": {
            "command_line": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "working_dir": "/home/user"
          },
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "CommandLine": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "RunPersistent": false,
            "WaitMsBeforeAsync": 5000
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-2",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-4",
          "kind": "execute",
          "status": "pending",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "rawInput": {
            "CommandLine": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "RunPersistent": false,
            "WaitMsBeforeAsync": 5000
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always (risky)",
            "kind": "allow_always",
            "_meta": {
              "agy.security.warning": {
                "severity": "high",
                "risk": "prompt_injection",
                "title": "Allowing always can be risky",
                "message": "Untrusted files or tool output could contain a prompt injection that silently re-runs this action. This approval is scoped to the exact command and the current workspace only."
              }
            }
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "kind": "execute",
          "status": "in_progress",
          "title": "find /home/user -name \"notes.txt\" 2>/dev/null",
          "rawInput": {
            "command_line": "find /home/user -name \"notes.txt\" 2>/dev/null",
            "working_dir": "/work"
          },
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-5",
          "title": "Running view_file",
          "kind": "read",
          "status": "in_progress",
          "locations": [
            {
              "path": "/work/notes.txt"
            }
          ],
          "rawInput": {
            "AbsolutePath": "/work/notes.txt"
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "The marker",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": " in [notes.txt](file:///work",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "/notes.txt) is: **",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "`blue-heron-42`**\n\n**Tool used:** `invoke_subagent`",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-5",
          "status": "completed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "status": "failed",
          "rawOutput": "Tool call was approved but never executed.",
          "sessionUpdate": "tool_call_update"
        }
      }
    }
  ],
  "endedStopReason": "end_turn",
  "cancelled": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "title": "Run invoke_subagent?",
          "kind": "other",
          "status": "pending",
          "rawInput": {
            "Subagents": [
              {
                "Model": "inherit",
                "Prompt": "Please list every file in the current folder, then wait 60 seconds by running the shell command `sleep 60`, and then report the list of files.",
                "Role": "Folder File Researcher",
                "TypeName": "research",
                "Workspace": "inherit"
              }
            ]
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-1",
          "kind": "other",
          "status": "pending",
          "title": "Run invoke_subagent?",
          "rawInput": {
            "Subagents": [
              {
                "Model": "inherit",
                "Prompt": "Please list every file in the current folder, then wait 60 seconds by running the shell command `sleep 60`, and then report the list of files.",
                "Role": "Folder File Researcher",
                "TypeName": "research",
                "Workspace": "inherit"
              }
            ]
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always",
            "kind": "allow_always"
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "title": "Running start_subagent",
          "kind": "other",
          "status": "in_progress",
          "rawInput": {},
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "status": "completed",
          "rawOutput": "Invoke research subagent",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "I have launched",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": " the research subagent to list the files in the current folder, wait 60 seconds using `sleep 60`,",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": " and report the list. I will wait for its result before providing the final answer.",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "title": "ls -la",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "CommandLine": "ls -la",
            "Cwd": "/home/user",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-1",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-3",
          "kind": "execute",
          "status": "pending",
          "title": "ls -la",
          "rawInput": {
            "CommandLine": "ls -la",
            "Cwd": "/home/user",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always (risky)",
            "kind": "allow_always",
            "_meta": {
              "agy.security.warning": {
                "severity": "high",
                "risk": "prompt_injection",
                "title": "Allowing always can be risky",
                "message": "Untrusted files or tool output could contain a prompt injection that silently re-runs this action. This approval is scoped to the exact command and the current workspace only."
              }
            }
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "kind": "execute",
          "status": "in_progress",
          "title": "ls -la",
          "rawInput": {
            "command_line": "ls -la",
            "working_dir": "/home/user"
          },
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-3",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "title": "pwd && ls -la",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "CommandLine": "pwd && ls -la",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-2",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-4",
          "kind": "execute",
          "status": "pending",
          "title": "pwd && ls -la",
          "rawInput": {
            "CommandLine": "pwd && ls -la",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always (risky)",
            "kind": "allow_always",
            "_meta": {
              "agy.security.warning": {
                "severity": "high",
                "risk": "prompt_injection",
                "title": "Allowing always can be risky",
                "message": "Untrusted files or tool output could contain a prompt injection that silently re-runs this action. This approval is scoped to the exact command and the current workspace only."
              }
            }
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "kind": "execute",
          "status": "in_progress",
          "title": "pwd && ls -la",
          "rawInput": {
            "command_line": "pwd && ls -la",
            "working_dir": "/work"
          },
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-4",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-5",
          "title": "ls -la",
          "kind": "execute",
          "status": "pending",
          "rawInput": {
            "CommandLine": "ls -la",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-3",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-5",
          "kind": "execute",
          "status": "pending",
          "title": "ls -la",
          "rawInput": {
            "CommandLine": "ls -la",
            "Cwd": "/work",
            "NotificationTimeoutSeconds": 10,
            "WaitMsBeforeAsync": 5000
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always (risky)",
            "kind": "allow_always",
            "_meta": {
              "agy.security.warning": {
                "severity": "high",
                "risk": "prompt_injection",
                "title": "Allowing always can be risky",
                "message": "Untrusted files or tool output could contain a prompt injection that silently re-runs this action. This approval is scoped to the exact command and the current workspace only."
              }
            }
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-5",
          "kind": "execute",
          "status": "in_progress",
          "title": "ls -la",
          "rawInput": {
            "command_line": "ls -la",
            "working_dir": "/work"
          },
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-5",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "The request was cancelled by the client.",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "status": "failed",
          "rawOutput": "Tool call was approved but never executed.",
          "sessionUpdate": "tool_call_update"
        }
      }
    }
  ],
  "cancelledStopReason": "cancelled",
  "failed": [
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "title": "Run invoke_subagent?",
          "kind": "other",
          "status": "pending",
          "rawInput": {
            "Subagents": [
              {
                "Prompt": "say hi",
                "Role": "Greeting Subagent",
                "TypeName": "no-such-agent-type-889"
              }
            ]
          },
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "id": "permission-0",
      "method": "session/request_permission",
      "params": {
        "toolCall": {
          "toolCallId": "call-1",
          "kind": "other",
          "status": "pending",
          "title": "Run invoke_subagent?",
          "rawInput": {
            "Subagents": [
              {
                "Prompt": "say hi",
                "Role": "Greeting Subagent",
                "TypeName": "no-such-agent-type-889"
              }
            ]
          }
        },
        "options": [
          {
            "optionId": "allow_always",
            "name": "Allow Always",
            "kind": "allow_always"
          },
          {
            "optionId": "allow",
            "name": "Allow",
            "kind": "allow_once"
          },
          {
            "optionId": "deny",
            "name": "Deny",
            "kind": "reject_once"
          }
        ]
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "title": "Running start_subagent",
          "kind": "other",
          "status": "in_progress",
          "rawInput": {},
          "sessionUpdate": "tool_call"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-2",
          "status": "failed",
          "rawOutput": "Tool execution failed",
          "sessionUpdate": "tool_call_update"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "The invocation failed with an error because the sub",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "content": {
            "text": "agent type `no-such-agent-type-889` was not found or not allowed to be invoked.",
            "type": "text"
          },
          "sessionUpdate": "agent_message_chunk"
        }
      }
    },
    {
      "method": "session/update",
      "params": {
        "update": {
          "toolCallId": "call-1",
          "status": "failed",
          "rawOutput": "Tool call was approved but never executed.",
          "sessionUpdate": "tool_call_update"
        }
      }
    }
  ],
  "failedStopReason": "end_turn"
};
