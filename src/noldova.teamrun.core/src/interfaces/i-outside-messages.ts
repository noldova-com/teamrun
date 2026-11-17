/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { OutsideReply } from "../models/outside-reply.js";

export interface IOutsideMessages {
  listOutsideAsync(): Promise<readonly JsonObject[]>;
  listOutsideChatsAsync(): Promise<readonly JsonObject[]>;
  sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId?: string | null): Promise<string>;
  readOutsideAsync(messageId: string): Promise<OutsideReply>;
  forgetOutsideAsync(): Promise<void>;
}
