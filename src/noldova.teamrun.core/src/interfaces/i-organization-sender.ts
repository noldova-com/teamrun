/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, MessageIdParams, MessageSendResult } from "@noldova/teamrun.protocol";

export interface IOrganizationSender {
  startOutsideAsync(teammateId: string, text: string, label: string): Promise<MessageSendResult>;
  cancelAsync(params: MessageIdParams): Promise<Message>;
}
