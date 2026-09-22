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
export class MembersCommandTests {
  @TestMethod
  public async exercisesTheRuntimeContractAndUsage(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    Assert.areEqual(0, (await host.runJson("members", conversation.id) as unknown[]).length);
    const teammate = await host.createTeammate();
    await host.runJson("member-add", conversation.id, teammate.id);
    const member = ConversationMember.fromJson((await host.runJson("members", conversation.id) as unknown[])[0]);
    Assert.areEqual(teammate.id, member.teammateId);
    Assert.areEqual(0, await host.run("members", conversation.id));
    Assert.isTrue(host.console.output.includes(teammate.id));
    Assert.areEqual(2, await host.run("members"));
  }
}
