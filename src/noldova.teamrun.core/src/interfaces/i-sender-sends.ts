/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageSendParams, MessageSendResult } from "@noldova/teamrun.protocol";

import type { SendAsk } from "../models/send-ask.js";

export interface ISenderSends {
  describeSendAsync(params: MessageSendParams): Promise<SendAsk | null>;
  sendAllowedAsync(params: MessageSendParams, starts: string | null): Promise<MessageSendResult>;
}
