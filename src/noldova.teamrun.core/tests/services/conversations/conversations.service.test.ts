/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, Resources } from "@noldova/teamrun.core";
import { ChatFindParams, ChatMemberModeParams, ChatMemberSettings, ChatMemberSettingsParams, ChatPlanFirstParams, ConversationMemberParams, ConversationPosition, Harness, ObservedSettings, Provenance, ReadingPositionSaveParams, RunOutput,
  TeammateCreateParams, TeammateIdParams, TeammateUpdateParams, type MessageSearchHit } from "@noldova/teamrun.protocol";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  ApprovalStatus,
  AttachmentInput,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationResponder,
  ConversationResponderParams,
  ConversationSearchHit,
  ConversationSearchParams,
  DetailKind,
  DraftDiscardParams,
  DraftSaveParams,
  ErrorCode,
  ForkedSession,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageListParams,
  MessageSender,
  MessageSendParams,
  MessageStatus,
  RequestedSettings
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ConversationsServiceTests {
  @TestMethod
  public async keepsATitleAPersonChoseAndGivesAMadeOneOnlyWithoutOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();

    const given = await host.conversations.giveTitleAsync(conversation.id, "Made");
    Assert.areEqual("Made", given?.title);
    Assert.areEqual(conversation.updatedAt, given?.updatedAt);
    Assert.isFalse(given?.edited ?? true);
    Assert.isFalse(given?.titleChosen ?? true);
    Assert.areEqual("Made", (await host.conversations.findAsync(conversation.id))?.title);
    const feed = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    Assert.isNull(await host.conversations.giveTitleAsync("missing", "Made"));
    Assert.areEqual(feed, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    await host.conversations.giveTitleAsync(conversation.id, "Made");
    Assert.areEqual(feed + 1, (await host.context.database.changeFeed.readAfterAsync(0)).length);

    const renamed = await host.conversations.renameAsync(new ConversationRenameParams(conversation.id, "Chosen"));
    Assert.isTrue(renamed.titleChosen);
    Assert.isTrue(renamed.edited);
    Assert.isNull(await host.conversations.giveTitleAsync(conversation.id, "Made again"));
    Assert.areEqual("Chosen", (await host.conversations.findAsync(conversation.id))?.title);
  }

  @TestMethod
  public async managesMembershipsIdempotentlyAndStartsFreshAfterRemoval(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    const params = new ConversationMemberParams(conversation.id, teammate.id);
    const member = await host.conversations.addMemberAsync(params);
    const feedCount = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    Assert.areEqual(member.joinedAt, (await host.conversations.addMemberAsync(params)).joinedAt);
    Assert.areEqual(feedCount, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    await host.conversations.setMemberSessionAsync(params, "session", true);
    Assert.areEqual("session", (await host.conversations.addMemberAsync(params)).nativeSessionId);
    Assert.isTrue((await host.conversations.findMemberAsync(params))?.resumedNativeSession ?? false);
    await host.conversations.removeMemberAsync(params);
    await host.conversations.removeMemberAsync(params);
    Assert.isNull(await host.conversations.findMemberAsync(params));
    Assert.isNull((await host.conversations.addMemberAsync(params)).nativeSessionId);
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));
    Assert.isNull(await host.conversations.findMemberAsync(params));
    Assert.isDefined(await host.teammates.findAsync(teammate.id));
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(0)).some(t =>
      t.entity === ChangeEntity.ChatMember && t.entityId === JSON.stringify([conversation.id, teammate.id]) && t.operation === ChangeOperation.Delete));
    await Assert.throwsAsync(() => host.conversations.listMembersAsync(new ConversationIdParams("missing")), ServiceException);
    await Assert.throwsAsync(() => host.conversations.addMemberAsync(params), ServiceException);
    await Assert.throwsAsync(() => host.conversations.removeMemberAsync(params), ServiceException);
    await Assert.throwsAsync(() => host.conversations.setMemberSessionAsync(params, "session", false), ServiceException);
    const another = await host.createConversationAsync();
    await Assert.throwsAsync(() => host.conversations.addMemberAsync(new ConversationMemberParams(another.id, "missing")), ServiceException);
  }

  @TestMethod
  public async setsAMembersModeForItsChatKeepingItsSessionAndRecordsTheChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, (await host.createProviderAsync()).id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const params = new ConversationMemberParams(conversation.id, teammate.id);
    await host.conversations.addMemberAsync(params);
    await host.conversations.addMemberAsync(new ConversationMemberParams(other.id, teammate.id));
    await host.conversations.setMemberSessionAsync(params, "session", true);
    const feedCount = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const set = await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, "plan"));
    const kept = await host.conversations.setMemberSessionAsync(params, "next", false);
    const cleared = await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, null));

    Assert.areEqual("plan session true", `${set.mode} ${set.nativeSessionId} ${String(set.resumedNativeSession)}`);
    Assert.areEqual("plan", kept.mode);
    Assert.isNull(cleared.mode);
    Assert.isNull((await host.conversations.findMemberAsync(new ConversationMemberParams(other.id, teammate.id)))?.mode);
    Assert.areEqual(feedCount + 3, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(feedCount)).every(t => t.entity === ChangeEntity.ChatMember && t.operation === ChangeOperation.Update));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, "missing", "plan")),
      ServiceException)).info.name);
  }

  @TestMethod
  public async setsAMembersModelAndEffortForItsChatKeepingItsSessionAndModeAndRecordsTheChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, (await host.createProviderAsync()).id, Harness.Provider, "m1", "low"));
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const params = new ConversationMemberParams(conversation.id, teammate.id);
    await host.conversations.addMemberAsync(params);
    await host.conversations.addMemberAsync(new ConversationMemberParams(other.id, teammate.id));
    await host.conversations.setMemberSessionAsync(params, "session", true);
    await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, "plan"));
    const feedCount = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const set = await host.conversations.setMemberSettingsAsync(new ChatMemberSettingsParams(conversation.id, teammate.id, new ChatMemberSettings("m2", "high")));
    const kept = await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, null));
    const cleared = await host.conversations.setMemberSettingsAsync(new ChatMemberSettingsParams(conversation.id, teammate.id, null));

    Assert.areEqual("m2 high plan session true",
      `${String(set.settings?.model)} ${String(set.settings?.effort)} ${String(set.mode)} ${String(set.nativeSessionId)} ${String(set.resumedNativeSession)}`);
    Assert.areEqual("high", kept.settings?.effort);
    Assert.isNull(cleared.settings);
    Assert.isNull((await host.conversations.findMemberAsync(new ConversationMemberParams(other.id, teammate.id)))?.settings);
    Assert.areEqual("m1 low", `${String((await host.teammates.findAsync(teammate.id))?.model)} ${String((await host.teammates.findAsync(teammate.id))?.effort)}`);
    Assert.areEqual(feedCount + 3, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(feedCount)).every(t => t.entity === ChangeEntity.ChatMember && t.operation === ChangeOperation.Update));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.setMemberSettingsAsync(new ChatMemberSettingsParams(conversation.id, "missing", null)),
      ServiceException)).info.name);
  }

  @TestMethod
  public async turnsAChatsPlanFirstOnAndOffKeepingItsUpdateTimeAndRecordsOnlyAChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const feedCount = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const on = await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const again = await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const stored = (await host.conversations.findAsync(conversation.id))!;
    const off = await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, false));

    Assert.areEqual(JSON.stringify([true, true, true, false]), JSON.stringify([on.planFirst, again.planFirst, stored.planFirst, off.planFirst]));
    Assert.areEqual(conversation.updatedAt, stored.updatedAt);
    Assert.isFalse((await host.conversations.findAsync(conversation.id))!.planFirst);
    Assert.areEqual(feedCount + 2, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(feedCount)).every(t => t.entity === ChangeEntity.Chat && t.operation === ChangeOperation.Update));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.setPlanFirstAsync(new ChatPlanFirstParams("missing", true)), ServiceException)).info.name);
  }

  @TestMethod
  public async approvesAndReopensEachMembersPlanOnItsOwnAndPlansFirstForEveryMemberAgainOnceTurnedOnRecordingOnlyAChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const members = async (): Promise<string> => {
      const found = (await host.conversations.findAsync(conversation.id))!;
      return ["t-bob", "t-carol", null].map(t => found.plansFirst(t)).join(",");
    };
    const feedCount = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const notPlanning = await host.conversations.approvePlanAsync(conversation.id, "t-bob");
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    await host.conversations.approvePlanAsync(conversation.id, "t-bob");
    const bob = await members();
    await host.conversations.approvePlanAsync(conversation.id, "t-bob");
    await host.conversations.approvePlanAsync(conversation.id, null);
    const both = await members();
    await host.conversations.reopenPlanAsync(conversation.id, "t-bob");
    const reopened = await members();
    await host.conversations.reopenPlanAsync(conversation.id, "t-bob");
    await host.conversations.approvePlanAsync(conversation.id, "t-bob");
    const stored = (await host.conversations.findAsync(conversation.id))!;
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const again = await members();

    Assert.areEqual(JSON.stringify(conversation.toJson()), JSON.stringify(notPlanning.toJson()));
    Assert.areEqual("false,true,true", bob);
    Assert.areEqual("false,true,false", both);
    Assert.areEqual("true,true,false", reopened);
    Assert.areEqual("true,true,true", again);
    Assert.areEqual(conversation.updatedAt, stored.updatedAt);
    Assert.areEqual(feedCount + 6, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.approvePlanAsync("missing", null), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.reopenPlanAsync("missing", null), ServiceException)).info.name);
  }

  @TestMethod
  public async rollsBackProviderChangesAndDeletionWhenAnyMembershipIsBusy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const replacement = await host.createProviderAsync("fake", "Replacement");
    const first = await host.createConversationAsync();
    const second = await host.createConversationAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const firstMember = new ConversationMemberParams(first.id, teammate.id);
    const secondMember = new ConversationMemberParams(second.id, teammate.id);
    await host.conversations.addMemberAsync(firstMember);
    await host.conversations.addMemberAsync(secondMember);
    await host.conversations.setMemberSessionAsync(firstMember, "first-session", false);
    await host.conversations.setMemberSessionAsync(secondMember, "second-session", false);
    const provenance = new Provenance(provider.id, new RequestedSettings("fake", null, null),
      new ObservedSettings(null, null, null, null), null, false);
    const reply = new Message("busy", second.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], provenance, "t", null, null);
    await host.messages.insertAsync(reply);
    const before = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    await Assert.throwsAsync(() => host.teammates.updateAsync(new TeammateUpdateParams(teammate.id, "Alice", null, replacement.id,
      Harness.Provider, null, null)), ServiceException);
    Assert.areEqual(provider.id, (await host.teammates.findAsync(teammate.id))?.providerId);
    Assert.areEqual("first-session", (await host.conversations.findMemberAsync(firstMember))?.nativeSessionId);
    await Assert.throwsAsync(() => host.teammates.deleteAsync(new TeammateIdParams(teammate.id)), ServiceException);
    Assert.isFalse(await host.conversations.findMemberAsync(firstMember) === null);
    Assert.areEqual(before, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    await host.teammates.updateAsync(new TeammateUpdateParams(teammate.id, "Alice", "New role", provider.id, Harness.Provider, "new-model", "low"));
    Assert.areEqual("second-session", (await host.conversations.findMemberAsync(secondMember))?.nativeSessionId);
    await host.messages.updateAsync(reply.withStatus(MessageStatus.Cancelled, "end"));
    await host.teammates.deleteAsync(new TeammateIdParams(teammate.id));
    Assert.isNull(await host.conversations.findMemberAsync(firstMember));
    Assert.isNull(await host.conversations.findMemberAsync(secondMember));
  }

  @TestMethod
  public async resetsAndRemovesATeammatesMembershipsInATransactionOfItsOwnWhenGivenNone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const params = new ConversationMemberParams((await host.createConversationAsync()).id, teammate.id);
    await host.conversations.addMemberAsync(params);
    await host.conversations.setMemberSessionAsync(params, "first-session", true, provider.id);

    await host.conversations.resetTeammateSessionsAsync(teammate.id);
    const afterTeammateReset = await host.conversations.findMemberAsync(params);
    await host.conversations.setMemberSessionAsync(params, "second-session", false, provider.id);
    await host.conversations.resetProviderSessionsAsync(provider.id);
    const afterProviderReset = await host.conversations.findMemberAsync(params);
    await host.conversations.removeTeammateMembersAsync(teammate.id);

    Assert.areEqual(JSON.stringify([null, false]), JSON.stringify([afterTeammateReset?.nativeSessionId, afterTeammateReset?.resumedNativeSession]));
    Assert.isNotNull(afterProviderReset);
    Assert.isNull(afterProviderReset.nativeSessionId);
    Assert.isNull(await host.conversations.findMemberAsync(params));
  }

  @TestMethod
  public async preservesInsertionOrderWhenCreationTimesTie(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const timestamp = "2026-09-14T00:00:00.000Z";
    const first = new Conversation("00000000-0000-7000-8000-000000000002", project.id, "first", timestamp, timestamp);
    const second = new Conversation("00000000-0000-7000-8000-000000000001", project.id, "second", timestamp, timestamp);
    for (const conversation of [first, second])
      await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [conversation.id, project.id, JSON.stringify(conversation.toJson()), timestamp, timestamp]));

    Assert.areEqual([first.id, second.id].join(","), (await host.conversations.listAsync(new ConversationListParams(project.id))).map(t => t.id).join(","));
  }

  @TestMethod
  public async refusesToDeleteAnUnreconciledOpenReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(new Message("orphan", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Running, [], null, "t", null, null));
    const failure = await Assert.throwsAsync(() => host.conversations.deleteAsync(new ConversationIdParams(conversation.id)), ServiceException);
    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.isNotNull(await host.conversations.findAsync(conversation.id));
  }

  @TestMethod
  public async createsListsAndFindsConversations(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();

    const untitled = await host.conversations.createAsync(new ConversationCreateParams(project.id, null));
    const titled = await host.conversations.createAsync(new ConversationCreateParams(project.id, "Login"));
    const listed = await host.conversations.listAsync(new ConversationListParams(project.id));

    Assert.areEqual("New chat", untitled.title);
    Assert.areEqual("Login", titled.title);
    Assert.areEqual(project.id, titled.projectId);
    Assert.areEqual([untitled.id, titled.id].join(","), listed.map(t => t.id).join(","));
    Assert.areEqual("Login", (await host.conversations.findAsync(titled.id))?.title);
    Assert.isNull(await host.conversations.findAsync("nope"));
    Assert.areEqual(2, (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Chat).length);
  }

  @TestMethod
  public async listsTheProjectsChatsWithNoMessageAndNoDraftContent(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chats: Conversation[] = [];
    for (let i = 0; i < 6; i++)
      chats.push(await host.createConversationAsync(project));
    const [blank, spaced, worded, attached, discarded, sent] = chats;
    await host.createConversationAsync(await host.openProjectAsync("beta"));
    await host.drafts.saveAsync(new DraftSaveParams(spaced!.id, " \n\t", []));
    await host.drafts.saveAsync(new DraftSaveParams(worded!.id, "Look", []));
    await host.drafts.saveAsync(new DraftSaveParams(attached!.id, "", [new AttachmentInput("a.txt", "text/plain", Buffer.from("a").toString("base64"), null)]));
    const draft = await host.drafts.saveAsync(new DraftSaveParams(discarded!.id, "Gone", []));
    await host.drafts.discardAsync(new DraftDiscardParams(discarded!.id, draft.revision));
    await host.messages.insertAsync(new Message("m", sent!.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"));

    const empty = await host.conversations.listEmptyAsync(new ConversationListParams(project.id));

    Assert.areEqual([blank!.id, spaced!.id, discarded!.id].join(","), empty.map(t => t.id).join(","));
  }

  @TestMethod
  public async leavesOutOfTheEmptyChatsOneThePersonRenamedMovedChoseSettingsForOrChangedTheTeammatesOf(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const other = await host.openProjectAsync("beta");
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const chats: Conversation[] = [];
    for (let i = 0; i < 6; i++)
      chats.push(await host.createConversationAsync(project));
    const [untouched, kept, renamed, chosen, joined, left] = chats;
    const moved = await host.createConversationAsync(other);
    const started = await host.conversations.createAsync(new ConversationCreateParams(project.id, null, bob.id));
    await host.conversations.setResponderAsync(new ConversationResponderParams(kept!.id, new ConversationResponder(bob.id)));
    await host.conversations.renameAsync(new ConversationRenameParams(renamed!.id, "Login"));
    await host.conversations.setResponderAsync(new ConversationResponderParams(chosen!.id, new ConversationResponder(bob.id), true));
    await host.conversations.addMemberAsync(new ConversationMemberParams(joined!.id, bob.id));
    await host.conversations.addMemberAsync(new ConversationMemberParams(left!.id, bob.id));
    await host.conversations.removeMemberAsync(new ConversationMemberParams(left!.id, bob.id));
    await host.conversations.moveAsync(new ConversationMoveParams(moved.id, project.id));

    const empty = await host.conversations.listEmptyAsync(new ConversationListParams(project.id));

    Assert.areEqual([untouched!.id, kept!.id, started.id].join(","), empty.map(t => t.id).join(","));
    Assert.areEqual(bob.id, (await host.conversations.listMembersAsync(new ConversationIdParams(started.id))).map(t => t.teammateId).join(","));
    for (const conversation of [renamed!, chosen!, joined!, left!, moved])
      Assert.isTrue((await host.conversations.findAsync(conversation.id))?.edited ?? false);
    Assert.isFalse(started.edited || ((await host.conversations.findAsync(kept!.id))?.edited ?? true));
  }

  @TestMethod
  public async marksAChatEditedOnceAndNotForATeammateItAlreadyHasOrALeaveThatChangesNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const ann = await host.teammates.createAsync(new TeammateCreateParams("Ann", null, provider.id, Harness.Provider, null, null));
    const started = await host.conversations.createAsync(new ConversationCreateParams((await host.openProjectAsync()).id, null, bob.id));
    const updates = async (): Promise<number> => (await host.context.database.changeFeed.readAfterAsync(0))
      .filter(t => t.entity === ChangeEntity.Chat && t.entityId === started.id && t.operation === ChangeOperation.Update).length;

    await host.conversations.addMemberAsync(new ConversationMemberParams(started.id, bob.id));
    await host.conversations.removeMemberAsync(new ConversationMemberParams(started.id, ann.id));

    Assert.isFalse((await host.conversations.findAsync(started.id))?.edited ?? true);
    Assert.areEqual(0, await updates());
    await host.conversations.addMemberAsync(new ConversationMemberParams(started.id, ann.id));
    await host.conversations.removeMemberAsync(new ConversationMemberParams(started.id, ann.id));
    Assert.isTrue((await host.conversations.findAsync(started.id))?.edited ?? false);
    Assert.areEqual(1, await updates());
  }

  @TestMethod
  public async startsNoChatAndLogsNothingWhenTheTeammateItStartsWithIsMissing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const logged = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const failure = await Assert.throwsAsync(() => host.conversations.createAsync(new ConversationCreateParams(project.id, null, "gone")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, failure.info.name);
    Assert.areEqual(0, (await host.conversations.listAsync(new ConversationListParams(project.id))).length);
    Assert.areEqual(logged, (await host.context.database.changeFeed.readAfterAsync(0)).length);
  }

  @TestMethod
  public async rejectsAnUnknownProject(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const failure = await Assert.throwsAsync(() => host.conversations.createAsync(new ConversationCreateParams("nope", null)), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, failure.info.name);
  }

  @TestMethod
  public async movesAConversationToAnotherProjectAndLogsTheUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.openProjectAsync("beta");

    const moved = await host.conversations.moveAsync(new ConversationMoveParams(conversation.id, other.id));

    Assert.areEqual(other.id, moved.projectId);
    Assert.areEqual(other.id, (await host.conversations.findAsync(conversation.id))?.projectId);
    Assert.areEqual(1, (await host.conversations.listAsync(new ConversationListParams(other.id))).length);
    Assert.areEqual(0, (await host.conversations.listAsync(new ConversationListParams(conversation.projectId))).length);
    Assert.areEqual(ChangeOperation.Update, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
    const missingConversation = await Assert.throwsAsync(() => host.conversations.moveAsync(new ConversationMoveParams("nope", other.id)), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, missingConversation.info.name);
    const missingProject = await Assert.throwsAsync(() => host.conversations.moveAsync(new ConversationMoveParams(conversation.id, "nope")), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, missingProject.info.name);
  }

  @TestMethod
  public async renamesAConversationAndLogsTheUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();

    const renamed = await host.conversations.renameAsync(new ConversationRenameParams(conversation.id, "Renamed"));

    Assert.areEqual("Renamed", renamed.title);
    Assert.areEqual("Renamed", (await host.conversations.findAsync(conversation.id))?.title);
    Assert.areEqual(ChangeOperation.Update, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.renameAsync(new ConversationRenameParams("nope", "x")), ServiceException)).info.name);
  }

  @TestMethod
  public async touchesAConversationSoItListsFirstAmongTheNewestAndLogsTheUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const timestamp = "2026-09-14T00:00:00.000Z";
    const old = new Conversation("00000000-0000-7000-8000-000000000001", project.id, "Login", timestamp, timestamp);
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [old.id, project.id, JSON.stringify(old.toJson()), timestamp, timestamp]));

    const touched = await host.conversations.touchAsync(new ConversationIdParams(old.id));

    Assert.areEqual("Login", touched.title);
    Assert.areEqual(timestamp, touched.createdAt);
    Assert.isTrue(touched.updatedAt > timestamp);
    Assert.areEqual(touched.updatedAt, (await host.conversations.findAsync(old.id))?.updatedAt);
    Assert.areEqual(ChangeOperation.Update, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.touchAsync(new ConversationIdParams("nope")), ServiceException)).info.name);
  }

  @TestMethod
  public async setsAndClearsTheChosenTeammateOrDefaultTeammateKeepingTheUpdateTimeAndLogsTheUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const timestamp = "2026-09-14T00:00:00.000Z";
    const old = new Conversation("00000000-0000-7000-8000-000000000001", project.id, "Login", timestamp, timestamp);
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [old.id, project.id, JSON.stringify(old.toJson()), timestamp, timestamp]));
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Reviews", provider.id, Harness.Provider, null, null));
    const fallback = (providerId: string | null, kind: string = "fake"): ConversationResponder =>
      new ConversationResponder(null, new RequestedSettings(kind, "m1", null), providerId);
    const updatedAt = async (): Promise<string | undefined> =>
      (await host.context.database.connection.queryAsync(new SqlQuery("SELECT updatedAt FROM chats WHERE id = ?", [old.id])))[0]?.readString("updatedAt");

    const chosen = await host.conversations.setResponderAsync(new ConversationResponderParams(old.id, new ConversationResponder(bob.id)));

    Assert.areEqual([bob.id, timestamp, bob.id, timestamp].join(","),
      [chosen.responder?.teammateId, chosen.updatedAt, (await host.conversations.findAsync(old.id))?.responder?.teammateId, await updatedAt()].join(","));
    Assert.areEqual(ChangeOperation.Update, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
    await host.conversations.setResponderAsync(new ConversationResponderParams(old.id, fallback(provider.id)));
    const stored = (await host.conversations.findAsync(old.id))?.responder;
    Assert.areEqual(`null fake m1 ${provider.id}`, `${stored?.teammateId} ${stored?.requested?.kind} ${stored?.requested?.model} ${stored?.providerId}`);
    Assert.isNull((await host.conversations.setResponderAsync(new ConversationResponderParams(old.id, null))).responder);
    Assert.isNull((await host.conversations.findAsync(old.id))?.responder);
    const refusals = await Promise.all([new ConversationResponderParams("nope", new ConversationResponder(bob.id)), new ConversationResponderParams(old.id, new ConversationResponder("gone")),
      new ConversationResponderParams(old.id, fallback("gone")), new ConversationResponderParams(old.id, fallback(provider.id, "codex"))]
      .map(async t => (await Assert.throwsAsync(() => host.conversations.setResponderAsync(t), ServiceException)).info.name));
    Assert.areEqual([ErrorCode.NotFound, ErrorCode.NotFound, ErrorCode.NotFound, ErrorCode.InvalidParams].join(","), refusals.join(","));
    Assert.isNull((await host.conversations.findAsync(old.id))?.responder);
  }

  @TestMethod
  public async startsAResponderOnlyInAChatThatHoldsNoneAndReturnsTheResponderItHolds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Reviews", provider.id, Harness.Provider, null, null));
    const chat = await host.conversations.createAsync(new ConversationCreateParams(project.id, null));
    const fallback = new ConversationResponder(null, new RequestedSettings("fake", "m1", null), provider.id);

    const started = await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id, new ConversationResponder(bob.id), false, true));
    const feed = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    const kept = await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id, fallback, false, true));

    Assert.areEqual([bob.id, bob.id, bob.id].join(","),
      [started.responder?.teammateId, kept.responder?.teammateId, (await host.conversations.findAsync(chat.id))?.responder?.teammateId].join(","));
    Assert.areEqual(feed, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.isFalse(kept.edited);
  }

  @TestMethod
  public async keepsAChatsTeammateAgainstAResponderThePersonDidNotChooseWithoutOneWhileTheTeammateIsInTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Reviews", provider.id, Harness.Provider, null, null));
    const joined = await host.conversations.createAsync(new ConversationCreateParams(project.id, null));
    const outside = await host.conversations.createAsync(new ConversationCreateParams(project.id, null));
    const picked = await host.conversations.createAsync(new ConversationCreateParams(project.id, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(joined.id, bob.id));
    await host.conversations.addMemberAsync(new ConversationMemberParams(picked.id, bob.id));
    for (const chat of [joined, outside, picked])
      await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id, new ConversationResponder(bob.id)));
    const fallback = new ConversationResponder(null, new RequestedSettings("fake", "m1", null), provider.id);
    const feed = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const kept = await host.conversations.setResponderAsync(new ConversationResponderParams(joined.id, fallback));
    const cleared = await host.conversations.setResponderAsync(new ConversationResponderParams(joined.id, null));
    const unchanged = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    const replaced = await host.conversations.setResponderAsync(new ConversationResponderParams(outside.id, fallback));
    const chosen = await host.conversations.setResponderAsync(new ConversationResponderParams(picked.id, fallback, true));

    Assert.areEqual([bob.id, bob.id, bob.id, "null", "null"].join(","), [kept.responder?.teammateId, cleared.responder?.teammateId,
      (await host.conversations.findAsync(joined.id))?.responder?.teammateId, String(replaced.responder?.teammateId), String(chosen.responder?.teammateId)].join(","));
    Assert.areEqual(feed, unchanged);
    Assert.areEqual("fake", (await host.conversations.findAsync(outside.id))?.responder?.requested?.kind);
  }

  @TestMethod
  public async dropsAReadingPositionAtOrAfterTheRewoundSequenceAndKeepsAnEarlierOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [rewound, kept] = [await host.createConversationAsync(), await host.createConversationAsync()];
    await host.readingPositions.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(rewound.id, "m2", 2, 0), new ConversationPosition(kept.id, "m1", 1, 0)]));

    await host.conversations.removeFromAsync(rewound.id, 2);
    await host.conversations.removeFromAsync(kept.id, 2);

    Assert.areEqual(kept.id, (await host.readingPositions.listAsync()).map(t => t.conversationId).join());
  }

  @TestMethod
  public async removesMessagesFromASequenceAndMarksTheSessionReset(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "First", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Second", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(new MessageListParams(conversation.id, null));
    const options = [new ApprovalOption("ok", "Ok", ApprovalOutcome.Approved, ApprovalScope.Once)];
    await host.approvals.insertAsync(new Approval("apr-2", messages[3]?.id ?? "", ApprovalKind.Tool, "Bash", "Run", null, options, ApprovalStatus.Pending, null, "t", null));
    const before = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const removed = await host.conversations.removeFromAsync(conversation.id, 2);
    const marked = await host.conversations.setSessionResetAsync(conversation.id, true);

    Assert.areEqual("2,3", removed.map(t => t.sequence).join(","));
    Assert.areEqual("First,Working", (await host.messages.listAsync(new MessageListParams(conversation.id, null))).map(t => t.details[0]?.text).join(","));
    Assert.isNull(await host.approvals.findAsync("apr-2"));
    Assert.isTrue(marked.sessionReset);
    Assert.isTrue((await host.conversations.findAsync(conversation.id))?.sessionReset ?? false);
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).slice(before);
    Assert.areEqual(1, changes.filter(t => t.entity === ChangeEntity.Approval && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(2, changes.filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(ChangeOperation.Update, changes.at(-1)?.operation);
    Assert.isFalse((await host.conversations.setSessionResetAsync(conversation.id, false)).sessionReset);
    const forked = await host.conversations.setForkedSessionAsync(conversation.id, new ForkedSession("fake", null, "thread-2"));
    Assert.areEqual("thread-2", forked.forkedSession?.nativeSessionId);
    Assert.areEqual("thread-2", (await host.conversations.findAsync(conversation.id))?.forkedSession?.nativeSessionId);
    Assert.isNull((await host.conversations.setSessionResetAsync(conversation.id, true)).forkedSession);
    Assert.isNull((await host.conversations.setForkedSessionAsync(conversation.id, null)).forkedSession);
    Assert.isFalse((await host.conversations.findAsync(conversation.id))?.sessionReset ?? true);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.removeFromAsync("nope", 0), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.setSessionResetAsync("nope", true), ServiceException)).info.name);
  }

  @TestMethod
  public async keepsARunsOutputPerBlockUntilARewindRemovesItsMessageOrItsChatIsDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [conversation, kept] = [await host.createConversationAsync(), await host.createConversationAsync()];
    for (const [chat, text] of [[conversation, "First"], [conversation, "Second"], [kept, "Other"]] as const) {
      await host.engine.sendAsync(new MessageSendParams(chat.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
    }
    const [, first, , second] = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).map(t => t.id);
    const other = (await host.messages.listAsync(new MessageListParams(kept.id, null)))[1]?.id ?? "";
    const output = (text: string): JsonObject => ({ lines: [{ text }], cutLines: 0 });
    const outputs = async (chatId: string): Promise<string> => (await host.conversations.listRunOutputsAsync(new ConversationIdParams(chatId)))
      .map(t => `${t.messageId === first ? "first" : t.messageId === second ? "second" : t.messageId}:${t.site}:${t.block}:${JSON.stringify(t.output)}`).sort().join(" ");

    await host.conversations.saveRunOutputAsync(new RunOutput(conversation.id, first ?? "", "body", 0, output("$ ls")));
    await host.conversations.saveRunOutputAsync(new RunOutput(conversation.id, first ?? "", "body", 0, output("$ pwd")));
    await host.conversations.saveRunOutputAsync(new RunOutput(conversation.id, second ?? "", "body", 1, output("$ cd")));
    await host.conversations.saveRunOutputAsync(new RunOutput(kept.id, other, "body", 0, output("$ echo")));
    const saved = await outputs(conversation.id);
    const refusals = await Promise.all([new RunOutput(kept.id, first ?? "", "body", 0, {}), new RunOutput("gone", first ?? "", "body", 0, {})]
      .map(async t => (await Assert.throwsAsync(() => host.conversations.saveRunOutputAsync(t), ServiceException)).info.name));
    await host.conversations.removeFromAsync(conversation.id, 2);
    const rewound = await outputs(conversation.id);
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual('first:body:0:{"lines":[{"text":"$ pwd"}],"cutLines":0} second:body:1:{"lines":[{"text":"$ cd"}],"cutLines":0}', saved);
    Assert.areEqual([ErrorCode.NotFound, ErrorCode.NotFound].join(), refusals.join());
    Assert.areEqual('first:body:0:{"lines":[{"text":"$ pwd"}],"cutLines":0}', rewound);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => outputs(conversation.id), ServiceException)).info.name);
    Assert.areEqual(`${other}:body:0:{"lines":[{"text":"$ echo"}],"cutLines":0}`, await outputs(kept.id));
    Assert.areEqual(0, (await host.context.database.connection.queryAsync(new SqlQuery("SELECT 1 AS found FROM runOutputs WHERE chatId = ?", [conversation.id]))).length);
  }

  @TestMethod
  public async keepsAChatsNewestRunOutputsWithinItsCharactersDroppingTheOldestSavedAndAnyOutputLargerThanThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    for (const text of ["First", "Second", "Third"]) {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
    }
    const [, first, , second, , third] = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).map(t => t.id);
    const names = new Map([[first, "first"], [second, "second"], [third, "third"]]);
    const save = (messageId: string | undefined, characters: number): Promise<void> =>
      host.conversations.saveRunOutputAsync(new RunOutput(conversation.id, messageId ?? "", "body", 0, { lines: [{ text: "x".repeat(characters) }], cutLines: 0 }));
    const kept = async (): Promise<string> => (await host.conversations.listRunOutputsAsync(new ConversationIdParams(conversation.id))).map(t => names.get(t.messageId)).sort().join();
    const large = Resources.runOutputsKeptCharacters * 0.4;

    await save(first, large);
    await save(second, large);
    const withinTheCap = await kept();
    await save(third, large);
    const pastTheCap = await kept();
    await save(first, large);
    const savedAgain = await kept();
    await save(third, Resources.runOutputsKeptCharacters);
    const tooLarge = await kept();

    Assert.areEqual(JSON.stringify(["first,second", "second,third", "first,third", "first"]), JSON.stringify([withinTheCap, pastTheCap, savedAgain, tooLarge]));
  }

  @TestMethod
  public async deletesAConversationWithItsMessagesApprovalsAndReadingPosition(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const kept = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const reply = (await host.messages.listAsync(new MessageListParams(conversation.id, null)))[1];
    await host.approvals.insertAsync(new Approval("apr-1", reply?.id ?? "", ApprovalKind.Tool, "Bash", "Run", null, [new ApprovalOption("ok", "Ok", ApprovalOutcome.Approved, ApprovalScope.Once)], ApprovalStatus.Pending, null, "t", null));
    await host.readingPositions.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(conversation.id, reply?.id ?? "", 1, 0), new ConversationPosition(kept.id, "m1", 0, 0)]));
    const before = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    const changes = await host.context.database.changeFeed.readAfterAsync(0);
    Assert.isNull(await host.conversations.findAsync(conversation.id));
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
    Assert.areEqual([kept.id].join(), (await host.readingPositions.listAsync()).map(t => t.conversationId).join());
    Assert.areEqual(before + 4, changes.length);
    Assert.areEqual(1, changes.slice(before).filter(t => t.entity === ChangeEntity.Approval && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(2, changes.slice(before).filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(ChangeEntity.Chat, changes.at(-1)?.entity);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.conversations.deleteAsync(new ConversationIdParams(conversation.id)), ServiceException)).info.name);
  }

  @TestMethod
  public async searchesTitlesAndMessageTexts(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const login = await host.createConversationAsync(project, "Login flow");
    const tests = await host.createConversationAsync(project, "Tests");
    const notes = await host.createConversationAsync(project, "Notes 100%");
    const text = (id: string, conversationId: string, sequence: number, content: string, at: string): Message => {
      const detail = new MessageDetail(0, DetailKind.Text, content, null, at);
      return new Message(id, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, at, null, at);
    };
    const first = "Please fix the LOGIN page as we discussed earlier today.\nIt shows a blank form after the redirect and the tests fail.";
    await host.messages.insertAsync(text("m1", tests.id, 0, first, "t1"));
    await host.messages.insertAsync(text("m2", tests.id, 1, "The login test still fails; the second message about login is the latest.", "t2"));
    await host.messages.insertAsync(text("m3", notes.id, 0, "Coverage stays at 100% after the change.", "t3"));
    await host.messages.insertAsync(text("m4", login.id, 0, "x".repeat(200) + " login " + "y".repeat(200), "t4"));
    await host.messages.insertAsync(text("m5", notes.id, 1, "z".repeat(200) + " needle " + "w".repeat(200), "t5"));
    const search = async (query: string, limit: number = 10): Promise<readonly ConversationSearchHit[]> =>
      (await host.conversations.searchAsync(new ConversationSearchParams(query, limit))).hits;

    const byLogin = await search("login");
    Assert.areEqual(2, byLogin.length);
    Assert.areEqual(1, byLogin.filter(t => t.conversationId === login.id).length);
    Assert.isNull(byLogin.find(t => t.conversationId === login.id)?.messageId);
    Assert.areEqual("Login flow", byLogin.find(t => t.conversationId === login.id)?.snippet);
    const inTests = byLogin.find(t => t.conversationId === tests.id);
    Assert.areEqual("m2", inTests?.messageId);
    Assert.areEqual("Tests", inTests?.title);
    Assert.areEqual(project.id, inTests?.projectId);
    Assert.isTrue(inTests?.snippet.startsWith("The login test still fails") ?? false);
    Assert.areEqual(1, (await search("login", 1)).length);

    const tail = await search("blank form");
    Assert.areEqual("m1", tail[0]?.messageId);
    Assert.isTrue(tail[0]?.snippet.startsWith("…") ?? false);
    Assert.isTrue(tail[0]?.snippet.includes("blank form after the redirect") ?? false);
    Assert.isFalse(tail[0]?.snippet.includes("\n") ?? true);

    const deep = await search("needle");
    Assert.areEqual("m5", deep[0]?.messageId);
    Assert.isTrue(deep[0]?.snippet.startsWith("…") ?? false);
    Assert.isTrue(deep[0]?.snippet.endsWith("…") ?? false);
    Assert.isTrue(deep[0]?.snippet.includes(" needle ") ?? false);
    Assert.isTrue((deep[0]?.snippet.length ?? 0) <= 122);

    Assert.areEqual(1, (await search("100%")).length);
    Assert.areEqual(notes.id, (await search("100%"))[0]?.conversationId);
    Assert.areEqual(0, (await search("100_")).length);
    Assert.areEqual(0, (await search("nothing here")).length);
    Assert.areEqual(0, (await search("_")).length);
  }

  @TestMethod
  public async findsTheLatestChatsOrThoseWhoseTitleHoldsTheTextEachWithItsTeammatesAndCountsThemAll(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const builder = await host.teammates.createAsync(new TeammateCreateParams("Builder", null, provider.id, Harness.Provider, null, null));
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Reviewer", null, provider.id, Harness.Provider, null, null));
    const project = await host.openProjectAsync();
    const freezes = await host.createConversationAsync(project, "Terminal tab freezes on Windows");
    const perTeammate = await host.createConversationAsync(project, "Open a terminal per teammate");
    const login = await host.createConversationAsync(project, "Review the login flow");
    await host.conversations.addMemberAsync(new ConversationMemberParams(freezes.id, builder.id));
    await host.conversations.addMemberAsync(new ConversationMemberParams(freezes.id, reviewer.id));
    await host.conversations.addMemberAsync(new ConversationMemberParams(perTeammate.id, builder.id));
    const find = async (query: string, limit: number): Promise<string> => {
      const result = await host.conversations.findChatsAsync(new ChatFindParams(query, limit));
      return `${result.total}:${result.hits.map(t => `${t.title}[${t.teammateNames.join(",")}]${t.projectId === project.id ? "" : "!"}`).join("|")}`;
    };

    const latest = await find(" ", 2);
    const matched = await find("TERM", 10);
    const none = await find("nothing here", 10);
    await host.conversations.deleteAsync(new ConversationIdParams(freezes.id));

    Assert.areEqual("3:Review the login flow[]|Open a terminal per teammate[Builder]", latest);
    Assert.areEqual("2:Open a terminal per teammate[Builder]|Terminal tab freezes on Windows[Builder,Reviewer]", matched);
    Assert.areEqual("0:", none);
    Assert.areEqual("1:Open a terminal per teammate[Builder]", await find("term", 10));
    Assert.areEqual(login.id, (await host.conversations.findChatsAsync(new ChatFindParams("", 1))).hits[0]?.chatId);
  }

  @TestMethod
  public async searchesMessageTextThroughItsIndexKeptInStepWithEachInsertUpdateAndDelete(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project, "Fix toMiles in distance.js");
    const other = await host.createConversationAsync(project, "Notes");
    const detail = (content: string, at: string): MessageDetail => new MessageDetail(0, DetailKind.Text, content, null, at);
    const asked = new Message("m1", chat.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [detail("Open a terminal per teammate", "t1")], null, "t1", null,
      "t1");
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    const answered = new Message("m2", chat.id, 1, MessageAuthor.Provider, "m1", MessageStatus.Completed,
      [detail("The terminal opens in the project folder.", "t2"), new MessageDetail(1, DetailKind.Reasoning, "thinking about a terminus", null, "t2")],
      provenance, "t2", "t2", "t2", [], "builder", "Builder");
    await host.messages.insertAsync(asked);
    await host.messages.insertAsync(answered);
    await host.messages.insertAsync(new Message("m3", other.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [detail("She said \"run it\" twice", "t3")], null, "t3",
      null, "t3", [], null, null, [], new MessageSender(chat.id, null, "TeamRun")));
    await host.messages.insertAsync(new Message("m4", other.id, 1, MessageAuthor.Provider, "m3", MessageStatus.Completed, [detail("Tunnels dug", "t4")],
      new Provenance("prv-1", new RequestedSettings("fake", null, null), new ObservedSettings("codex", null, null, null), null, false), "t4", "t4", "t4"));
    const search = async (query: string, limit: number = 10): Promise<string> => {
      const result = await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, limit));
      return `${result.total}:${result.hits.map(t => t.messageId).join(",")}`;
    };
    const first = async (query: string): Promise<MessageSearchHit | undefined> => (await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 10))).hits[0];

    Assert.areEqual(JSON.stringify(["2:m2,m1", "2:m2,m1", "2:m2", "2:m2,m1", "0:", "1:m3", "0:"]), JSON.stringify([await search("term"), await search(" TERMINAL "),
      await search("term", 1), await search("te"), await search("terminus"), await search("\"run it\""), await search("folder!")]));
    Assert.areEqual(JSON.stringify([chat.id, project.id, "Fix toMiles in distance.js", 1, "Builder", "The terminal opens in the project folder.", "t2"]),
      JSON.stringify([(await first("terminal"))?.chatId, (await first("terminal"))?.projectId, (await first("terminal"))?.chatTitle, (await first("terminal"))?.sequence, (await first("terminal"))?.teammateName,
        (await first("terminal"))?.snippet, (await first("terminal"))?.createdAt]));
    Assert.isNull((await first("per teammate"))?.teammateName ?? null);
    const authorOf = async (query: string): Promise<string> => {
      const hit = await first(query);
      return [hit?.author, hit?.senderName, hit?.teammateName, hit?.providerId, hit?.providerKind].map(String).join("|");
    };
    Assert.areEqual(JSON.stringify(["Provider|null|Builder|null|fake", "User|null|null|null|null", "User|TeamRun|null|null|null", "Provider|null|null|prv-1|codex"]),
      JSON.stringify([await authorOf("terminal"), await authorOf("per teammate"), await authorOf("\"run it\""), await authorOf("tunnels")]));

    await host.messages.updateAsync(asked.withDetails([detail("Run node --test in a terminal first", "t1")]));
    const updated = [await search("per teammate"), await search("node --test")];
    await host.conversations.deleteAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(JSON.stringify(["0:", "1:m1", "0:"]), JSON.stringify([...updated, await search("terminal")]));
  }

  @TestMethod
  public async indexesAReplyOnceItSettlesLeavingTheIndexAloneWhileItStreamsAndDroppingItWhenItReopens(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Tunnels");
    const detail = (content: string): MessageDetail => new MessageDetail(0, DetailKind.Text, content, null, "t1");
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    const reply = new Message("m1", chat.id, 0, MessageAuthor.Provider, null, MessageStatus.Running, [detail("Digging")], provenance, "t1", "t1", null);
    const indexed = async (): Promise<number> => (await host.context.database.connection.queryAsync(new SqlQuery("SELECT count(*) AS count FROM messageText", [])))
      .reduce((total, t) => total + t.readInteger("count"), 0);
    const found = async (): Promise<number> => (await host.conversations.searchMessagesAsync(new ConversationSearchParams("tunnel", 10))).total;
    const streaming = reply.withDetails([detail("Digging a tunnel")]);

    await host.messages.insertAsync(reply);
    await host.messages.updateAsync(streaming);
    const whileStreaming = [await indexed(), await found()];
    await host.messages.updateAsync(streaming.withStatus(MessageStatus.Completed, "t2"));
    const settled = [await indexed(), await found()];
    await host.messages.updateAsync(streaming.withStatus(MessageStatus.Running, null));

    Assert.areEqual(JSON.stringify([[0, 0], [1, 1], [0, 0]]), JSON.stringify([whileStreaming, settled, [await indexed(), await found()]]));
  }

  @TestMethod
  public async findsTheLastSavedMessagesFirstWhateverTheirTimeAndCountsAtMostAThousand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Tunnels");
    const message = (id: string, sequence: number, text: string, at: string): Message => new Message(id, chat.id, sequence, MessageAuthor.User, null,
      MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, text, null, at)], null, at, null, at);
    const search = async (query: string): Promise<string> => {
      const result = await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 3));
      return `${result.total}:${result.capped}:${result.hits.map(t => t.messageId).join(",")}`;
    };
    await host.messages.insertAsync(message("later", 0, "a tunnel dug later", "2026-11-02T00:00:00.000Z"));
    await host.messages.insertAsync(message("earlier", 1, "a tunnel dug earlier", "2026-11-01T00:00:00.000Z"));
    await host.context.database.connection.runInTransactionAsync(async transaction => {
      for (let i = 0; i < 999; i++)
        await host.messages.insertAsync(message(`many${i}`, i + 2, "many shafts", "2026-11-03T00:00:00.000Z"), transaction);
    });
    const belowTheCap = await search("shafts");
    await host.messages.insertAsync(message("last", 1001, "the last of many shafts", "2026-11-03T00:00:00.000Z"));
    const atTheCap = await search("shafts");
    await host.messages.insertAsync(message("over", 1002, "one shaft too many shafts", "2026-11-03T00:00:00.000Z"));

    Assert.areEqual(JSON.stringify(["2:false:earlier,later", "999:false:many998,many997,many996", "1000:false:last,many998,many997", "1000:true:over,last,many998",
      "1000:true:over,last,many998"]), JSON.stringify([await search("tunnel"), belowTheCap, atTheCap, await search("shafts"), await search("ft")]));
  }

  @TestMethod
  public async findsATextShorterThanATrigramAnywhereInEachMessageWhateverItsCaseSoALongerTextNeverFindsMore(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Doors");
    const texts = ["Open the door", "OPERA tickets", "Привет, мир", "a*b?c[d]", "Hope", "Gate 42, Straße"];
    for (const [i, text] of texts.entries())
      await host.messages.insertAsync(new Message(`m${i + 1}`, chat.id, i, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, text, null, `t${i + 1}`)], null, `t${i + 1}`, null, `t${i + 1}`));
    const search = async (query: string): Promise<string> => {
      const result = await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 10));
      return `${result.total}:${result.capped}:${result.hits.map(t => t.messageId).join(",")}`;
    };
    const growing = await Promise.all(["o", "op", "ope", "open"].map(async t => (await host.conversations.searchMessagesAsync(new ConversationSearchParams(t, 10))).total));

    Assert.areEqual(JSON.stringify(["3:false:m5,m2,m1", "3:false:m5,m2,m1", "3:false:m5,m2,m1", "1:false:m1", "1:false:m3", "1:false:m3", "1:false:m4", "1:false:m4",
      "1:false:m4", "0:false:", "1:false:m6", "1:false:m6", "Hope"]), JSON.stringify([await search("O"), await search("oP"), await search("OPE"), await search("open"), await search("пр"),
      await search("ПРИ"), await search("*"), await search("?c"), await search("[d"), await search("x"), await search("42"), await search("ßE"),
      (await host.conversations.searchMessagesAsync(new ConversationSearchParams("op", 10))).hits[0]?.snippet]));
    Assert.areEqual(JSON.stringify([3, 3, 3, 1]), JSON.stringify(growing));
  }

  @TestMethod
  public async readsAtMostTheLastTwoThousandIndexRowsForAShortTextAndAnswersTheCapOnceOlderOnesGoUnread(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Fillers");
    const message = (id: string, sequence: number, text: string): Message => new Message(id, chat.id, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t1")], null, "t1", null, "t1");
    const search = async (query: string): Promise<string> => {
      const result = await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 10));
      return `${result.total}:${result.capped}:${result.hits.map(t => t.messageId).join(",")}`;
    };
    await host.messages.insertAsync(message("old", 0, "qzx is the oldest"));
    await host.context.database.connection.runInTransactionAsync(async transaction => {
      for (let i = 1; i < Resources.shortSearchRows; i++)
        await host.messages.insertAsync(message(`filler${i}`, i, "plain words"), transaction);
    });
    const atTheBound = await search("qz");
    await host.messages.insertAsync(message("newest", Resources.shortSearchRows, "plain words"));

    Assert.areEqual(JSON.stringify([2000, "1:false:old", "1000:true:", "1:false:old"]),
      JSON.stringify([Resources.shortSearchRows, atTheBound, await search("qz"), await search("qzx")]));
  }

  @TestMethod
  public async foldsAShortTextsCaseAsTheIndexDoesSoAFinalSigmaTheMicroSignTheSharpSOrATitlecaseDigraphFindsWhatALongerTextFinds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Greek");
    const texts = ["λόγος", "took 5 μsec", "GROẞE", "ǅep", "ᾈδη"];
    for (const [i, text] of texts.entries())
      await host.messages.insertAsync(new Message(`m${i + 1}`, chat.id, i, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, text, null, "t1")], null, "t1", null, "t1"));
    const found = async (query: string): Promise<string> => (await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 10))).hits.map(t => t.messageId).join(",");

    Assert.areEqual(JSON.stringify(["m1", "m1", "m1", "m1", "m2", "m2", "m2", "m2", "m3", "m3", "m4", "m4", "m5"]),
      JSON.stringify(await Promise.all(["Σ", "ΟΣ", "ΓΟΣ", "ΌΓΟΣ", "µ", "µs", "µse", "µsec", "ß", "ße", "ǆ", "ǆe", "ᾀ"].map(found))));
  }

  @TestMethod
  public async centersTheSnippetOnTheMatchWhateverItsCaseOrSpacing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Seasons");
    const text = "İstanbul opens the long first sentence, which pushes the match past the lead. Été  arrives with  the heat, and the terminal stays open all afternoon "
      + "while the build runs and the tests settle into green at last.";
    await host.messages.insertAsync(new Message("m1", chat.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, text, null, "t1")], null,
      "t1", null, "t1"));
    const snippet = async (query: string): Promise<string | undefined> => (await host.conversations.searchMessagesAsync(new ConversationSearchParams(query, 10))).hits[0]?.snippet;

    Assert.areEqual(JSON.stringify(["…, which pushes the match past the lead. Été arrives with the heat, and the terminal stays open all afternoon while the b…",
      "…es the match past the lead. Été arrives with the heat, and the terminal stays open all afternoon while the build runs an…"]),
      JSON.stringify([await snippet("été"), await snippet("with  the")]));
  }

  @TestMethod
  public async givesEachChatWhoseSettingsNameNoProviderTheProviderFoundForTheirKindAndKeepsEveryOtherChoice(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Reviews", provider.id, Harness.Provider, null, null));
    const settings = (kind: string): RequestedSettings => new RequestedSettings(kind, "m1", null);
    const chats: Conversation[] = [];
    for (const title of ["None", "Other", "Named", "Teammate", "Unchosen"])
      chats.push(await host.createConversationAsync(project, title));
    const [none, other, named, teammate, unchosen] = chats;
    await host.conversations.setResponderAsync(new ConversationResponderParams(none!.id, new ConversationResponder(null, settings("fake"))));
    await host.conversations.setResponderAsync(new ConversationResponderParams(other!.id, new ConversationResponder(null, settings("other"))));
    await host.conversations.setResponderAsync(new ConversationResponderParams(named!.id, new ConversationResponder(null, settings("fake"), provider.id)));
    await host.conversations.setResponderAsync(new ConversationResponderParams(teammate!.id, new ConversationResponder(bob.id)));
    const updatedAt = (await host.conversations.findAsync(none!.id))!.updatedAt;
    const logged = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    const responder = async (id: string): Promise<string> => {
      const chosen = (await host.conversations.findAsync(id))?.responder ?? null;
      return Object.isNull(chosen) ? "none" : `${chosen.teammateId} ${chosen.requested?.kind} ${chosen.requested?.model} ${chosen.providerId}`;
    };

    const moved = await host.conversations.moveProviderlessAsync(kind => kind === "fake" ? provider.id : null);

    Assert.areEqual(none!.id, moved.map(t => t.id).join(","));
    Assert.areEqual([`null fake m1 ${provider.id}`, "null other m1 null", `null fake m1 ${provider.id}`, `${bob.id} undefined undefined null`, "none"].join(","),
      (await Promise.all([none!.id, other!.id, named!.id, teammate!.id, unchosen!.id].map(responder))).join(","));
    Assert.areEqual(updatedAt, (await host.conversations.findAsync(none!.id))?.updatedAt);
    Assert.areEqual(`${ChangeEntity.Chat} ${none!.id} ${ChangeOperation.Update}`,
      (await host.context.database.changeFeed.readAfterAsync(0)).slice(logged).map(t => `${t.entity} ${t.entityId} ${t.operation}`).join(","));
    Assert.areEqual(0, (await host.conversations.moveProviderlessAsync(kind => kind === "fake" ? provider.id : null)).length);
  }
}
