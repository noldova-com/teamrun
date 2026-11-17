/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MemberToken, MemberTokens } from "@noldova/teamrun.core";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class MemberTokensTests {
  @TestMethod
  public async issuesOneTokenToTwoCallsForTheSameMemberThatRunAtOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const tokens = new MemberTokens(host.conversations);
    const earlier = await tokens.issueAsync(chat.id, null);

    const [first, second] = await Promise.all([tokens.issueAsync(chat.id, "alice"), tokens.issueAsync(chat.id, "alice")]);

    Assert.areEqual(first, second);
    Assert.areNotEqual(earlier, first);
    Assert.areEqual(earlier, await tokens.issueAsync(chat.id, null));
  }

  @TestMethod
  public async findsTheMemberOfAHeldTokenAndNothingForAnUnknownOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const tokens = new MemberTokens(host.conversations);
    const token = await tokens.issueAsync(chat.id, "alice");

    const member = await tokens.findAsync(token);

    Assert.isInstanceOf(member, MemberToken);
    Assert.areEqual(JSON.stringify([chat.id, "alice", null]), JSON.stringify([member?.conversationId, member?.teammateId, member?.joinedAt]));
    Assert.areEqual(token, await tokens.issueAsync(chat.id, "alice"));
    Assert.isNull(await tokens.findAsync("unknown"));
  }
}
