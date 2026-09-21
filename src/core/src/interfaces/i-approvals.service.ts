/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Approval, ConversationIdParams } from "@noldova/teamrun-protocol";

export interface IApprovalsService {
  listPendingAll(): readonly Approval[];
  list(params: ConversationIdParams): readonly Approval[];
  find(approvalId: string): Approval | null;
  listPending(messageId: string): readonly Approval[];
  insert(approval: Approval): void;
  update(approval: Approval): void;
}
