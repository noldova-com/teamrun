/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MemberToken {
  public readonly conversationId: string;
  public readonly teammateId: string | null;
  public readonly joinedAt: string | null;

  public constructor(conversationId: string, teammateId: string | null, joinedAt: string | null) {
    this.conversationId = conversationId;
    this.teammateId = teammateId;
    this.joinedAt = joinedAt;
  }
}
