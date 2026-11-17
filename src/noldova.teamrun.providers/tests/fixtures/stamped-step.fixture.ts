/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SDKAssistantMessage, SDKPartialAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

export class StampedStep {
  public readonly message: SDKAssistantMessage | SDKPartialAssistantMessage | SDKResultMessage;

  public constructor(message: SDKAssistantMessage | SDKPartialAssistantMessage | SDKResultMessage) {
    this.message = message;
  }
}
