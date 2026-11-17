/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationRewindParams, ConversationRewindResult } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class RewindCommandTests {
  @TestMethod
  public async rewindsAChatAndSaysWhatItRemovedAndRestored(): Promise<void> {
    const results = [new ConversationRewindResult(SampleData.release, ["m3"], 1, true), new ConversationRewindResult(SampleData.release, ["m3", "m4"], 3),
      new ConversationRewindResult(SampleData.release, ["m3", "m4"], null, false, "No files were restored: the files changed since.")];
    const answers = [...results];
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationRewind", () => (answers.shift() as ConversationRewindResult).toJson());

    const kept = await context.runAsync("teamrun.rewind", { chatId: "c1", messageId: "m3", restoreFiles: true });
    const restarted = await context.runAsync("teamrun.rewind", { chatId: "c1", messageId: "m3", restoreFiles: true });
    const refused = await context.runAsync("teamrun.rewind", { chatId: "c1", messageId: "m3" });

    Assert.areEqual("Removed 1 message; 1 file restored. The provider's session continues from there.", kept.text);
    Assert.areEqual("Removed 2 messages; 3 files restored. The next reply starts a fresh provider session.", restarted.text);
    Assert.areEqual("Removed 2 messages; no files restored. The next reply starts a fresh provider session.\nNo files were restored: the files changed since.", refused.text);
    Assert.areEqual(JSON.stringify(results[0]?.toJson()), JSON.stringify(kept.value));
    const [first, , last] = context.payloadsOf("teamrun.conversationRewind").map(t => ConversationRewindParams.fromJson(t));
    Assert.areEqual("c1 m3 true|c1 m3 false", [first, last].map(t => `${t?.chatId} ${t?.messageId} ${t?.restoreFiles}`).join("|"));
  }
}
