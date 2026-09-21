/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Conversation, ForkedSession } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationTests {
  private static readonly json: object = {
    id: "conv-1",
    projectId: "prj-1",
    title: "Add login",
    createdAt: "2026-09-08T09:00:00Z",
    updatedAt: "2026-09-08T09:30:00Z",
    sessionReset: false,
    forkedSession: null
  };

  @TestMethod
  public movesToAnotherProject(): void {
    const conversation = Conversation.fromJson(ConversationTests.json);

    const moved = conversation.withProjectId("prj-2", "t9");

    Assert.areEqual("prj-1", conversation.projectId);
    Assert.areEqual("prj-2", moved.projectId);
    Assert.areEqual("t9", moved.updatedAt);
    Assert.areEqual(conversation.title, moved.title);
    Assert.throws(() => conversation.withProjectId(String.empty, "t9"), ArgumentException);
  }

  @TestMethod
  public marksAndClearsTheSessionReset(): void {
    const conversation = Conversation.fromJson({ id: "conv-1", projectId: "prj-1", title: "Old", createdAt: "t1", updatedAt: "t2" });

    const marked = conversation.withSessionReset(true, "t3");

    Assert.isFalse(conversation.sessionReset);
    Assert.isTrue(marked.sessionReset);
    Assert.areEqual("t3", marked.updatedAt);
    Assert.isTrue(marked.withTitle("New", "t4").sessionReset);
    Assert.isTrue(Conversation.fromJson(marked.toJson()).sessionReset);
    Assert.isFalse(marked.withSessionReset(false, "t5").sessionReset);

    const forked = marked.withForkedSession(new ForkedSession("codex", null, "thread-2"), "t6");
    Assert.isFalse(forked.sessionReset);
    Assert.areEqual("thread-2", forked.forkedSession?.nativeSessionId);
    Assert.areEqual("thread-2", forked.withTitle("New", "t7").forkedSession?.nativeSessionId);
    Assert.areEqual("codex", Conversation.fromJson(forked.toJson()).forkedSession?.provider);
    Assert.isNull(forked.withSessionReset(true, "t8").forkedSession);
    Assert.isNull(forked.withForkedSession(null, "t9").forkedSession);
    Assert.isNull(Conversation.fromJson({ id: "c", projectId: "p", title: "T", createdAt: "t1", updatedAt: "t2" }).forkedSession);
    Assert.isNull(Conversation.fromJson({ ...forked.toJson(), forkedSession: null }).forkedSession);
  }

  @TestMethod
  public holdsTheConversationHeader(): void {
    const conversation = new Conversation("conv-2", "prj-1", "Fix tests", "t1", "t2");

    Assert.areEqual("Fix tests", conversation.title);
    Assert.areEqual("t2", conversation.updatedAt);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new Conversation(String.empty, "prj", "Title", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Conversation("conv", String.empty, "Title", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Conversation("conv", "prj", " ", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Conversation("conv", "prj", "Title", String.empty, "t2"), ArgumentException);
    Assert.throws(() => new Conversation("conv", "prj", "Title", "t1", String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const conversation = Conversation.fromJson(ConversationTests.json);

    Assert.areEqual("conv-1", conversation.id);
    Assert.areEqual("Add login", conversation.title);
    Assert.areEqual(JSON.stringify(ConversationTests.json), JSON.stringify(conversation.toJson()));
  }

  @TestMethod
  public reportsMissingFieldsWithTheirPath(): void {
    Assert.areEqual("$.title", Assert.throws(() => Conversation.fromJson({ ...ConversationTests.json, title: undefined }), JsonException).path);
  }

  @TestMethod
  public producesARenamedCopy(): void {
    const conversation = new Conversation("c1", "p1", "Old", "t1", "t1");

    const renamed = conversation.withTitle("New", "t2");

    Assert.areEqual("Old", conversation.title);
    Assert.areEqual("New", renamed.title);
    Assert.areEqual("t2", renamed.updatedAt);
    Assert.areEqual("t1", renamed.createdAt);
    Assert.throws(() => conversation.withTitle(" ", "t2"), ArgumentException);
  }
}
