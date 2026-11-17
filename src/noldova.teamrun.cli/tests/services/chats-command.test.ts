/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { ConversationIdParams, ConversationListParams, ConversationMember, Harness, MessageStatus, Teammate } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class ChatsCommandTests {
  @TestMethod
  public async listsTheChatsOfEveryProjectAndThenThoseWithoutOne(): Promise<void> {
    const context = ChatsCommandTests.answering(await RecordingCliContext.activateAsync());
    const listed = new Map<string | null, unknown>([["p1", [SampleData.release.toJson()]], ["p2", [SampleData.notes.toJson()]], [null, [SampleData.scratch.toJson()]]]);
    context.answer("teamrun.projectList", () => SampleData.listed.map(t => t.toJson()))
      .answer("teamrun.conversationList", t => listed.get(ConversationListParams.fromJson(t).projectId) as never);

    const result = await context.runAsync("teamrun.listChats");

    Assert.areEqual("c1  Release  teammates: Alice, Chat GPT  replying\nc2  Notes  no teammates  idle\nc4  Scratch  no teammates  idle", result.text);
    Assert.areEqual("p1,p2,null", context.payloadsOf("teamrun.conversationList").map(t => String(ConversationListParams.fromJson(t).projectId)).join(","));
    Assert.areEqual("null", JSON.stringify((result.value as readonly { readonly projectId: unknown }[])[2]?.projectId));
  }

  @TestMethod
  public async listsOnlyTheGivenProjectsChats(): Promise<void> {
    const context = ChatsCommandTests.answering(await RecordingCliContext.activateAsync());
    context.answer("teamrun.conversationList", () => [SampleData.notes.toJson()]);

    const result = await context.runAsync("teamrun.listChats", { project: "p2" });

    Assert.areEqual("c2  Notes  no teammates  idle", result.text);
    Assert.areEqual(0, context.payloadsOf("teamrun.projectList").length);
    Assert.areEqual("p2", ConversationListParams.fromJson(context.payloadsOf("teamrun.conversationList")[0]).projectId);
  }

  @TestMethod
  public async printsEachChatsTeammatesAndWhetherAReplyIsRunningAsJson(): Promise<void> {
    const context = ChatsCommandTests.answering(await RecordingCliContext.activateAsync());
    context.answer("teamrun.conversationList", () => [SampleData.release.toJson()]);

    const result = await context.runAsync("teamrun.listChats", { project: "p1" });

    Assert.areEqual(JSON.stringify([{ ...SampleData.release.toJson(), teammates: ["Alice", "Chat GPT"], replying: true }]), JSON.stringify(result.value));
    Assert.areEqual("c1", ConversationIdParams.fromJson(context.payloadsOf("teamrun.conversationListMembers")[0]).conversationId);
  }

  @TestMethod
  public async namesAMemberNoLongerAmongTheTeammatesByItsId(): Promise<void> {
    const context = ChatsCommandTests.answering(await RecordingCliContext.activateAsync())
      .answer("teamrun.conversationList", () => [SampleData.release.toJson()])
      .answer("teamrun.conversationListMembers", () => [new ConversationMember("c1", "t9", SampleData.time, null, false).toJson()]);

    const result = await context.runAsync("teamrun.listChats", { project: "p1" });

    Assert.areEqual("c1  Release  teammates: t9  replying", result.text);
  }

  @TestMethod
  public async namesEachChatsTeammatesByNameIgnoringCaseWithAnAccentedNameBesideItsLetterInItsTextAndItsJson(): Promise<void> {
    const names = ["zoe", "Émile", "bob", "Alice", "edgar"];
    const context = ChatsCommandTests.answering(await RecordingCliContext.activateAsync())
      .answer("teamrun.conversationList", () => [SampleData.release.toJson()])
      .answer("teamrun.teammateList", () => names.map(t => new Teammate(t, t, null, "a1", Harness.Provider, null, null, SampleData.time, SampleData.time).toJson()))
      .answer("teamrun.conversationListMembers", () => names.map(t => new ConversationMember("c1", t, SampleData.time, null, false).toJson()));

    const result = await context.runAsync("teamrun.listChats", { project: "p1" });

    Assert.areEqual("c1  Release  teammates: Alice, bob, edgar, Émile, zoe  replying", result.text);
    Assert.areEqual(JSON.stringify(["Alice", "bob", "edgar", "Émile", "zoe"]), JSON.stringify((result.value as Record<string, JsonValue>[])[0]!["teammates"]));
  }

  private static answering(context: RecordingCliContext): RecordingCliContext {
    return context.answer("teamrun.teammateList", () => [SampleData.alice.toJson(), SampleData.chat.toJson()])
      .answer("teamrun.messageListOpen", () => [SampleData.reply("m2", "c1", 1, MessageStatus.Running).toJson()])
      .answer("teamrun.conversationListMembers", t => ConversationIdParams.fromJson(t).conversationId === "c1"
        ? ["t1", "t2"].map(u => new ConversationMember("c1", u, SampleData.time, null, false).toJson()) : []);
  }
}
