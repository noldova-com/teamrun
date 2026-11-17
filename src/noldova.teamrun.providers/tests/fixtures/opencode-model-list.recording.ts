/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const OpencodeModelListRecording: { readonly source: string; readonly output: string } = {
  "source": "OpenCode 1.19.5 (Linux, x64), live, not signed in: the first three model blocks of opencode models --verbose, as printed, recorded 2026-11-03",
  "output": `opencode/beam-free
{
  "id": "beam-free",
  "providerID": "opencode",
  "name": "Beam Free",
  "family": "beam",
  "api": {
    "id": "beam-free",
    "url": "https://opencode.ai/inference/openai/v1",
    "npm": "@ai-sdk/openai-compatible"
  },
  "status": "active",
  "headers": {},
  "options": {},
  "cost": {
    "input": 0,
    "output": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  },
  "limit": {
    "context": 1048576,
    "output": 131072
  },
  "capabilities": {
    "temperature": true,
    "reasoning": true,
    "attachment": false,
    "toolcall": true,
    "input": {
      "text": true,
      "audio": false,
      "image": false,
      "video": false,
      "pdf": false
    },
    "output": {
      "text": true,
      "audio": false,
      "image": false,
      "video": false,
      "pdf": false
    },
    "interleaved": {
      "field": "reasoning_content"
    }
  },
  "release_date": "2026-10-05",
  "variants": {
    "low": {
      "reasoningEffort": "low"
    },
    "medium": {
      "reasoningEffort": "medium"
    },
    "high": {
      "reasoningEffort": "high"
    },
    "xhigh": {
      "reasoningEffort": "xhigh"
    },
    "max": {
      "reasoningEffort": "max"
    }
  }
}
opencode/big-pickle
{
  "id": "big-pickle",
  "providerID": "opencode",
  "name": "Big Pickle",
  "family": "big-pickle",
  "api": {
    "id": "big-pickle",
    "url": "https://opencode.ai/inference/openai/v1",
    "npm": "@ai-sdk/openai-compatible"
  },
  "status": "active",
  "headers": {},
  "options": {},
  "cost": {
    "input": 0,
    "output": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  },
  "limit": {
    "context": 200000,
    "input": 160000,
    "output": 32000
  },
  "capabilities": {
    "temperature": true,
    "reasoning": true,
    "attachment": false,
    "toolcall": true,
    "input": {
      "text": true,
      "audio": false,
      "image": false,
      "video": false,
      "pdf": false
    },
    "output": {
      "text": true,
      "audio": false,
      "image": false,
      "video": false,
      "pdf": false
    },
    "interleaved": {
      "field": "reasoning_content"
    }
  },
  "release_date": "2025-10-17",
  "variants": {}
}
opencode/deepseek-v4.1-flash-free
{
  "id": "deepseek-v4.1-flash-free",
  "providerID": "opencode",
  "name": "DeepSeek V4.1 Flash Free",
  "family": "deepseek-flash",
  "api": {
    "id": "deepseek-v4.1-flash-free",
    "url": "https://opencode.ai/inference/openai/v1",
    "npm": "@ai-sdk/openai-compatible"
  },
  "status": "active",
  "headers": {},
  "options": {},
  "cost": {
    "input": 0,
    "output": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  },
  "limit": {
    "context": 200000,
    "output": 32000
  },
  "capabilities": {
    "temperature": true,
    "reasoning": true,
    "attachment": true,
    "toolcall": true,
    "input": {
      "text": true,
      "audio": false,
      "image": true,
      "video": false,
      "pdf": false
    },
    "output": {
      "text": true,
      "audio": false,
      "image": false,
      "video": false,
      "pdf": false
    },
    "interleaved": {
      "field": "reasoning_content"
    }
  },
  "release_date": "2026-09-10",
  "variants": {
    "low": {
      "reasoningEffort": "low"
    },
    "high": {
      "reasoningEffort": "high"
    },
    "max": {
      "reasoningEffort": "max"
    }
  }
}
`
};
