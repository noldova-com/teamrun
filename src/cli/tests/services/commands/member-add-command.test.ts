/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationMember } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class MemberAddCommandTests {
  @TestMethod
  public async exercisesTheRuntimeContractAndUsage(): Promise<void> {
    await using host = await CliTestHost.create();
    const teammate = await host.createTeammate();
    const conversation = await host.createConversation();
    const member = ConversationMember.fromJson(await host.runJson("member-add", conversation.id, teammate.id));
    Assert.areEqual(conversation.id, member.conversationId);
    Assert.isNull(member.nativeSessionId);
    Assert.areEqual(0, await host.run("member-add", conversation.id, teammate.id));
    Assert.isTrue(host.console.output.includes(teammate.id));
    Assert.areEqual(1, (await host.runJson("members", conversation.id) as unknown[]).length);
    Assert.areEqual(2, await host.run("member-add", conversation.id));
  }
}
