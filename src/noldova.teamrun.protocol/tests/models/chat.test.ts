/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Chat, ChatResponder, ForkedSession, OrganizationChat, RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class ChatTests {
  private static readonly json: object = {
    id: "conv-1",
    projectId: "prj-1",
    title: "Add login",
    createdAt: "2026-09-08T09:00:00Z",
    updatedAt: "2026-09-08T09:30:00Z",
    sessionReset: false,
    forkedSession: null,
    responder: null,
    edited: false,
    folder: null
  };

  @TestMethod
  public remembersThatAPersonChoseTheTitleThroughEveryCopyAndJson(): void {
    const chat = Chat.fromJson(ChatTests.json);
    Assert.isFalse(chat.titleChosen);
    Assert.isFalse(Object.hasOwn(chat.toJson(), "titleChosen"));

    const chosen = chat.withChosenTitle("Chosen", "t3");
    Assert.areEqual("Chosen", chosen.title);
    Assert.areEqual("t3", chosen.updatedAt);
    Assert.isTrue(chosen.edited);
    Assert.isTrue(chosen.titleChosen);
    Assert.isTrue(Chat.fromJson(chosen.toJson()).titleChosen);
    const planning = chosen.withPlanFirst(true);
    const copies = [chosen.withTitle("Renamed", "t4"), chosen.withProjectId("prj-2", "t4"), chosen.withFolder("E:/chats/conv-1"),
      chosen.withSessionReset(true, "t4"), chosen.withForkedSession(null, "t4"), chosen.withResponder(new ChatResponder("bob")), chosen.asEdited(), planning,
      planning.withPlanApproved("bob"), planning.withPlanApproved(null).withPlanReopened(null)];
    Assert.areEqual(JSON.stringify(copies.map(() => true)), JSON.stringify(copies.map(t => t.titleChosen)));
  }

  @TestMethod
  public keepsItsOrganizationChatKeyThroughEveryCopyAndJson(): void {
    const own = Chat.fromJson({ ...ChatTests.json, projectId: null, folder: "D:/data/chats/conv-1" });
    const keyed = new Chat("conv-2", null, "Organization · Grok", "t1", "t1", false, null, null, false, null, false, [], false, false, null,
      new OrganizationChat("org-1", "grok")).withPlanFirst(true);
    const copies = [keyed.withTitle("Renamed", "t4"), keyed.withFolder("E:/site"), keyed.withAttachedFolder("E:/site", "t4"), keyed.withSessionReset(true, "t4"),
      keyed.withForkedSession(null, "t4"), keyed.withResponder(new ChatResponder("bob")), keyed.asEdited(), keyed.withChosenTitle("Chosen", "t4"),
      keyed.withPlanApproved("bob"), keyed.withPlanApproved(null).withPlanReopened(null), keyed.withPlanFirst(false), keyed.withProjectId("prj-2", "t4")];

    Assert.isNull(own.organizationChat);
    Assert.isFalse(Object.hasOwn(own.toJson(), "organizationChat"));
    Assert.areEqual(JSON.stringify({ organizationId: "org-1", teammateId: "grok" }), JSON.stringify(keyed.toJson()["organizationChat"]));
    Assert.areEqual(JSON.stringify(copies.map(() => "org-1 grok")),
      JSON.stringify(copies.map(t => Chat.fromJson(t.toJson()).organizationChat).map(t => `${t?.organizationId} ${t?.teammateId}`)));
    Assert.isNull(Chat.fromJson({ ...ChatTests.json, organizationChat: null }).organizationChat);
    Assert.throws(() => new OrganizationChat(" ", "grok"), ArgumentException);
    Assert.throws(() => new OrganizationChat("org-1", " "), ArgumentException);
    Assert.areEqual("$.organizationChat.teammateId",
      Assert.throws(() => Chat.fromJson({ ...ChatTests.json, organizationChat: { organizationId: "org-1", teammateId: " " } }), JsonException).path);
  }

  @TestMethod
  public keepsAnAttachedFolderThroughEveryCopyAndJsonUntilItIsDetachedOrTheChatMovesIntoAProject(): void {
    const own = Chat.fromJson({ ...ChatTests.json, projectId: null, folder: "D:/data/chats/conv-1" });
    const attached = own.withAttachedFolder("E:/site", "t3").withPlanFirst(true);
    const copies = [attached.withTitle("Renamed", "t4"), attached.withFolder("E:/site"), attached.withSessionReset(true, "t4"), attached.withForkedSession(null, "t4"),
      attached.withResponder(new ChatResponder("bob")), attached.asEdited(), attached.withChosenTitle("Chosen", "t4"), attached.withPlanApproved("bob"),
      attached.withPlanApproved(null).withPlanReopened(null), attached.withPlanFirst(false)];

    Assert.isNull(own.attachedFolder);
    Assert.isFalse(Object.hasOwn(own.toJson(), "attachedFolder"));
    Assert.areEqual("t3", own.withAttachedFolder("E:/site", "t3").updatedAt);
    Assert.areEqual("E:/site", attached.toJson()["attachedFolder"]);
    Assert.areEqual("E:/site", Chat.fromJson(attached.toJson()).attachedFolder);
    Assert.areEqual(JSON.stringify(copies.map(() => "E:/site")), JSON.stringify(copies.map(t => t.attachedFolder)));
    Assert.isNull(attached.withAttachedFolder(null, "t5").attachedFolder);
    Assert.isNull(attached.withProjectId("prj-2", "t5").attachedFolder);
    Assert.isNull(Chat.fromJson({ ...ChatTests.json, attachedFolder: null }).attachedFolder);
    Assert.throws(() => own.withAttachedFolder(" ", "t3"), ArgumentException);
    Assert.areEqual("$.attachedFolder", Assert.throws(() => Chat.fromJson({ ...ChatTests.json, attachedFolder: " " }), JsonException).path);
  }

  @TestMethod
  public movesToAnotherProject(): void {
    const chat = Chat.fromJson(ChatTests.json);

    const moved = chat.withProjectId("prj-2", "t9");

    Assert.areEqual("prj-1", chat.projectId);
    Assert.areEqual("prj-2", moved.projectId);
    Assert.areEqual("t9", moved.updatedAt);
    Assert.areEqual(chat.title, moved.title);
    Assert.throws(() => chat.withProjectId(String.empty, "t9"), ArgumentException);
  }

  @TestMethod
  public marksAndClearsTheSessionReset(): void {
    const chat = Chat.fromJson({ id: "conv-1", projectId: "prj-1", title: "Old", createdAt: "t1", updatedAt: "t2" });

    const marked = chat.withSessionReset(true, "t3");

    Assert.isFalse(chat.sessionReset);
    Assert.isTrue(marked.sessionReset);
    Assert.areEqual("t3", marked.updatedAt);
    Assert.isTrue(marked.withTitle("New", "t4").sessionReset);
    Assert.isTrue(Chat.fromJson(marked.toJson()).sessionReset);
    Assert.isFalse(marked.withSessionReset(false, "t5").sessionReset);

    const forked = marked.withForkedSession(new ForkedSession("codex", null, "thread-2"), "t6");
    Assert.isFalse(forked.sessionReset);
    Assert.areEqual("thread-2", forked.forkedSession?.nativeSessionId);
    Assert.areEqual("thread-2", forked.withTitle("New", "t7").forkedSession?.nativeSessionId);
    Assert.areEqual("codex", Chat.fromJson(forked.toJson()).forkedSession?.kind);
    Assert.isNull(forked.withSessionReset(true, "t8").forkedSession);
    Assert.isNull(forked.withForkedSession(null, "t9").forkedSession);
    Assert.isNull(Chat.fromJson({ id: "c", projectId: "p", title: "T", createdAt: "t1", updatedAt: "t2" }).forkedSession);
    Assert.isNull(Chat.fromJson({ ...forked.toJson(), forkedSession: null }).forkedSession);
  }

  @TestMethod
  public keepsTheChosenResponderThroughEveryCopyWithoutMovingTheUpdateTime(): void {
    const chat = Chat.fromJson({ id: "c", projectId: "p", title: "T", createdAt: "t1", updatedAt: "t2" });

    const chosen = chat.withResponder(new ChatResponder("bob"));
    const fallback = chat.withResponder(new ChatResponder(null, new RequestedSettings("codex", "gpt-5", "high"), "a1"));

    Assert.isNull(chat.responder);
    Assert.areEqual(["bob", "t2"].join(","), [chosen.responder?.teammateId, chosen.updatedAt].join(","));
    Assert.areEqual("bob", Chat.fromJson(chosen.toJson()).responder?.teammateId);
    const read = Chat.fromJson(fallback.toJson()).responder;
    Assert.areEqual("null codex gpt-5 high a1", `${read?.teammateId} ${read?.requested?.kind} ${read?.requested?.model} ${read?.requested?.effort} ${read?.providerId}`);
    for (const copy of [chosen.withTitle("New", "t3"), chosen.withProjectId("p2", "t3"), chosen.withSessionReset(true, "t3"),
      chosen.withForkedSession(new ForkedSession("codex", null, "thread-2"), "t3")])
      Assert.areEqual("bob", copy.responder?.teammateId);
    Assert.isNull(chosen.withResponder(null).responder);
    Assert.isNull(Chat.fromJson({ ...chosen.toJson(), responder: null }).responder);
    Assert.areEqual("$.responder.teammateId", Assert.throws(() => Chat.fromJson({ ...chosen.toJson(), responder: { teammateId: 5 } }), JsonException).path);
    Assert.areEqual("$.responder", Assert.throws(() => Chat.fromJson({ ...chosen.toJson(), responder: { teammateId: null, requested: null,
      providerId: null } }), JsonException).path);
  }

  @TestMethod
  public keepsTheEditedMarkThroughEveryCopyAndReadsItAsFalseFromAnOlderRow(): void {
    const chat = Chat.fromJson({ id: "c", projectId: "p", title: "T", createdAt: "t1", updatedAt: "t2" });

    const edited = chat.asEdited();

    Assert.isFalse(chat.edited);
    Assert.areEqual(["true", "t2", "T"].join(","), [edited.edited, edited.updatedAt, edited.title].join(","));
    Assert.isTrue(Chat.fromJson(edited.toJson()).edited);
    for (const copy of [edited.withTitle("New", "t3"), edited.withProjectId("p2", "t3"), edited.withSessionReset(true, "t3"),
      edited.withForkedSession(new ForkedSession("codex", null, "thread-2"), "t3"), edited.withResponder(new ChatResponder("bob"))])
      Assert.isTrue(copy.edited);
    Assert.isFalse(chat.withResponder(new ChatResponder("bob")).edited);
    Assert.areEqual("$.edited", Assert.throws(() => Chat.fromJson({ ...edited.toJson(), edited: "yes" }), JsonException).path);
  }

  @TestMethod
  public keepsAChatWithoutAProjectAndItsOwnFolderThroughEveryCopyUntilItMovesIntoAProject(): void {
    const own = Chat.fromJson({ ...ChatTests.json, projectId: null, folder: "D:\data\chats\conv-1" });
    const copies = [own.withTitle("Renamed", "t3"), own.withSessionReset(true, "t3"), own.withForkedSession(null, "t3"), own.withResponder(null), own.asEdited()];

    Assert.isNull(own.projectId);
    Assert.areEqual(JSON.stringify(own.toJson()), JSON.stringify(Chat.fromJson(own.toJson()).toJson()));
    Assert.areEqual(JSON.stringify(copies.map(() => [null, "D:\data\chats\conv-1"])), JSON.stringify(copies.map(t => [t.projectId, t.folder])));
    Assert.areEqual(JSON.stringify(["prj-2", null]), JSON.stringify([own.withProjectId("prj-2", "t4").projectId, own.withProjectId("prj-2", "t4").folder]));
    Assert.areEqual("E:\chats\conv-1", own.withFolder("E:\chats\conv-1").folder);
    Assert.isNull(own.withFolder(null).folder);
    Assert.isNull(Chat.fromJson({ id: "c", projectId: "p", title: "T", createdAt: "t1", updatedAt: "t2" }).folder);
    Assert.throws(() => own.withFolder(" "), ArgumentException);
    Assert.areEqual("$.folder", Assert.throws(() => Chat.fromJson({ ...ChatTests.json, folder: 3 }), JsonException).path);
    Assert.areEqual("$.projectId", Assert.throws(() => Chat.fromJson({ ...ChatTests.json, projectId: 3 }), JsonException).path);
  }

  @TestMethod
  public keepsPlanFirstThroughEveryCopyAndWritesItOnlyWhenOn(): void {
    const chat = Chat.fromJson(ChatTests.json);
    const planning = chat.withPlanFirst(true);
    const copies = [planning.withTitle("Renamed", "t3"), planning.withProjectId("prj-2", "t3"), planning.withFolder("E:\chats\conv-1"),
      planning.withSessionReset(true, "t3"), planning.withForkedSession(null, "t3"), planning.withResponder(new ChatResponder("bob")), planning.asEdited()];

    Assert.isFalse(chat.planFirst);
    Assert.areEqual(JSON.stringify(ChatTests.json), JSON.stringify(chat.toJson()));
    Assert.areEqual(JSON.stringify({ ...ChatTests.json, planFirst: true }), JSON.stringify(planning.toJson()));
    Assert.isTrue(Chat.fromJson(planning.toJson()).planFirst);
    Assert.areEqual(JSON.stringify(copies.map(() => true)), JSON.stringify(copies.map(t => t.planFirst)));
    Assert.isFalse(planning.withPlanFirst(false).planFirst);
    Assert.areEqual("$.planFirst", Assert.throws(() => Chat.fromJson({ ...ChatTests.json, planFirst: "yes" }), JsonException).path);
  }

  @TestMethod
  public plansFirstForEachMemberUntilItsOwnPlanIsApprovedAndForEveryMemberAgainOnceTurnedOn(): void {
    const planning = Chat.fromJson(ChatTests.json).withPlanFirst(true);
    const approved = planning.withPlanApproved("bob").withPlanApproved("bob").withPlanApproved(null);
    const copies = [approved.withTitle("Renamed", "t3"), approved.withProjectId("prj-2", "t3"), approved.withFolder("E:/chats/conv-1"),
      approved.withSessionReset(true, "t3"), approved.withForkedSession(null, "t3"), approved.withResponder(new ChatResponder("bob")), approved.asEdited()];
    const members = (chat: Chat): string => ["bob", "carol", null].map(t => chat.plansFirst(t)).join(",");

    Assert.areEqual("true,true,true", members(planning));
    Assert.areEqual("false,true,true", members(planning.withPlanApproved("bob")));
    Assert.areEqual("false,true,false", members(approved));
    Assert.areEqual(JSON.stringify({ ...ChatTests.json, planFirst: true, approvedPlanTeammates: ["bob"], approvedResponderPlan: true }),
      JSON.stringify(approved.toJson()));
    Assert.areEqual("false,true,false", members(Chat.fromJson(approved.toJson())));
    Assert.areEqual(JSON.stringify(copies.map(() => "false,true,false")), JSON.stringify(copies.map(members)));
    Assert.areEqual("true,true,true", members(approved.withPlanFirst(true)));
    Assert.areEqual(JSON.stringify({ ...ChatTests.json, planFirst: true }), JSON.stringify(approved.withPlanFirst(true).toJson()));
    Assert.areEqual("false,false,false", members(approved.withPlanFirst(false)));
    Assert.areEqual(JSON.stringify(ChatTests.json), JSON.stringify(Chat.fromJson(ChatTests.json).withPlanApproved("bob").toJson()));
    Assert.areEqual("true,true,false", members(approved.withPlanReopened("bob").withPlanReopened("bob")));
    Assert.areEqual("false,true,true", members(approved.withPlanReopened(null)));
    Assert.areEqual(JSON.stringify(planning.toJson()), JSON.stringify(planning.withPlanApproved("bob").withPlanReopened("bob").toJson()));
    Assert.areEqual(JSON.stringify(ChatTests.json), JSON.stringify(Chat.fromJson(ChatTests.json).withPlanReopened("bob").toJson()));
    Assert.areEqual("$.approvedPlanTeammates.0",
      Assert.throws(() => Chat.fromJson({ ...ChatTests.json, approvedPlanTeammates: [1] }), JsonException).path);
    Assert.throws(() => new Chat("conv-1", null, "Add login", "t1", "t1", false, null, null, false, null, true, [" "]), ArgumentException);
  }

  @TestMethod
  public holdsTheChatHeader(): void {
    const chat = new Chat("conv-2", "prj-1", "Fix tests", "t1", "t2");

    Assert.areEqual("Fix tests", chat.title);
    Assert.areEqual("t2", chat.updatedAt);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new Chat(String.empty, "prj", "Title", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Chat("conv", String.empty, "Title", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Chat("conv", "prj", " ", "t1", "t2"), ArgumentException);
    Assert.throws(() => new Chat("conv", "prj", "Title", String.empty, "t2"), ArgumentException);
    Assert.throws(() => new Chat("conv", "prj", "Title", "t1", String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const chat = Chat.fromJson(ChatTests.json);

    Assert.areEqual("conv-1", chat.id);
    Assert.areEqual("Add login", chat.title);
    Assert.areEqual(JSON.stringify(ChatTests.json), JSON.stringify(chat.toJson()));
  }

  @TestMethod
  public reportsMissingFieldsWithTheirPath(): void {
    Assert.areEqual("$.title", Assert.throws(() => Chat.fromJson({ ...ChatTests.json, title: undefined }), JsonException).path);
  }

  @TestMethod
  public producesARenamedCopy(): void {
    const chat = new Chat("c1", "p1", "Old", "t1", "t1");

    const renamed = chat.withTitle("New", "t2");

    Assert.areEqual("Old", chat.title);
    Assert.areEqual("New", renamed.title);
    Assert.areEqual("t2", renamed.updatedAt);
    Assert.areEqual("t1", renamed.createdAt);
    Assert.throws(() => chat.withTitle(" ", "t2"), ArgumentException);
  }
}
