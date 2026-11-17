/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Conversation, ConversationRenameParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class RenameChatCommandTests {
  @TestMethod
  public async renamesAChatToTheRestOfTheLine(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationRename", () => new Conversation("c1", "p1", "Release notes", SampleData.time, SampleData.time).toJson());

    const result = await context.runAsync("teamrun.renameChat", { chatId: "c1", title: ["Release", "notes"] });

    Assert.areEqual("Renamed chat c1: Release notes", result.text);
    const params = ConversationRenameParams.fromJson(context.payloadsOf("teamrun.conversationRename")[0]);
    Assert.areEqual("c1 Release notes", `${params.conversationId} ${params.title}`);
  }
}
