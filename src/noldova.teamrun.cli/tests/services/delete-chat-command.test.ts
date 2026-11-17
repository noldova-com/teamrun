/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationIdParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";

@TestClass
export class DeleteChatCommandTests {
  @TestMethod
  public async deletesAChat(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationDelete", () => null);

    const result = await context.runAsync("teamrun.deleteChat", { chatId: "c1" });

    Assert.areEqual("Deleted chat c1.", result.text);
    Assert.isNull(result.value);
    Assert.areEqual("c1", ConversationIdParams.fromJson(context.payloadsOf("teamrun.conversationDelete")[0]).conversationId);
  }
}
