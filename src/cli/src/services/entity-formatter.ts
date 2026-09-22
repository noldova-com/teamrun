/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Approval, Conversation, ConversationMember, Message, Project, ProviderAccount, ProviderDescriptor, Teammate } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class EntityFormatter {
  public formatTeammate(teammate: Teammate): string {
    return [teammate.id, teammate.name, teammate.providerAccountId, teammate.harness, teammate.model ?? String.empty, teammate.effort ?? String.empty]
      .join(Resources.fieldSeparator);
  }

  public formatMember(member: ConversationMember): string {
    return [member.teammateId, member.joinedAt, member.nativeSessionId ?? String.empty].join(Resources.fieldSeparator);
  }

  public formatProvider(provider: ProviderDescriptor): string {
    return [provider.id, provider.displayName, provider.effortLevels.join(Resources.listSeparator)].join(Resources.fieldSeparator);
  }

  public formatAccount(account: ProviderAccount): string {
    const identity = Object.isNull(account.identity) ? String.empty : account.identity.email ?? String.empty;
    return [account.id, account.provider, account.label, account.authStatus, identity, account.profileDir].join(Resources.fieldSeparator);
  }

  public formatProject(project: Project): string {
    return [project.id, project.name, project.rootPath].join(Resources.fieldSeparator);
  }

  public formatConversation(conversation: Conversation): string {
    return [conversation.id, conversation.title, conversation.updatedAt].join(Resources.fieldSeparator);
  }

  public formatMessage(message: Message): string {
    const text = message.details.map(t => Resources.formatDetail(t.kind, t.text)).join(Resources.lineSeparator);
    return [message.sequence, message.author, message.status, message.id].join(Resources.fieldSeparator) + Resources.lineSeparator + text;
  }

  public formatApproval(approval: Approval): string {
    return [approval.id, approval.status, approval.kind, approval.summary, approval.decision ?? String.empty].join(Resources.fieldSeparator);
  }
}
