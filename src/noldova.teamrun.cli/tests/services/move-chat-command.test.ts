/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Conversation, ConversationMoveParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class MoveChatCommandTests {
  @TestMethod
  public async movesAChatToAProjectAndPrintsItsNewPlace(): Promise<void> {
    const moved = new Conversation("c1", "p2", "Release", SampleData.time, SampleData.time);
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationMove", () => moved.toJson());

    const result = await context.runAsync("teamrun.moveChat", { chatId: "c1", projectId: "p2" });

    Assert.areEqual("Moved chat c1 to project p2: Release", result.text);
    Assert.areEqual(JSON.stringify(moved.toJson()), JSON.stringify(result.value));
    const params = ConversationMoveParams.fromJson(context.payloadsOf("teamrun.conversationMove")[0]);
    Assert.areEqual("c1 p2", `${params.chatId} ${params.projectId}`);
  }
}
