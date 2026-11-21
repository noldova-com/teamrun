/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OrganizationMessage, OrganizationTarget } from "@noldova/teamrun.protocol";

export class OrganizationConversation {
  public readonly key: string;
  public readonly target: OrganizationTarget;
  public readonly messages: readonly OrganizationMessage[];
  public readonly last: OrganizationMessage;

  public constructor(last: OrganizationMessage, earlier: readonly OrganizationMessage[]) {
    this.key = OrganizationConversation.keyOf(last.target);
    this.target = last.target;
    this.messages = [...earlier, last];
    this.last = last;
  }

  public static keyOf(target: OrganizationTarget): string {
    return `${target.kind}:${target.id ?? ""}`;
  }

  public static group(messages: readonly OrganizationMessage[]): readonly OrganizationConversation[] {
    const byKey = new Map<string, OrganizationConversation>();
    for (const message of [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const key = OrganizationConversation.keyOf(message.target);
      byKey.set(key, new OrganizationConversation(message, byKey.get(key)?.messages ?? []));
    }
    return [...byKey.values()].sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
  }
}
