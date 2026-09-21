/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  AttachmentInput,
  MessageAttachment,
  Approval,
  ApprovalDecideParams,
  ConversationRewindParams,
  ConversationRewindResult,
  Message,
  MessageIdParams,
  MessageSendParams,
  MessageSendResult
} from "@noldova/teamrun-protocol";

export interface IConversationEngine {
  prepareAttachment(input: AttachmentInput): MessageAttachment;
  discardAttachment(attachment: MessageAttachment): void;
  send(params: MessageSendParams): Promise<MessageSendResult>;
  cancel(params: MessageIdParams): Promise<Message>;
  decide(params: ApprovalDecideParams): Approval;
  rewind(params: ConversationRewindParams): Promise<ConversationRewindResult>;
}
