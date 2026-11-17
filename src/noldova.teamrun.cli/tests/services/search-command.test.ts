/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";
import { ConversationSearchHit, ConversationSearchParams, ConversationSearchResult } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class SearchCommandTests {
  @TestMethod
  public async findsChatsByTheirTitleOrAMessageAndSaysWhere(): Promise<void> {
    const hits = [new ConversationSearchHit("c1", "p1", "Release notes", null, "Release notes", SampleData.time),
      new ConversationSearchHit("c2", "p2", "Notes", "m4", "…the release notes are ready", SampleData.time, 4)];
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationSearch", () => new ConversationSearchResult(hits).toJson());

    const result = await context.runAsync("teamrun.search", { text: ["release", "notes"], limit: 5 });

    Assert.areEqual("c1  Release notes  in the title\nc2  Notes  #4: …the release notes are ready", result.text);
    Assert.areEqual(JSON.stringify(hits.map(t => t.toJson())), JSON.stringify(result.value));
    const params = ConversationSearchParams.fromJson(context.payloadsOf("teamrun.conversationSearch")[0]);
    Assert.areEqual("release notes 5", `${params.query} ${params.limit}`);
  }

  @TestMethod
  public async printsNoneWhenNoChatHoldsTheText(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationSearch", () => new ConversationSearchResult([]).toJson());

    const result = await context.runAsync("teamrun.search", { text: ["missing"], limit: 20 });

    Assert.areEqual("(none)", result.text);
  }

  @TestMethod
  public async refusesALimitOutsideOneToAHundredBeforeAskingTheRuntime(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();

    const low = await Assert.throwsAsync(() => context.runAsync("teamrun.search", { text: ["x"], limit: 0 }), UsageException);
    const high = await Assert.throwsAsync(() => context.runAsync("teamrun.search", { text: ["x"], limit: 101 }), UsageException);

    Assert.areEqual("--limit takes a whole number from 1 to 100.", low.message);
    Assert.areEqual(low.message, high.message);
    Assert.areEqual(0, context.requests.length);
  }
}
