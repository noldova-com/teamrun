/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolCall } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TeamRunPagesHost } from "@noldova/teamrun.runtime";

import { ChangeServices } from "../fixtures/change-services.fixture.js";

@TestClass
export class TeamRunPagesHostTests {
  @TestMethod
  public readsTheChatTheFolderAndTheTeammateFromATeammatesCall(): void {
    const host = new TeamRunPagesHost(new ChangeServices().conversationsService);
    const call = TeamRunPagesHostTests.callOf("c1/t1", { "terminal.folder": "/work", agentName: "Opus" });

    Assert.areEqual("c1", host.chatOf(call));
    Assert.areEqual("/work", host.folderOf(call));
    Assert.areEqual(JSON.stringify({ teammateId: "t1", name: "Opus" }), JSON.stringify(host.authorOf(call).toJson()));
  }

  @TestMethod
  public namesTheChatsOwnTeammateByNoIdAndRefusesACallWithNoFolder(): void {
    const host = new TeamRunPagesHost(new ChangeServices().conversationsService);
    const call = TeamRunPagesHostTests.callOf("c1/default", { agentName: "Claude" });

    Assert.areEqual(JSON.stringify({ teammateId: null, name: "Claude" }), JSON.stringify(host.authorOf(call).toJson()));
    Assert.throws(() => host.folderOf(call), JsonException);
  }

  @TestMethod
  public async hasAChatOnlyWhileTeamRunFindsIt(): Promise<void> {
    const host = new TeamRunPagesHost(new ChangeServices().conversationsService);

    Assert.isTrue(await host.hasChatAsync("c1"));
    Assert.isFalse(await host.hasChatAsync("gone"));
  }

  private static callOf(scope: string, bindings: Record<string, string>): ToolCall {
    return new ToolCall("s1", scope, bindings, {}, 30_000, new AbortController().signal);
  }
}
