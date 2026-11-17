/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";

import "@noldova/context.core";
import { ConversationMemberParams } from "@noldova/teamrun.protocol";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import { MemberToken } from "../../models/member-token.js";
import { Resources } from "../../resources.js";

export class MemberTokens {
  private readonly conversations: IConversationsService;
  private readonly members: Map<string, MemberToken> = new Map();

  public constructor(conversations: IConversationsService) {
    this.conversations = conversations;
  }

  public async issueAsync(conversationId: string, teammateId: string | null): Promise<string> {
    const joinedAt = await this.joinedAtOfAsync(conversationId, teammateId);
    for (const [token, member] of [...this.members]) {
      if (!await this.holdsAsync(member)) {
        if (this.members.get(token) === member)
          this.members.delete(token);
      }
      else if (member.conversationId === conversationId && member.teammateId === teammateId && this.members.get(token) === member)
        return token;
    }
    const issued = [...this.members].find(([, t]) => t.conversationId === conversationId && t.teammateId === teammateId && t.joinedAt === joinedAt);
    if (!Object.isUndefined(issued))
      return issued[0];
    const token = randomBytes(Resources.mcpTokenBytes).toString("base64url");
    this.members.set(token, new MemberToken(conversationId, teammateId, joinedAt));
    return token;
  }

  public async findAsync(token: string): Promise<MemberToken | null> {
    const member = this.members.get(token);
    if (Object.isUndefined(member))
      return null;
    if (await this.holdsAsync(member))
      return member;
    if (this.members.get(token) === member)
      this.members.delete(token);
    return null;
  }

  private async holdsAsync(member: MemberToken): Promise<boolean> {
    return !Object.isNull(await this.conversations.findAsync(member.conversationId))
      && await this.joinedAtOfAsync(member.conversationId, member.teammateId) === member.joinedAt;
  }

  private async joinedAtOfAsync(conversationId: string, teammateId: string | null): Promise<string | null> {
    return Object.isNull(teammateId) ? null : (await this.conversations.findMemberAsync(new ConversationMemberParams(conversationId, teammateId)))?.joinedAt ?? null;
  }
}
