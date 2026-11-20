/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { ConversationIdParams, Draft, DraftDiscardParams, DraftSaveParams } from "@noldova/teamrun.protocol";

export interface IDraftsService {
  saveAsync(params: DraftSaveParams): Promise<Draft>;
  readAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Draft | null>;
  discardAsync(params: DraftDiscardParams): Promise<void>;
  forgetAsync(conversationId: string, transaction?: SqlTransaction): Promise<void>;
  removeFiles(conversationId: string): void;
  removeChatFiles(conversationId: string): void;
  removeSentFiles(conversationId: string, paths: readonly string[]): void;
}
