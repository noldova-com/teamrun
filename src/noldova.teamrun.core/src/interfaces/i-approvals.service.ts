/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { Approval, ConversationIdParams } from "@noldova/teamrun.protocol";

export interface IApprovalsService {
  listPendingAllAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;
  listUnsentAnswersAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;
  listAsync(params: ConversationIdParams): Promise<readonly Approval[]>;
  findAsync(approvalId: string, transaction?: SqlTransaction): Promise<Approval | null>;
  listPendingAsync(messageId: string, transaction?: SqlTransaction): Promise<readonly Approval[]>;
  insertAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;
  updateAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;
}
