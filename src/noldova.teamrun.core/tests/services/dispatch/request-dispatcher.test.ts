/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppLook, ApprovalAsk, type IAcpAgentsService, type ITurnListener, PlanReading, ProfileSearch, RememberedAppGrant, RequestDispatcher, Resources, SharedMcpAccess, SignInCheck, TaskEnd, TaskStart, TurnDetail }
  from "@noldova/teamrun.core";
import { AcpAgentIdParams, AcpAgentListing, AcpLocalCommandAddParams, ComputerUseGrant, ComputerUseGrantIdParams, ProviderContextWindows, ProviderSignInCommand,
  type ITeammateChanges, TeammateFallback } from "@noldova/teamrun.protocol";
import { ConversationPosition, ObservedSettings, PanelAnsweredParams, PanelName, PanelOutcome, PanelRequestedPayload, PlanUsage, PlanUsageParams, PlanWindow,
  PlanWindowName, Provenance, ReadingPositionSaveParams, ReplyUsage, RunOutput, TeammateLastReply, TeammateUsage, WindowFocusedParams, WindowIdParams } from "@noldova/teamrun.protocol";
import { SharedMcpProviderSetParams, SharedMcpSecretSetParams, SharedMcpServer, SharedMcpServerDefinition, SharedMcpServerIdParams, SharedMcpServerListing,
  SharedMcpServerUpdateParams, SharedMcpSetting, SharedMcpSignInStarted, SharedMcpTeammateSetParams, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { SqlQuery } from "@noldova/context.data.sql";
import { MessageDelivery, WaitingMessage, WaitingMessageAddParams, WaitingMessageEditParams, WaitingMessageIdParams, WaitingMessagesPayload }
  from "@noldova/teamrun.protocol";
import { ChatMemberModeParams, ChatMemberSettings, ChatMemberSettingsParams, ChatPlanFirstParams, ConversationMember, ConversationMemberParams, EventName, Harness,
  Teammate, TeammateCreateParams, TeammateUpdateParams, TeammateIdParams, DefaultTeammate, DefaultTeammateSetParams, ProjectsLayoutSaveParams,
  ComposerDefaultSaveParams } from "@noldova/teamrun.protocol";
import { Department, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, Organization }
  from "@noldova/teamrun.protocol";
import { OrganizationMessage, OrganizationMessageSendParams, OrganizationTarget } from "@noldova/teamrun.protocol";
import { SenderEnvironment, SubAgent, SubAgentStartParams, SubAgentStatus, SubAgentStopParams, SubAgentWaitParams, SubAgentWaitResult } from "@noldova/teamrun.protocol";
import {
  AttachmentContent,
  AttachmentInput,
  AttachmentReadParams,
  LinkedPaths,
  MessageAttachment,
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  ApprovalStatus,
  AuthStatus,
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskPage,
  BackgroundTasksClearedPayload,
  BackgroundTaskStatus,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  DataFolder,
  Draft,
  DraftDiscardParams,
  DraftSaveParams,
  ConversationRenameParams,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationSearchParams,
  ConversationSearchResult,
  ChatFindParams,
  ChatFindResult,
  MessageSearchResult,
  ErrorCode,
  Message,
  MessageDetailsAfterParams,
  MessageIdParams,
  MessageListParams,
  ReplyPage,
  ReplySummary,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  MessageSendResult,
  MethodName,
  Project,
  ProjectIdParams,
  ProjectOpenParams,
  Provider,
  ProviderCreateParams,
  ProviderIdParams,
  ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  ProviderSignIns,
  ProviderEnabledParams,
  ProviderUpdateParams,
  ProviderKind,
  ProviderKindParams,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderModelList,
  ProviderListModelsParams,
  ProviderTool,
  FirstLaunch,
  Request,
  RequestedSettings,
  type Response
} from "@noldova/teamrun.protocol";

import { DetailKind, MessageAuthor, MessageDetail, MessageStatus, ReplyPlan, WrittenImageReader, WrittenImageReadParams } from "@noldova/teamrun.protocol";
import { OwnMcpServer, OwnMcpServerState } from "@noldova/teamrun.protocol";
import { BoundingWork } from "../../fixtures/bounding-work.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeProviderKindInstallation } from "../../fixtures/fake-provider-kind-installation.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class RequestDispatcherTests {
  @TestMethod
  public async routesAProvidersOwnMcpServerListing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.listOwnMcpServers = () => Promise.resolve([new OwnMcpServer("docs", OwnMcpServerState.Configured)]);
    const provider = await host.createProviderAsync();

    const listed = await RequestDispatcherTests.succeed(host, MethodName.ProviderOwnMcpServerList, new ProviderIdParams(provider.id).toJson());

    Assert.areEqual(JSON.stringify({ providerId: provider.id, servers: [{ name: "docs", state: "Configured" }] }), JSON.stringify(listed));
  }

  @TestMethod
  public async knowsNoMcpToolMethodsSinceTeammatesReachTheToolsOnlyAtTheEndpoint(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, new FakeTurnToolSessions());

    const listed = await host.dispatcher.dispatch(new Request("list", "McpToolList", { token: "member" }));
    const called = await host.dispatcher.dispatch(new Request("call", "McpToolCall", { token: "member", name: "teamrun_list_chats", arguments: {} }));

    Assert.areEqual(JSON.stringify([ErrorCode.UnknownMethod, "McpToolList", ErrorCode.UnknownMethod, "McpToolCall"]),
      JSON.stringify([listed.info?.name, listed.info?.arguments[0], called.info?.name, called.info?.arguments[0]]));
  }

  @TestMethod
  public async routesTeammateAndMembershipOperationsAndInvalidatesOnlyMutations(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const conversation = await host.createConversationAsync();
    const created = Teammate.fromJson(await RequestDispatcherTests.succeed(host, MethodName.TeammateCreate,
      new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null).toJson()));
    const changed = Teammate.fromJson(await RequestDispatcherTests.succeed(host, MethodName.TeammateUpdate,
      new TeammateUpdateParams(created.id, "Bob", null, provider.id, Harness.Provider, null, null).toJson()));
    Assert.areEqual("Bob", changed.name);
    const misspelt = await host.dispatcher.dispatch(new Request("r1", MethodName.TeammateUpdate, { teammateId: created.id, nmae: "Carol" }));
    const empty = await host.dispatcher.dispatch(new Request("r2", MethodName.TeammateUpdate, { teammateId: created.id }));
    Assert.areEqual(JSON.stringify([[ErrorCode.InvalidParams, "nmae"], [ErrorCode.InvalidParams, "teammateId"], "Bob"]),
      JSON.stringify([[misspelt.info?.name, misspelt.info?.arguments[0]], [empty.info?.name, empty.info?.arguments[0]], (await host.teammates.findAsync(created.id))?.name]));
    Assert.areEqual(1, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.TeammateList, null)).length);
    const params = new ConversationMemberParams(conversation.id, created.id).toJson();
    const member = ConversationMember.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationAddMember, params));
    Assert.areEqual(created.id, member.teammateId);
    Assert.areEqual(1, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ConversationListMembers,
      new ConversationIdParams(conversation.id).toJson())).length);
    Assert.areEqual("plan", ConversationMember.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationSetMemberMode,
      new ChatMemberModeParams(conversation.id, created.id, "plan").toJson())).mode);
    Assert.areEqual("plan", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, created.id)))?.mode);
    Assert.areEqual("high", ConversationMember.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationSetMemberSettings,
      new ChatMemberSettingsParams(conversation.id, created.id, new ChatMemberSettings(null, "high")).toJson())).settings?.effort);
    Assert.areEqual("high", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, created.id)))?.settings?.effort);
    Assert.isTrue(Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationSetPlanFirst,
      new ChatPlanFirstParams(conversation.id, true).toJson())).planFirst);
    Assert.isTrue((await host.conversations.findAsync(conversation.id))!.planFirst);
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ConversationRemoveMember, params));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(created.id).toJson()));
    Assert.areEqual(8, host.listener.count(EventName.StateInvalidated));
    const invalid = await host.dispatcher.dispatch(new Request("bad", MethodName.TeammateCreate,
      { name: "bad  name", providerId: provider.id, harness: "provider", role: null, model: null, effort: null }));
    Assert.isTrue(invalid.hasErrors);
    Assert.areEqual(8, host.listener.count(EventName.StateInvalidated));
  }

  @TestMethod
  public async routesOrganizationMethodsAndPublishesTheWholeOrganizationAfterEachChangeWithoutInvalidatingTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const changes = (): readonly Organization[] => host.listener.events.filter(t => t.name === EventName.OrganizationChanged).map(t => Organization.fromJson(t.payload));

    const design = Department.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DepartmentCreate, new DepartmentCreateParams("Design", null).toJson()));
    const web = Department.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DepartmentCreate, new DepartmentCreateParams("Web", null).toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.DepartmentMemberSet, new DepartmentMemberSetParams(ada.id, design.id).toJson()));
    const led = Department.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DepartmentUpdate,
      new DepartmentUpdateParams(design.id, "Product", ada.id).toJson()));
    const moved = Department.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DepartmentMove, new DepartmentMoveParams(web.id, design.id, 0).toJson()));
    const listed = Organization.fromJson(await RequestDispatcherTests.succeed(host, MethodName.OrganizationList, null));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.DepartmentDelete, new DepartmentIdParams(web.id).toJson()));
    const refused = await host.dispatcher.dispatch(new Request("r", MethodName.DepartmentUpdate, new DepartmentUpdateParams(design.id, undefined, bob.id).toJson()));

    Assert.areEqual(`Product,${ada.id},${design.id}`, `${led.name},${led.leaderId},${moved.parentId}`);
    Assert.areEqual(JSON.stringify(listed.toJson()), JSON.stringify(changes()[4]?.toJson()));
    Assert.areEqual(6, changes().length);
    Assert.areEqual(1, changes().at(-1)?.departments.length);
    Assert.areEqual(ErrorCode.InvalidParams, refused.info?.name);
    Assert.areEqual(0, host.listener.count(EventName.StateInvalidated));
  }

  @TestMethod
  public async publishesTheOrganizationWhenADeletedTeammateLeavesItsDepartmentAndKnowsNoOrganizationMethodWithoutIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const design = await host.organization.createAsync(new DepartmentCreateParams("Design", null));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, design.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, ada.id));

    await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(bob.id).toJson());
    const outside = host.listener.count(EventName.OrganizationChanged);
    await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(ada.id).toJson());
    const published = host.listener.events.filter(t => t.name === EventName.OrganizationChanged).map(t => Organization.fromJson(t.payload));
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unknown = await without.dispatch(new Request("r", MethodName.OrganizationList, null));
    const carol = await host.teammates.createAsync(new TeammateCreateParams("Carol", null, provider.id, Harness.Provider, null, null));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(carol.id, design.id));
    const deleted = await without.dispatch(new Request("r", MethodName.TeammateDelete, new TeammateIdParams(carol.id).toJson()));

    Assert.areEqual(0, outside);
    Assert.areEqual(1, published.length);
    Assert.isNull(published[0]?.departments[0]?.leaderId);
    Assert.areEqual(0, published[0]?.members.length);
    Assert.areEqual(ErrorCode.UnknownMethod, unknown.info?.name);
    Assert.isFalse(deleted.hasErrors);
    Assert.areEqual(1, host.listener.count(EventName.OrganizationChanged));
  }

  @TestMethod
  public async sendsStopsAndListsOrganizationMessagesAndKnowsNoneOfTheirMethodsWithoutThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));

    const sent = OrganizationMessage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.OrganizationMessageSend,
      new OrganizationMessageSendParams(OrganizationTarget.teammate(ada.id), "Hi").toJson()));
    await host.engine.waitForIdle();
    const stopped = OrganizationMessage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.OrganizationMessageStop, new MessageIdParams(sent.id).toJson()));
    const listed = await RequestDispatcherTests.succeed(host, MethodName.OrganizationMessageList, null);
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unknown = await Promise.all([MethodName.OrganizationMessageSend, MethodName.OrganizationMessageStop, MethodName.OrganizationMessageList]
      .map(t => without.dispatch(new Request("r", t, null))));

    Assert.areEqual(`${ada.id}:Started`, sent.recipients.map(t => `${t.teammateId}:${t.state}`).join());
    Assert.areEqual(JSON.stringify(sent.toJson()), JSON.stringify(stopped.toJson()));
    Assert.areEqual(JSON.stringify([stopped.toJson()]), JSON.stringify(listed));
    Assert.areEqual("UnknownMethod,UnknownMethod,UnknownMethod", unknown.map(t => t.info?.name).join());
  }

  @TestMethod
  public async createsATeammateWithAContextWindowOnlyWhenItsModelOffersThatSizeAndNamesTheBoundsOtherwise(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.contextWindows = { "fake-small": new ProviderContextWindows([200_000], 100_000, 200_000, true) };
    const create = async (name: string, model: string | null, window: number | null, providerId: string = provider.id): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateCreate,
        JsonReader.toJsonValue(new TeammateCreateParams(name, null, providerId, Harness.Provider, model, null, null, null, window).toJson()))));
    const outcomes = [await create("Ada", "fake-small", 100_000), await create("Bo", null, 200_000), await create("Cy", "fake-large", null),
      await create("Di", "fake-small", 99_999), await create("Ed", "fake-small", 200_001), await create("Flo", "fake-large", 200_000),
      await create("Gus", "unlisted", 200_000), await create("Hal", "fake-small", 100_000, "missing")];

    Assert.areEqual(["ok", "ok", "ok", `${ErrorCode.InvalidParams} contextWindow ${Resources.formatContextWindowOutOfBounds(99_999, "100K", "200K")}`,
      `${ErrorCode.InvalidParams} contextWindow ${Resources.formatContextWindowOutOfBounds(200_001, "100K", "200K")}`,
      `${ErrorCode.InvalidParams} contextWindow ${Resources.contextWindowUnavailable}`, `${ErrorCode.InvalidParams} contextWindow ${Resources.contextWindowUnavailable}`,
      `${ErrorCode.NotFound} missing ${Resources.formatProviderNotFound("missing")}`].join("|"), outcomes.join("|"));
    Assert.areEqual("Ada 100000,Bo 200000,Cy null", (await host.teammates.listAsync()).map(t => `${t.name} ${String(t.contextWindow)}`).join(","));
  }

  @TestMethod
  public async createsATeammateWithSustainEntriesOnlyWhenEachIsAnAccountWhoseLimitsAreReadAndNamesTheEntryOtherwise(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("limited", false, false, null, null, false, null, false, true));
    const unread = await host.createProviderAsync("fake", "Unread");
    const work = await host.createProviderAsync("limited", "Work");
    const personal = await host.createProviderAsync("limited", "Personal");
    const off = await host.createProviderAsync("limited", "Off");
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    host.registry.register(new FakeProviderAdapter("gone", false, false, null, null, false, null, false, true));
    const gone = await host.createProviderAsync("gone", "Gone");
    host.registry.unregister("gone");
    const create = async (name: string, providerId: string, sustain: boolean, ...fallbacks: TeammateFallback[]): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateCreate, JsonReader.toJsonValue(new TeammateCreateParams(name,
        null, providerId, Harness.Provider, "fake-small", "high", null, null, null, [], sustain, fallbacks).toJson()))));
    const outcomes = [await create("Ada", work.id, true, new TeammateFallback(personal.id, "fake-large"), new TeammateFallback(work.id, "fake-small")),
      await create("Bo", unread.id, true), await create("Cy", unread.id, false, new TeammateFallback(work.id)), await create("Di", work.id, false,
        new TeammateFallback("missing")), await create("Ed", work.id, false, new TeammateFallback(unread.id)), await create("Flo", work.id, false,
        new TeammateFallback(work.id, "fake-small", "high")), await create("Gus", work.id, false, new TeammateFallback(personal.id), new TeammateFallback(personal.id)),
      await create("Hal", work.id, false, new TeammateFallback(personal.id, "unlisted")), await create("Ivy", work.id, false, new TeammateFallback(off.id, "unlisted")),
      await create("Jo", work.id, false, new TeammateFallback(gone.id))];

    Assert.areEqual(["ok", `${ErrorCode.InvalidParams} sustain ${Resources.formatSustainLimitsUnread("Fake provider")}`, "ok",
      `${ErrorCode.NotFound} fallbacks ${Resources.sustainEntryProviderMissing}`,
      `${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryLimitsUnread(2, "Fake provider")}`,
      `${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryRepeated(2, 1, "Fake provider · Work", "fake-small", null, "high")}`,
      `${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryRepeated(3, 2, "Fake provider · Personal", null, null, null)}`,
      `${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryModelUnlisted("unlisted", "Fake provider")}`, "ok",
      `${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryLimitsUnread(2, "gone")}`].join("|"), outcomes.join("|"));
    Assert.areEqual("Ada true 2,Cy false 1,Ivy false 1", (await host.teammates.listAsync()).map(t => `${t.name} ${String(t.sustain)} ${t.fallbacks.length}`).join(","));
  }

  @TestMethod
  public async refusesHandOffsForATeammateWhoseOwnProviderLimitsArentReadOnCreateAndUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("limited", false, false, null, null, false, null, false, true));
    const unread = await host.createProviderAsync("fake", "Unread");
    const work = await host.createProviderAsync("limited", "Work");
    const bo = await host.teammates.createAsync(new TeammateCreateParams("Bo", null, work.id, Harness.Provider, "fake-small", "high", null, null, null, [], false, []));
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, work.id, Harness.Provider, "fake-small", "high", null, null, null, [bo.id], false, []));
    const create = async (name: string, providerId: string): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateCreate, JsonReader.toJsonValue(new TeammateCreateParams(name,
        null, providerId, Harness.Provider, "fake-small", "high", null, null, null, [bo.id], false, []).toJson()))));
    const update = async (changes: ITeammateChanges): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateUpdate,
        JsonReader.toJsonValue(TeammateUpdateParams.of(ada.id, changes, (await host.teammates.findAsync(ada.id))?.providerId).toJson()))));
    const outcomes = [await create("Cy", unread.id), await create("Di", work.id), await update({ providerId: unread.id, model: null }),
      await update({ providerId: unread.id, model: null, usageHandOffs: [] })];

    Assert.areEqual([`${ErrorCode.InvalidParams} usageHandOffs ${Resources.formatSustainLimitsUnread("Fake provider")}`, "ok",
      `${ErrorCode.InvalidParams} usageHandOffs ${Resources.formatSustainLimitsUnread("Fake provider")}`, "ok"].join("|"), outcomes.join("|"));
    Assert.areEqual(`${unread.id} 0`, `${(await host.teammates.findAsync(ada.id))?.providerId} ${(await host.teammates.findAsync(ada.id))?.usageHandOffs.length}`);
  }

  @TestMethod
  public async checksAnUpdatedTeammatesSustainEntriesAgainstItsOwnChoiceAndRefusesAMoveToAnAccountWhoseLimitsArentReadWhileSustainIsOn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("limited", false, false, null, null, false, null, false, true));
    const unread = await host.createProviderAsync("fake", "Unread");
    const work = await host.createProviderAsync("limited", "Work");
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, work.id, Harness.Provider, "fake-small", "high", null, null, null, [], true,
      [new TeammateFallback(work.id, "fake-small", "low")]));
    const update = async (changes: ITeammateChanges): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateUpdate,
        JsonReader.toJsonValue(TeammateUpdateParams.of(ada.id, changes, (await host.teammates.findAsync(ada.id))?.providerId).toJson()))));
    const outcomes = [await update({ effort: "low" }), await update({ providerId: unread.id, model: null }), await update({ name: "Bo" }),
      await update({ sustain: false, providerId: unread.id, model: null }), await update({ sustain: true })];

    Assert.areEqual([`${ErrorCode.InvalidParams} fallbacks ${Resources.formatSustainEntryRepeated(2, 1, "Fake provider · Work", "fake-small", null, "low")}`,
      `${ErrorCode.InvalidParams} sustain ${Resources.formatSustainLimitsUnread("Fake provider")}`, "ok", "ok",
      `${ErrorCode.InvalidParams} sustain ${Resources.formatSustainLimitsUnread("Fake provider")}`].join("|"), outcomes.join("|"));
    Assert.areEqual(`Bo ${unread.id} false 1`, [(await host.teammates.findAsync(ada.id))?.name, (await host.teammates.findAsync(ada.id))?.providerId, String((await host.teammates.findAsync(ada.id))?.sustain),
      (await host.teammates.findAsync(ada.id))?.fallbacks.length].join(" "));
  }

  @TestMethod
  public async checksAnUpdatedTeammatesContextWindowAgainstTheModelItWillRunOnlyWhenTheUpdateChangesEither(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.contextWindows = { "fake-small": new ProviderContextWindows([200_000], 100_000, 200_000, true), "fake-large": new ProviderContextWindows([], 100_000, 150_000, true) };
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, null, null, 200_000));
    const update = async (model: string | null | undefined, window: number | null | undefined, name?: string, teammateId: string = ada.id): Promise<string> =>
      RequestDispatcherTests.outcome(await host.dispatcher.dispatch(new Request("r", MethodName.TeammateUpdate,
        JsonReader.toJsonValue(new TeammateUpdateParams(teammateId, name, undefined, undefined, undefined, model, undefined, undefined, undefined,
          Object.isUndefined(model) && Object.isUndefined(window) ? undefined : provider.id, window).toJson()))));
    const read = host.adapter.refreshes.length;
    const renamed = await update(undefined, undefined, "Bo");
    const unread = host.adapter.refreshes.length === read;
    const outcomes = [renamed, await update(undefined, 200_001), await update("fake-large", undefined), await update("fake-large", 150_000), await update(undefined, null),
      await update(undefined, 100_000, undefined, "missing")];

    Assert.isTrue(unread);
    Assert.areEqual(["ok", `${ErrorCode.InvalidParams} contextWindow ${Resources.formatContextWindowOutOfBounds(200_001, "100K", "200K")}`,
      `${ErrorCode.InvalidParams} contextWindow ${Resources.formatContextWindowOutOfBounds(200_000, "100K", "150K")}`, "ok", "ok",
      `${ErrorCode.NotFound} missing ${Resources.formatTeammateNotFound("missing")}`].join("|"), outcomes.join("|"));
    Assert.areEqual("Bo fake-large null", [(await host.teammates.findAsync(ada.id))?.name, (await host.teammates.findAsync(ada.id))?.model, String((await host.teammates.findAsync(ada.id))?.contextWindow)].join(" "));
  }

  @TestMethod
  public async refusesAnUpdateWhoseTeammateMovedToAnotherModelOrWindowWhileItsContextWindowWasChecked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.contextWindows = { "fake-small": new ProviderContextWindows([200_000], 100_000, 200_000, true), "fake-large": new ProviderContextWindows([], 100_000, 150_000, true) };
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, null, null, null));
    const update = (model: string | undefined, window: number | undefined): Promise<string> =>
      host.dispatcher.dispatch(new Request("r", MethodName.TeammateUpdate, JsonReader.toJsonValue(new TeammateUpdateParams(ada.id, undefined, undefined,
        undefined, undefined, model, undefined, undefined, undefined, provider.id, window).toJson()))).then(t => RequestDispatcherTests.outcome(t));
    const race = async (window: number, other: () => Promise<string>): Promise<string> => {
      const check = Promise.withResolvers<void>();
      const read = host.adapter.refreshes.length;
      host.adapter.listModelsHold = check.promise;
      const held = update(undefined, window);
      await host.until("the model list refresh", () => host.adapter.refreshes.length > read, new BoundingWork("the update", held));
      host.adapter.listModelsHold = null;
      const first = await other();
      check.resolve();
      return `${first} ${await held}`;
    };
    const outcomes = [await race(200_000, () => update("fake-large", undefined)), await race(150_000, () => update(undefined, 100_000))];

    Assert.areEqual([`ok ${ErrorCode.Conflict} ${ada.id} ${Resources.formatTeammateChangedWhileChecked("Ada")}`,
      `ok ${ErrorCode.Conflict} ${ada.id} ${Resources.formatTeammateChangedWhileChecked("Ada")}`].join("|"), outcomes.join("|"));
    Assert.areEqual("fake-large 100000", [(await host.teammates.findAsync(ada.id))?.model, String((await host.teammates.findAsync(ada.id))?.contextWindow)].join(" "));
  }

  @TestMethod
  public async readsSetsAndClearsTheDefaultTeammateAndInvalidatesOnEachSet(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const chosen = new DefaultTeammate(new RequestedSettings("fake", "fake-b", null), provider.id);

    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.DefaultTeammateRead, null));
    Assert.areEqual(JSON.stringify(chosen.toJson()), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.DefaultTeammateSet,
      new DefaultTeammateSetParams(chosen).toJson())));
    Assert.areEqual(JSON.stringify(chosen.toJson()), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.DefaultTeammateRead, null)));
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.DefaultTeammateSet, new DefaultTeammateSetParams(null).toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.DefaultTeammateRead, null));
    Assert.areEqual(2, host.listener.count(EventName.StateInvalidated));
    Assert.isTrue((await host.dispatcher.dispatch(new Request("bad", MethodName.DefaultTeammateSet, { defaultTeammate: { providerId: null } }))).hasErrors);
  }

  @TestMethod
  public async readsAndSavesTheProjectsLayoutAndTellsEveryWindowWithoutInvalidatingTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const layout = { pinnedChats: ["c1"], projectOrder: ["p2", "p1"] };

    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ProjectsLayoutRead, null));
    Assert.areEqual(JSON.stringify(layout), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ProjectsLayoutSave,
      new ProjectsLayoutSaveParams(layout).toJson())));
    Assert.areEqual(JSON.stringify(layout), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ProjectsLayoutRead, null)));
    Assert.areEqual(JSON.stringify([layout]), JSON.stringify(host.listener.events.filter(t => t.name === EventName.ProjectsLayoutUpdated).map(t => t.payload)));
    Assert.areEqual(0, host.listener.count(EventName.StateInvalidated));

    Assert.isTrue((await host.dispatcher.dispatch(new Request("bad", MethodName.ProjectsLayoutSave, { layout: ["c1"] }))).hasErrors);
    Assert.areEqual(1, host.listener.count(EventName.ProjectsLayoutUpdated));
    Assert.areEqual(JSON.stringify(layout), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ProjectsLayoutRead, null)));
  }

  @TestMethod
  public async readsAndSavesTheComposerDefaultAndTellsEveryWindowWithoutInvalidatingTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const choice = { kind: "codex", model: "gpt-5", effort: "high", providerId: "a1", responderTeammateId: null };

    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ComposerDefaultRead, null));
    Assert.areEqual(JSON.stringify(choice), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ComposerDefaultSave,
      new ComposerDefaultSaveParams(choice).toJson())));
    Assert.areEqual(JSON.stringify(choice), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ComposerDefaultRead, null)));
    Assert.areEqual(JSON.stringify([choice]), JSON.stringify(host.listener.events.filter(t => t.name === EventName.ComposerDefaultUpdated).map(t => t.payload)));
    Assert.areEqual(0, host.listener.count(EventName.StateInvalidated));

    Assert.isTrue((await host.dispatcher.dispatch(new Request("bad", MethodName.ComposerDefaultSave, { choice: "codex" }))).hasErrors);
    Assert.areEqual(1, host.listener.count(EventName.ComposerDefaultUpdated));
    Assert.areEqual(JSON.stringify(choice), JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ComposerDefaultRead, null)));
  }

  @TestMethod
  public async returnsModelMetadataWhileKeepingTheNamesOnlyEndpoint(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const params = new ProviderListModelsParams("fake", null).toJson();
    const response = await host.dispatcher.dispatch(new Request("catalog", MethodName.ProviderModelCatalog, params));
    const catalog = ProviderModelList.fromJson(response.payload);
    Assert.areEqual("fake-small,fake-large", catalog.models.map(t => t.id).join(","));
    Assert.areEqual("medium,high", catalog.models[0]?.effortLevels?.join(","));
    Assert.areEqual(true, catalog.signedIn);
    host.adapter.signedIn = false;
    const signedOut = await host.dispatcher.dispatch(new Request("signed-out", MethodName.ProviderModelCatalog, params));
    Assert.areEqual(false, ProviderModelList.fromJson(signedOut.payload).signedIn);
    const names = await host.dispatcher.dispatch(new Request("names", MethodName.ProviderListModels, params));
    Assert.areEqual('["fake-small","fake-large"]', JSON.stringify(names.payload));
  }
  @TestMethod
  public async listsInstallsAndCancelsAProvidersInstallation(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = new FakeProviderAdapter("agy");
    const installation = new FakeProviderKindInstallation();
    adapter.installation = installation;
    host.registry.register(adapter);
    const params = new ProviderKindParams("agy").toJson();

    const listed = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ProviderKindInstallationList, null));
    const installing = RequestDispatcherTests.succeed(host, MethodName.ProviderKindInstall, params);
    await host.until("the install", () => installation.installs === 1, new BoundingWork("the install request", installing));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ProviderKindInstallCancel, params));

    Assert.areEqual(ProviderKindInstallState.NotInstalled, ProviderKindInstallation.fromJson(listed[0]?.toJson()).state);
    Assert.areEqual(ProviderKindInstallState.NotInstalled, ProviderKindInstallation.fromJson(await installing).state);
    Assert.isTrue(installation.signal!.aborted);
  }

  @TestMethod
  public async readsAndFinishesTheFirstLaunch(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const before = FirstLaunch.fromJson(await RequestDispatcherTests.succeed(host, MethodName.FirstLaunchRead, null));
    const finished = FirstLaunch.fromJson(await RequestDispatcherTests.succeed(host, MethodName.FirstLaunchFinish, null));
    const after = FirstLaunch.fromJson(await RequestDispatcherTests.succeed(host, MethodName.FirstLaunchRead, null));

    Assert.isFalse(before.isFinished);
    Assert.isTrue(finished.isFinished);
    Assert.areEqual(finished.finishedAt, after.finishedAt);
  }

  @TestMethod
  public async listsEachKindsToolAsFound(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = new FakeProviderAdapter("grok");
    const tool = new ProviderTool("grok", false, null, "curl -fsSL https://x.ai/cli/install.sh | bash");
    host.registry.register(adapter, { check: (): Promise<ProviderTool> => Promise.resolve(tool) });

    const listed = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ProviderToolList, null));

    Assert.areEqual(JSON.stringify([tool.toJson()]), JSON.stringify(listed.map(t => ProviderTool.fromJson(t.toJson()).toJson())));
  }

  @TestMethod
  public async answersEveryMethodOfTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "commandExecution", "Run", null, [new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once)]);

    const kinds = await RequestDispatcherTests.succeed(host, MethodName.ProviderKindList, null);
    const prepared = MessageAttachment.fromJson(await RequestDispatcherTests.succeed(host, MethodName.AttachmentPrepare,
      new AttachmentInput("notes.txt", "text/plain", "YQ==", null).toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.AttachmentDiscard, prepared.toJson()));
    const models = await RequestDispatcherTests.succeed(host, MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson());
    const provider = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderCreate, new ProviderCreateParams("fake", "Work", join(host.directory.path, "p")).toJson()));
    const checked = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderCheck, new ProviderIdParams(provider.id).toJson()));
    const providers = await RequestDispatcherTests.succeed(host, MethodName.ProviderList, null);
    mkdirSync(join(host.directory.path, "alpha"));
    const project = Project.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProjectOpen, new ProjectOpenParams(join(host.directory.path, "alpha")).toJson()));
    const projects = await RequestDispatcherTests.succeed(host, MethodName.ProjectList, null);
    const conversation = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationCreate, new ConversationCreateParams(project.id, "Chat").toJson()));
    const empty = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ConversationListEmpty, new ProjectIdParams(project.id).toJson()));
    Assert.areEqual(conversation.id, Conversation.fromJson(empty[0]?.toJson()).id);
    const renamed = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationRename, new ConversationRenameParams(conversation.id, "Renamed").toJson()));
    const touched = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationTouch, new ConversationIdParams(conversation.id).toJson()));
    Assert.areEqual(renamed.title, touched.title);
    const cleared = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationResponderSet,
      new ConversationResponderParams(conversation.id, null).toJson()));
    Assert.areEqual([touched.updatedAt, "null"].join(","), [cleared.updatedAt, String(cleared.responder)].join(","));
    const moveParams = new ConversationMoveParams(conversation.id, project.id);
    const moved = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationMove, moveParams.toJson()));
    Assert.areEqual(project.id, moved.projectId);
    const conversations = await RequestDispatcherTests.succeed(host, MethodName.ConversationList, new ProjectIdParams(project.id).toJson());
    Assert.areEqual(0, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ConversationListEmpty, new ProjectIdParams(project.id).toJson())).length);
    const sendParams = new MessageSendParams(conversation.id, "Hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
    const sent = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSend, sendParams.toJson()));
    const pageParams = new MessagePageParams(conversation.id, null, null, 1);
    const page = MessagePage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessagePage, pageParams.toJson()));
    Assert.areEqual(1, page.messages.length);
    Assert.isTrue(page.hasEarlier);
    Assert.areEqual(0, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ConversationListEmpty, new ProjectIdParams(project.id).toJson())).length);
    await host.until("the approval", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1, host.runs());
    const open = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.MessageListOpen, null));
    const pending = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ApprovalListPending, null));
    Assert.areEqual(sent.replies[0]!.id, Message.fromJson(open[0]?.toJson()).id);
    Assert.areEqual(1, pending.length);
    const approvals = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ApprovalList, new ConversationIdParams(conversation.id).toJson()));
    const decided = Approval.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ApprovalDecide, new ApprovalDecideParams(Approval.fromJson(approvals[0]?.toJson()).id, "accept").toJson()));
    await host.engine.waitForIdle();
    const activityPage = ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageActivityPage, pageParams.toJson()));
    const changesPage = ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageChangesPage, pageParams.toJson()));
    Assert.isTrue(activityPage.replies.length <= 1);
    Assert.isTrue(changesPage.replies.length <= 1);
    Assert.areEqual(0, ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessagePlanPage, pageParams.toJson())).replies.length);
    Assert.areEqual(0, ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSubAgentsPage, pageParams.toJson())).replies.length);
    const summary = ReplySummary.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSummary,
      new MessageIdParams(sent.replies[0]!.id).toJson()));
    const details = Message.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageDetails, new MessageIdParams(sent.replies[0]!.id).toJson()));
    Assert.areEqual(sent.replies[0]!.id, summary.preview.id);
    Assert.areEqual(sent.replies[0]!.id, details.id);
    Assert.isFalse(details.details.some(t => t.kind === "Text"));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.MessageSummary, new MessageIdParams("missing").toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.MessageDetails, new MessageIdParams("missing").toJson()));
    const messages = await RequestDispatcherTests.succeed(host, MethodName.MessageList, new MessageListParams(conversation.id, null).toJson());
    const found = ConversationSearchResult.fromJson(
      await RequestDispatcherTests.succeed(host, MethodName.ConversationSearch, new ConversationSearchParams(renamed.title, 5).toJson()));
    Assert.areEqual(conversation.id, found.hits[0]?.conversationId);
    const chats = ChatFindResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ChatFind, new ChatFindParams(renamed.title, 5).toJson()));
    const messagesFound = MessageSearchResult.fromJson(
      await RequestDispatcherTests.succeed(host, MethodName.MessageSearch, new ConversationSearchParams("zzz-none", 5).toJson()));
    Assert.areEqual(`${conversation.id}:0`, `${chats.hits[0]?.chatId}:${messagesFound.total}`);
    const rewound = ConversationRewindResult.fromJson(
      await RequestDispatcherTests.succeed(host, MethodName.ConversationRewind, new ConversationRewindParams(conversation.id, sent.sent.id, false).toJson()));
    const deleted = await RequestDispatcherTests.succeed(host, MethodName.ConversationDelete, new ConversationIdParams(conversation.id).toJson());
    const forgotten = await RequestDispatcherTests.succeed(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());
    const removed = await RequestDispatcherTests.succeed(host, MethodName.ProviderDelete, new ProviderIdParams(provider.id).toJson());

    Assert.areEqual("fake", RequestDispatcherTests.objects(kinds).map(t => ProviderKind.fromJson(t.toJson()).id).join(","));
    Assert.areEqual("[\"fake-small\",\"fake-large\"]", JSON.stringify(models));
    Assert.areEqual("LoggedIn", checked.authStatus);
    Assert.areEqual(1, RequestDispatcherTests.objects(providers).length);
    Assert.areEqual(1, RequestDispatcherTests.objects(projects).length);
    Assert.areEqual("Renamed", renamed.title);
    Assert.areEqual(1, RequestDispatcherTests.objects(conversations).length);
    Assert.areEqual("Hello", sent.sent.details[0]?.text);
    Assert.areEqual("Working", RequestDispatcherTests.objects(messages).map(t => Message.fromJson(t.toJson()))[1]?.details[0]?.text);
    Assert.areEqual(1, approvals.length);
    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual(2, rewound.removedMessageIds.length);
    Assert.isTrue(rewound.conversation.sessionReset);
    Assert.isNull(rewound.restoredFiles);
    Assert.isNull(deleted);
    Assert.isNull(forgotten);
    Assert.isNull(removed);
  }

  @TestMethod
  public async readsOnlyTheNonTextDetailsAfterASequenceAndTheNamedOnesThatChanged(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync(await host.openProjectAsync());
    const details = [DetailKind.Text, DetailKind.Command, DetailKind.Command, DetailKind.Text, DetailKind.Command, DetailKind.Command]
      .map((t, index) => new MessageDetail(index, t, `step ${index}`, null, "t"));
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Running, details, provenance, "t", "t", null));
    const read = async (afterSequence: number, sequences: readonly number[]): Promise<string> => {
      const message = Message.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageDetailsAfter,
        new MessageDetailsAfterParams("reply", afterSequence, sequences).toJson()));
      return `${message.id} ${message.status} [${message.details.map(t => t.sequence).join(",")}]`;
    };

    Assert.areEqual("reply Running [4,5]", await read(3, []));
    Assert.areEqual("reply Running [1,4,5]", await read(3, [3, 1, 0]));
    Assert.areEqual("reply Running []", await read(5, []));
    Assert.areEqual("reply Running [2]", await read(5, [2]));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.MessageDetailsAfter, new MessageDetailsAfterParams("missing", 0, []).toJson()));
    const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.MessageDetailsAfter, { messageId: "reply", afterSequence: -1, sequences: [] }));
    Assert.areEqual(ErrorCode.InvalidParams, refused.info?.name);
  }

  @TestMethod
  public async dispatchesASignInAndItsCancel(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    const params = new ProviderIdParams(provider.id).toJson();

    const signedIn = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignIn, params));
    host.adapter.holdSignInUntilAbort = true;
    const signing = RequestDispatcherTests.succeed(host, MethodName.ProviderSignIn, params);
    await host.until("the second sign-in", () => host.adapter.signedInProviders.length === 2, new BoundingWork("the sign-in request", signing));
    const cancelled = await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInCancel, params);

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.isNull(cancelled);
    Assert.areEqual(provider.id, Provider.fromJson(await signing).id);
    Assert.areEqual(2, host.adapter.signedInProviders.length);
  }

  @TestMethod
  public async dispatchesASignOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = new FakeProviderAdapter("leaving", false, false, null, null, true);
    host.registry.register(adapter);
    const provider = await host.createProviderAsync("leaving");
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);

    const signedOut = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignOut, new ProviderIdParams(provider.id).toJson()));

    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual(provider.id, adapter.signedOutProviders[0]?.id);
  }

  @TestMethod
  public async dispatchesAProfileSearchForTheGivenKindsAndRefusesBlankOnes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = join(host.directory.path, "home", ".found");
    const adapter = new FakeProviderAdapter("found", false, false, folder);
    adapter.profileSearch = new ProfileSearch([folder], ["settings.json"]);
    host.registry.register(adapter);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "settings.json"), "{}");

    const found = ProviderProfileDiscovery.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderProfileDiscover,
      new ProviderProfileDiscoverParams(["found"]).toJson()));
    const blank = await host.dispatcher.dispatch(new Request("bad", MethodName.ProviderProfileDiscover, { kinds: [" "] }));

    Assert.areEqual(`found ${folder} true`, found.profiles.map(t => `${t.kind} ${t.profileDir} ${t.usual}`).join());
    Assert.isTrue(blank.hasErrors);
  }

  @TestMethod
  public async dispatchesTheRunningSignIns(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    const params = new ProviderIdParams(provider.id).toJson();
    host.adapter.holdSignInUntilAbort = true;

    const signing = RequestDispatcherTests.succeed(host, MethodName.ProviderSignIn, params);
    await host.until("the sign-in", () => host.adapter.signedInProviders.length === 1, new BoundingWork("the sign-in request", signing));
    const running = ProviderSignIns.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInList, null));
    await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInCancel, params);
    await signing;
    const ended = ProviderSignIns.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInList, null));

    Assert.areEqual(provider.id, running.providerIds.join(","));
    Assert.areEqual(0, ended.providerIds.length);
  }

  @TestMethod
  public async stopsASignInWhenItsRequestsSignalAborts(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;
    const controller = new AbortController();

    const signing = host.dispatcher.dispatch(new Request("r", MethodName.ProviderSignIn, new ProviderIdParams(provider.id).toJson()), controller.signal);
    await host.until("the sign-in", () => host.adapter.signedInProviders.length === 1, new BoundingWork("the sign-in request", signing));
    controller.abort();
    const response = await signing;

    Assert.isFalse(response.hasErrors);
    Assert.areEqual(AuthStatus.Unknown, Provider.fromJson(response.payload).authStatus);
    Assert.areEqual(0, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async updatesAProviderAndInvalidatesTheState(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    const updated = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderUpdate,
      new ProviderUpdateParams(provider.id, "Personal", provider.profileDir).toJson()));

    Assert.areEqual("Personal", updated.label);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual(1, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async disablesAProviderAndInvalidatesTheState(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    const disabled = Provider.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSetEnabled,
      new ProviderEnabledParams(provider.id, false).toJson()));

    Assert.isFalse(disabled.enabled);
    Assert.isFalse((await host.providers.findAsync(provider.id))!.enabled);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual(1, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async cancelsAndDecidesThroughTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    const [reply] = sent.replies;
    Assert.isDefined(reply);

    const cancelled = await host.dispatcher.dispatch(new Request("r1", MethodName.MessageCancel, new MessageIdParams(reply.id).toJson()));
    const decided = await host.dispatcher.dispatch(new Request("r2", MethodName.ApprovalDecide, new ApprovalDecideParams("nope", "accept").toJson()));
    const approved = await host.dispatcher.dispatch(new Request("r3", MethodName.MessageApprovePlan, new MessageIdParams(reply.id).toJson()));

    Assert.isFalse(cancelled.hasErrors);
    Assert.areEqual("Cancelled", Message.fromJson(cancelled.payload).status);
    Assert.isTrue(decided.hasErrors);
    Assert.areEqual(ErrorCode.NotFound, decided.info?.name);
    Assert.areEqual(ErrorCode.Conflict, approved.info?.name);
  }

  @TestMethod
  public async approvesAPlanFirstReplysPlanThroughTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy").toJson(), "plan-text")];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.extraDetails = [];
    const [reply] = sent.replies;
    Assert.isDefined(reply);

    const followed = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageApprovePlan, new MessageIdParams(reply.id).toJson()));
    await host.engine.waitForIdle();
    const stored = await host.messages.findAsync(reply.id);

    Assert.areEqual(1, followed.replies.length);
    Assert.isNotNull(stored);
    Assert.isTrue(ReplyPlan.ofDetails(stored.details)?.approved === true);
  }

  @TestMethod
  public async listsAndStopsAReplysBackgroundTasksAfterTheReplyEndsAndForgetsThemWithTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.afterDetails = () => host.adapter.lastListener!.onTaskStartedAsync(new TaskStart("item-1", "npm run dev", () =>
      host.adapter.lastListener!.onTaskEndedAsync(new TaskEnd("item-1", BackgroundTaskStatus.Stopped, 143))));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Start the server", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.lastListener!.onTaskOutput("item-1", "ready on 5173\n");
    await host.until("the task output event", () => host.listener.count(EventName.BackgroundTaskOutput) === 1);

    const page = BackgroundTaskPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskList,
      new BackgroundTaskListParams(conversation.id, null, 10).toJson()));
    const listed = page.tasks;
    const read = BackgroundTask.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskRead,
      new BackgroundTaskIdParams(listed[0]!.id).toJson()));
    const stopped = BackgroundTask.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskStop,
      new BackgroundTaskIdParams(listed[0]!.id).toJson()));
    const missing = await host.dispatcher.dispatch(new Request("r", MethodName.BackgroundTaskStop, new BackgroundTaskIdParams("missing").toJson()));
    const replyStatus = (await host.messages.findAsync(sent.replies[0]!.id))?.status;
    const cleared = BackgroundTasksClearedPayload.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskClearFinished,
      new ConversationIdParams(conversation.id).toJson()));
    const afterClear = BackgroundTaskPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskList,
      new BackgroundTaskListParams(conversation.id, null, 10).toJson()));
    await RequestDispatcherTests.succeed(host, MethodName.ConversationDelete, new ConversationIdParams(conversation.id).toJson());
    const afterDelete = BackgroundTaskPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.BackgroundTaskList,
      new BackgroundTaskListParams(conversation.id, null, 10).toJson()));

    Assert.areEqual("Completed", replyStatus);
    Assert.areEqual("1:false:0", [listed.length, page.hasLater, page.count].join(":"));
    Assert.areEqual(sent.replies[0]!.id, listed[0]!.messageId);
    Assert.areEqual("fake", listed[0]!.kind);
    Assert.areEqual(BackgroundTaskStatus.Running, listed[0]!.status);
    Assert.isNull(listed[0]!.output);
    Assert.areEqual("ready on 5173\n", read.output);
    Assert.areEqual(BackgroundTaskStatus.Stopped, stopped.status);
    Assert.areEqual(143, stopped.exitCode);
    Assert.areEqual(ErrorCode.NotFound, missing.info?.name);
    Assert.areEqual(`${conversation.id}:1`, [cleared.chatId, cleared.count].join(":"));
    Assert.areEqual("0:0:0:0", [afterClear.tasks.length, afterClear.count, afterDelete.tasks.length, afterDelete.count].join(":"));
  }

  @TestMethod
  public async stopsAChatThroughTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));

    const stopped = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationCancel, new ConversationIdParams(conversation.id).toJson()));
    const idle = await host.dispatcher.dispatch(new Request("r2", MethodName.ConversationCancel, new ConversationIdParams(conversation.id).toJson()));

    Assert.isFalse(stopped.hasErrors);
    Assert.areEqual("Cancelled", RequestDispatcherTests.objects(stopped.payload).map(t => Message.fromJson(t.toJson()).status).join(","));
    Assert.isTrue(idle.hasErrors);
    Assert.areEqual(ErrorCode.Conflict, idle.info?.name);
  }

  @TestMethod
  public async keepsAChatsWaitingMessagesThroughTheCatalog(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.holdUntilAbort = true;
    const chat = await host.createConversationAsync();
    const providerId = (await host.providerOfAsync()).id;
    const send = (text: string): MessageSendParams => new MessageSendParams(chat.id, text, new RequestedSettings("fake", null, null), providerId);
    const running = await host.engine.sendAsync(send("Wait"));
    await host.adapter.requested(1);

    const added = WaitingMessage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageAdd,
      new WaitingMessageAddParams(send("Later"), MessageDelivery.Queue).toJson()));
    await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageAdd, new WaitingMessageAddParams(send("Never"), MessageDelivery.Queue).toJson());
    const listed = WaitingMessagesPayload.fromJson(await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageList,
      new ConversationIdParams(chat.id).toJson()));
    const edited = WaitingMessage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageEdit,
      new WaitingMessageEditParams(added.id, send("Sooner")).toJson()));
    const removed = await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageRemove, new WaitingMessageIdParams(listed.messages[1]?.id ?? "").toJson());
    const now = WaitingMessage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.WaitingMessageSendNow, new WaitingMessageIdParams(added.id).toJson()));
    await host.adapter.requested(2);
    await host.engine.shutdown();

    Assert.areEqual("Later,Never", listed.messages.map(t => t.message.text).join(","));
    Assert.areEqual(`Sooner|true|${MessageDelivery.StopAndSend}`, [edited.message.text, removed === null, now.delivery].join("|"));
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(running.replies[0]?.id ?? ""))?.status);
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("Sooner") === true, String(host.adapter.requests[1]?.prompt));
  }

  @TestMethod
  public async describesEveryKindOfFailure(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const unknown = await host.dispatcher.dispatch(new Request("r1", "project/explode", null));
    const invalidJson = await host.dispatcher.dispatch(new Request("r2", MethodName.ProjectOpen, { rootPath: 42 }));
    const invalidArgument = await host.dispatcher.dispatch(new Request("r3", MethodName.MessageList, { chatId: "c", afterSequence: -5, kinds: [] }));
    const notFound = await host.dispatcher.dispatch(new Request("r4", MethodName.ProjectForget, new ProjectIdParams("nope").toJson()));
    host.adapter.listModelsFailure = new Error("boom");
    const internal = await host.dispatcher.dispatch(new Request("r5", MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson()));
    host.adapter.listModelsFailure = "plain text";
    const plain = await host.dispatcher.dispatch(new Request("r6", MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson()));

    Assert.areEqual(ErrorCode.UnknownMethod, unknown.info?.name);
    Assert.areEqual("project/explode", unknown.info?.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, invalidJson.info?.name);
    Assert.areEqual("$.rootPath", invalidJson.info?.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, invalidArgument.info?.name);
    Assert.areEqual("afterSequence", invalidArgument.info?.arguments[0]);
    Assert.areEqual(ErrorCode.NotFound, notFound.info?.name);
    Assert.areEqual(ErrorCode.Internal, internal.info?.name);
    Assert.areEqual("boom", internal.info?.message);
    Assert.areEqual("plain text", plain.info?.message);
    Assert.areEqual("r6", plain.id);
  }

  @TestMethod
  public describesFailuresForOtherDispatchers(): void {
    const service = RequestDispatcher.describe(new ServiceException(ErrorCode.Conflict, "Busy.", ["t1"]));
    const json = RequestDispatcher.describe(new JsonException("Not a string.", "$.data"));
    const named = RequestDispatcher.describe(new ArgumentException("Blank.", "terminalId"));
    const unnamed = RequestDispatcher.describe(new ArgumentException("Blank."));
    const other = RequestDispatcher.describe(new Error("Broken."));

    Assert.areEqual(ErrorCode.Conflict, service.name);
    Assert.areEqual("t1", service.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, json.name);
    Assert.areEqual("$.data", json.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, named.name);
    Assert.areEqual("terminalId", named.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, unnamed.name);
    Assert.areEqual(0, unnamed.arguments.length);
    Assert.areEqual(ErrorCode.Internal, other.name);
    Assert.areEqual("Broken.", other.message);
  }

  @TestMethod
  public async readsTheConversationsMessageAndDraftAttachmentsAndNoOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const notes = new AttachmentInput("notes.txt", "text/plain", Buffer.from("hello").toString("base64"), null);
    const sendParams = new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id, [notes]);
    const sent = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSend, sendParams.toJson()));
    await host.engine.waitForIdle();
    const draftParams = new DraftSaveParams(conversation.id, "Later", [new AttachmentInput("draft.png", "image/png", "AAEC", null)]);
    const draft = Draft.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DraftSave, draftParams.toJson()));
    const prepared = MessageAttachment.fromJson(await RequestDispatcherTests.succeed(host, MethodName.AttachmentPrepare,
      new AttachmentInput("prepared.txt", "text/plain", "YQ==", null).toJson()));
    const saved = sent.sent.attachments[0]!.path;

    const message = await RequestDispatcherTests.succeed(host, MethodName.AttachmentRead, new AttachmentReadParams(conversation.id, saved).toJson());
    const drafted = await RequestDispatcherTests.succeed(host, MethodName.AttachmentRead,
      new AttachmentReadParams(conversation.id, draft.attachments[0]!.path).toJson());

    Assert.areEqual(JSON.stringify(new AttachmentContent("notes.txt", "text/plain", 5, "aGVsbG8=").toJson()), JSON.stringify(AttachmentContent.fromJson(message).toJson()));
    Assert.areEqual(JSON.stringify(new AttachmentContent("draft.png", "image/png", 3, "AAEC").toJson()), JSON.stringify(AttachmentContent.fromJson(drafted).toJson()));
    for (const params of [new AttachmentReadParams(conversation.id, prepared.path), new AttachmentReadParams(other.id, saved),
      new AttachmentReadParams("missing", saved)]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.AttachmentRead, params.toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
  }

  @TestMethod
  public async locatesTheConversationsMessageAndDraftAttachmentsToShareWithoutTheirBytesAndNoOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const notes = new AttachmentInput("notes.txt", "text/plain", Buffer.from("hello").toString("base64"), null);
    const sendParams = new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id, [notes]);
    const sent = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSend, sendParams.toJson()));
    await host.engine.waitForIdle();
    const draftParams = new DraftSaveParams(conversation.id, "Later", [new AttachmentInput("draft.png", "image/png", "AAEC", null)]);
    const draft = Draft.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DraftSave, draftParams.toJson()));
    const prepared = MessageAttachment.fromJson(await RequestDispatcherTests.succeed(host, MethodName.AttachmentPrepare,
      new AttachmentInput("prepared.txt", "text/plain", "YQ==", null).toJson()));
    const saved = sent.sent.attachments[0]!.path;

    const message = await RequestDispatcherTests.succeed(host, MethodName.AttachmentShare, new AttachmentReadParams(conversation.id, saved).toJson());
    const drafted = await RequestDispatcherTests.succeed(host, MethodName.AttachmentShare,
      new AttachmentReadParams(conversation.id, draft.attachments[0]!.path).toJson());

    Assert.areEqual(JSON.stringify({ ...sent.sent.attachments[0]!.toJson(), path: realpathSync(saved) }), JSON.stringify(message));
    Assert.areEqual(JSON.stringify({ ...draft.attachments[0]!.toJson(), path: realpathSync(draft.attachments[0]!.path) }), JSON.stringify(drafted));
    for (const params of [new AttachmentReadParams(conversation.id, prepared.path), new AttachmentReadParams(other.id, saved),
      new AttachmentReadParams("missing", saved)]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.AttachmentShare, params.toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
  }

  @TestMethod
  public async saysWhetherAConversationsMessageAttachmentIsStillSavedAndRefusesAnyOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const inputs = ["notes.txt", "todo.txt", "plan.txt"].map(t => new AttachmentInput(t, "text/plain", Buffer.from("hello").toString("base64"), null));
    const sendParams = new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id, inputs);
    const sent = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSend, sendParams.toJson()));
    await host.engine.waitForIdle();
    const draftParams = new DraftSaveParams(conversation.id, "Later", [new AttachmentInput("draft.txt", "text/plain", "YQ==", null)]);
    const draft = Draft.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DraftSave, draftParams.toJson()));
    const [kept, moved, linked] = sent.sent.attachments.map(t => t.path);
    const drafted = draft.attachments.at(0)?.path;
    if (Object.isUndefined(kept) || Object.isUndefined(moved) || Object.isUndefined(linked) || Object.isUndefined(drafted))
      throw new Error("The message and the draft saved no attachments.");
    renameSync(moved, `${moved}.moved`);
    const outside = join(dirname(kept), "outside.txt");
    writeFileSync(outside, "not attached");
    rmSync(linked);
    const folder = `${outside}.folder`;
    mkdirSync(folder);
    symlinkSync(folder, linked, "junction");

    const answers: unknown[] = [];
    for (const path of [kept, moved, linked])
      answers.push(await RequestDispatcherTests.succeed(host, MethodName.AttachmentExists, new AttachmentReadParams(conversation.id, path).toJson()));

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(answers));
    for (const params of [new AttachmentReadParams(conversation.id, outside), new AttachmentReadParams(conversation.id, drafted),
      new AttachmentReadParams(other.id, kept), new AttachmentReadParams("missing", kept)]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.AttachmentExists, params.toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
  }

  @TestMethod
  public async listsTheLinkedPathsThatAreFoldersAndLooksAtNoOtherPath(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const folder = join(project.rootPath, "icon-preview");
    const file = join(project.rootPath, "notes.md");
    const isPosix = process.platform !== "win32";
    const network = isPosix ? `/${folder}` : "//server/share/icon-preview";
    const control = `${folder}\u0007`;
    mkdirSync(folder, { recursive: true });
    if (isPosix)
      mkdirSync(control);
    writeFileSync(file, "notes");
    const paths = [file, folder, join(project.rootPath, "gone"), "icon-preview", network, control, project.rootPath];
    const before = host.folderStat.paths.length;

    const answer = await RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths(paths).toJson());

    Assert.areEqual(JSON.stringify({ paths: [folder, project.rootPath] }), JSON.stringify(answer));
    Assert.areEqual(JSON.stringify([file, folder, join(project.rootPath, "gone"), project.rootPath]), JSON.stringify(host.folderStat.paths.slice(before)));
    Assert.areEqual(JSON.stringify({ paths: [] }),
      JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths([]).toJson())));
  }

  @TestMethod
  public async leavesOutALinkedFolderThatDoesntAnswerWithinTheDeadlineWhileOtherRequestsAreAnswered(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const share = join(project.rootPath, "share");
    const local = join(project.rootPath, "local");
    mkdirSync(share);
    mkdirSync(local);
    host.folderStat.hold(share);
    host.folderStat.hold(local);

    const listing = RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths([share, local]).toJson());
    const projects = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ProjectList, null));
    Assert.isTrue(host.folderStat.paths.includes(local));
    host.folderStat.release(local, true);
    await new Promise(resolve => setImmediate(resolve));
    host.timer.advance(1_000);

    Assert.areEqual(JSON.stringify({ paths: [local] }), JSON.stringify(await listing));
    Assert.areEqual(1, projects.length);
  }

  @TestMethod
  public async readsTwoOfFourLinksOnAStalledShareAndAnswersALaterListingWithoutAReadWhileProjectsAreChecked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const share = join(project.rootPath, "share");
    const local = join(project.rootPath, "local");
    const links = ["a", "b", "c", "d"].map(t => join(share, t));
    mkdirSync(local);
    for (const link of links) {
      mkdirSync(link, { recursive: true });
      host.folderStat.hold(link);
    }
    const before = host.folderStat.paths.length;

    const listing = RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths(links).toJson());
    const projects = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ProjectList, null));
    host.timer.advance(1_000);
    const first = await listing;
    const later = await RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths([local]).toJson());
    const read = host.folderStat.paths.slice(before);

    Assert.areEqual(JSON.stringify([{ paths: [] }, { paths: [] }]), JSON.stringify([first, later]));
    Assert.areEqual(links.slice(0, Resources.maximumLinkedFolderChecks).join(), read.filter(t => t.startsWith(share)).join());
    Assert.areEqual(JSON.stringify([project.rootPath]), JSON.stringify(read.filter(t => !t.startsWith(share))));
    Assert.areEqual(1, projects.length);
  }

  @TestMethod
  public async checksAtMostFortyDistinctLinkedPathsOfAListing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const folders = Array.from({ length: Resources.maximumLinkedFolderPaths + 5 }, (_, index) => join(project.rootPath, `folder-${index}`));
    for (const folder of folders)
      mkdirSync(folder);
    const checked = folders.slice(0, Resources.maximumLinkedFolderPaths);
    const before = host.folderStat.paths.length;

    const listed = await RequestDispatcherTests.succeed(host, MethodName.LinkedFolderList, new LinkedPaths([...folders.slice(0, 1), ...folders]).toJson());

    Assert.areEqual(JSON.stringify({ paths: checked }), JSON.stringify(listed));
    Assert.areEqual(checked.join(), host.folderStat.paths.slice(before).join());
  }

  @TestMethod
  public async readsAnImageAReplyWroteInItsProjectAndNoOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    mkdirSync(join(project.rootPath, "out"), { recursive: true });
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    const chart = join(project.rootPath, "out", "chart.png");
    const unnamed = join(project.rootPath, "out", "unnamed.png");
    writeFileSync(chart, png);
    writeFileSync(unnamed, png);
    const detail = new MessageDetail(0, DetailKind.FileChange, "Wrote the chart", { changes: [{ path: chart, kind: "add" }] }, "t");
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, "t", null, "t"));
    await host.messages.insertAsync(new Message("elsewhere", other.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, "t", null, "t"));

    const read = await RequestDispatcherTests.succeed(host, MethodName.WrittenImageRead, new WrittenImageReadParams(conversation.id, "reply", chart).toJson());

    Assert.areEqual(JSON.stringify(new AttachmentContent("chart.png", "image/png", png.length, png.toString("base64")).toJson()),
      JSON.stringify(AttachmentContent.fromJson(read).toJson()));
    for (const params of [new WrittenImageReadParams(conversation.id, "reply", unnamed), new WrittenImageReadParams(conversation.id, "elsewhere", chart),
      new WrittenImageReadParams(conversation.id, "missing", chart), new WrittenImageReadParams("missing", "reply", chart)]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.WrittenImageRead, params.toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
    await host.context.database.connection.executeAsync(new SqlQuery("PRAGMA foreign_keys = OFF"));
    await host.context.database.connection.executeAsync(new SqlQuery("DELETE FROM projects WHERE id = ?", [project.id]));
    const orphaned = await host.dispatcher.dispatch(new Request("r2", MethodName.WrittenImageRead,
      new WrittenImageReadParams(conversation.id, "reply", chart).toJson()));
    Assert.areEqual(ErrorCode.NotFound, orphaned.info?.name);
  }

  @TestMethod
  public async readsAnImageAReplysMarkdownDrawsFromItsProjectAndNoOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    mkdirSync(join(project.rootPath, "out"), { recursive: true });
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    for (const name of ["drawn.png", "other.png"])
      writeFileSync(join(project.rootPath, "out", name), png);
    writeFileSync(join(project.rootPath, "out", "fake.png"), "not an image");
    const text = "Drew ![chart](./out/drawn.png), ![gone](out/missing.png) and ![fake](out/fake.png).";
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t")], null, "t", null, "t"));
    const reader = new WrittenImageReader();

    const read = await RequestDispatcherTests.succeed(host, MethodName.WrittenImageRead,
      new WrittenImageReadParams(conversation.id, "reply", reader.markdownImagePathOf("./out/drawn.png", project.rootPath)!).toJson());

    Assert.areEqual(JSON.stringify(new AttachmentContent("drawn.png", "image/png", png.length, png.toString("base64")).toJson()),
      JSON.stringify(AttachmentContent.fromJson(read).toJson()));
    for (const path of [join(project.rootPath, "out", "other.png"), reader.markdownImagePathOf("out/missing.png", project.rootPath)!,
      reader.markdownImagePathOf("out/fake.png", project.rootPath)!]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.WrittenImageRead, new WrittenImageReadParams(conversation.id, "reply", path).toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
  }

  @TestMethod
  public async readsAnImageAReplysMarkdownLinksToInItsProjectAndNoOtherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    mkdirSync(join(project.rootPath, "out"), { recursive: true });
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    for (const name of ["linked.png", "other.png"])
      writeFileSync(join(project.rootPath, "out", name), png);
    writeFileSync(join(project.rootPath, "out", "notes.md"), "notes");
    const text = "See [the chart](out/linked.png), [notes](out/notes.md) and `[code](out/other.png)`.";
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t")], null, "t", null, "t"));
    const reader = new WrittenImageReader();

    const read = await RequestDispatcherTests.succeed(host, MethodName.WrittenImageRead,
      new WrittenImageReadParams(conversation.id, "reply", reader.linkedPathOf("out/linked.png", project.rootPath)!).toJson());

    Assert.areEqual(JSON.stringify(new AttachmentContent("linked.png", "image/png", png.length, png.toString("base64")).toJson()),
      JSON.stringify(AttachmentContent.fromJson(read).toJson()));
    for (const path of [reader.linkedPathOf("out/other.png", project.rootPath)!, reader.linkedPathOf("out/notes.md", project.rootPath)!]) {
      const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.WrittenImageRead, new WrittenImageReadParams(conversation.id, "reply", path).toJson()));
      Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    }
  }

  @TestMethod
  public async readsTheCopyOfAGeneratedImageTeamRunStoredOrTheFileItSavedInItsProjectAndNoOther(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const elsewhere = await host.openProjectAsync("beta");
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    const images = join(host.directory.path, "images");
    for (const folder of [project.rootPath, elsewhere.rootPath, images])
      mkdirSync(folder, { recursive: true });
    const stored = join(images, "reply-0.png");
    const saved = join(project.rootPath, "gen.png");
    const outside = join(elsewhere.rootPath, "gen.png");
    for (const file of [stored, saved, outside])
      writeFileSync(file, png);
    const generated = (sequence: number, savedPath: string, storedPath: string | null): MessageDetail => new MessageDetail(sequence, DetailKind.Note,
      `Generated image (completed): ${savedPath}`, { itemType: "imageGeneration", status: "completed", savedPath, storedPath, imageData: null, mediaType: "image/png" }, "t");
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed,
      [generated(0, "C:\\Users\\me\\.codex\\generated_images\\sun.png", stored), generated(1, saved, null), generated(2, outside, outside)], null, "t", null, "t"));

    const reads = await Promise.all([stored, saved].map(t => RequestDispatcherTests.succeed(host, MethodName.WrittenImageRead,
      new WrittenImageReadParams(conversation.id, "reply", t).toJson())));
    const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.WrittenImageRead,
      new WrittenImageReadParams(conversation.id, "reply", outside).toJson()));

    Assert.areEqual(JSON.stringify(["reply-0.png", "gen.png"].map(t => new AttachmentContent(t, "image/png", png.length, png.toString("base64")).toJson())),
      JSON.stringify(reads.map(t => AttachmentContent.fromJson(t).toJson())));
    Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
  }

  @TestMethod
  public async sharesAWrittenImageAsACheckedCopyOrTheStoredCopyOfAGeneratedOneAndRefusesAnSvgOrAnotherFile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    const images = join(host.directory.path, "images");
    for (const folder of [project.rootPath, images])
      mkdirSync(folder, { recursive: true });
    const stored = join(images, "reply-0.png");
    const chart = join(project.rootPath, "chart.png");
    const drawing = join(project.rootPath, "drawing.svg");
    writeFileSync(stored, png);
    writeFileSync(chart, png);
    writeFileSync(drawing, "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 2 1\"/>");
    const changes = new MessageDetail(0, DetailKind.FileChange, "Wrote", { changes: [{ path: chart, kind: "add" }, { path: drawing, kind: "add" }] }, "t");
    const generated = new MessageDetail(1, DetailKind.Note, `Generated image (completed): ${stored}`, { itemType: "imageGeneration", status: "completed",
      savedPath: join(project.rootPath, "gone.png"), storedPath: stored, imageData: null, mediaType: "image/png" }, "t");
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [changes, generated], null, "t", null, "t"));

    const [copied, kept] = await Promise.all([chart, stored].map(async t => MessageAttachment.fromJson(await RequestDispatcherTests.succeed(host,
      MethodName.WrittenImageShare, new WrittenImageReadParams(conversation.id, "reply", t).toJson()))));
    const refused = await Promise.all([drawing, join(project.rootPath, "other.png")].map(t => host.dispatcher.dispatch(new Request("r1",
      MethodName.WrittenImageShare, new WrittenImageReadParams(conversation.id, "reply", t).toJson()))));

    Assert.isDefined(copied);
    Assert.isDefined(kept);
    Assert.areEqual(`chart.png:image/png:${png.length}`, `${copied.name}:${copied.mediaType}:${copied.size}`);
    Assert.areEqual(join(host.directory.path, "shared-images"), dirname(copied.path));
    Assert.areEqual(png.toString("hex"), readFileSync(copied.path).toString("hex"));
    Assert.areEqual(realpathSync(stored), kept.path);
    Assert.areEqual("NotFound,NotFound", refused.map(t => t.info?.name).join(","));
  }

  @TestMethod
  public async savesReadsAndDiscardsDraftsAndKnowsNoneWithoutTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const file = new AttachmentInput("notes.txt", "text/plain", "YQ==", null);

    const saved = Draft.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DraftSave, new DraftSaveParams(conversation.id, "Hi", [file]).toJson()));
    const read = Draft.fromJson(await RequestDispatcherTests.succeed(host, MethodName.DraftRead, new ConversationIdParams(conversation.id).toJson()));
    const discarded = await RequestDispatcherTests.succeed(host, MethodName.DraftDiscard, new DraftDiscardParams(conversation.id, saved.revision).toJson());
    const empty = await RequestDispatcherTests.succeed(host, MethodName.DraftRead, new ConversationIdParams(conversation.id).toJson());
    const unknown = await host.dispatcher.dispatch(new Request("r1", MethodName.DraftRead, new ConversationIdParams("missing").toJson()));
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r2", MethodName.DraftSave, new DraftSaveParams(conversation.id, "Hi").toJson()));

    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual(1, saved.attachments.length);
    Assert.isNull(discarded);
    Assert.isNull(empty);
    Assert.areEqual(ErrorCode.NotFound, unknown.info?.name);
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
    Assert.areEqual(MethodName.DraftSave, unsupported.info?.arguments[0]);
  }

  @TestMethod
  public async savesAndListsAChatsRunOutputsOutsideTheChangeFeedAndRefusesAMessageOfAnotherChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [conversation, other] = [await host.createConversationAsync(), await host.createConversationAsync()];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const reply = (await host.messages.listAsync(new MessageListParams(conversation.id, null)))[1]?.id ?? "";
    const output = new RunOutput(conversation.id, reply, "body", 0, { lines: [], cutLines: 3 });
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const saved = await RequestDispatcherTests.succeed(host, MethodName.RunOutputSave, output.toJson());
    const listed = await RequestDispatcherTests.succeed(host, MethodName.RunOutputList, new ConversationIdParams(conversation.id).toJson());
    const elsewhere = await host.dispatcher.dispatch(new Request("r", MethodName.RunOutputSave,
      new RunOutput(other.id, reply, "body", 0, {}).toJson()));

    Assert.isNull(saved);
    Assert.areEqual(JSON.stringify([output.toJson()]), JSON.stringify(listed));
    Assert.areEqual(changes, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    Assert.areEqual(`${ErrorCode.NotFound} ${reply}`, RequestDispatcherTests.outcome(elsewhere).split(" ").slice(0, 2).join(" "));
  }

  @TestMethod
  public async savesAndListsReadingPositionsOutsideTheChangeFeedAndKnowsNoneWithoutTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [first, second] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    const save = (params: ReadingPositionSaveParams): Promise<unknown> => RequestDispatcherTests.succeed(host, MethodName.ReadingPositionSave, params.toJson());
    const list = async (): Promise<string> => JSON.stringify(await RequestDispatcherTests.succeed(host, MethodName.ReadingPositionList, null));

    Assert.isNull(await save(new ReadingPositionSaveParams([new ConversationPosition(first.id, "m1", 0, 12), new ConversationPosition(second.id, "m4", 3, -8)])));
    Assert.areEqual(JSON.stringify([new ConversationPosition(first.id, "m1", 0, 12), new ConversationPosition(second.id, "m4", 3, -8)]
      .sort((a, b) => a.conversationId < b.conversationId ? -1 : 1).map(t => t.toJson())), await list());
    await save(new ReadingPositionSaveParams([new ConversationPosition(first.id, "m2", 1, 0), new ConversationPosition("missing", "m1", 0, 0)], [second.id]));
    Assert.areEqual(JSON.stringify([new ConversationPosition(first.id, "m2", 1, 0).toJson()]), await list());
    Assert.areEqual(changes, (await host.context.database.changeFeed.readAfterAsync(0)).length);

    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r1", MethodName.ReadingPositionList, null));
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
    Assert.areEqual(MethodName.ReadingPositionList, unsupported.info?.arguments[0]);
  }

  @TestMethod
  public async publishesTheDeletionOfAChatAndOfEachChatItsProjectTakesWithIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [first, second, third] = [await host.createConversationAsync(project), await host.createConversationAsync(project), await host.createConversationAsync(project)];
    await host.createConversationAsync(await host.openProjectAsync("beta"));

    await RequestDispatcherTests.succeed(host, MethodName.ConversationDelete, new ConversationIdParams(first.id).toJson());
    const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationDelete, new ConversationIdParams(first.id).toJson()));
    await RequestDispatcherTests.succeed(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());

    const deleted = host.listener.events.filter(t => t.name === EventName.ConversationDeleted).map(t => ConversationIdParams.fromJson(t.payload).conversationId);
    Assert.isTrue(refused.hasErrors);
    Assert.areEqual(first.id, deleted[0]);
    Assert.areEqual([second.id, third.id].sort().join(","), deleted.slice(1).sort().join(","));
    Assert.areEqual([EventName.ConversationDeleted, EventName.StateInvalidated, EventName.ConversationDeleted, EventName.ConversationDeleted, EventName.StateInvalidated].join(","),
      host.listener.names().filter(t => t === EventName.ConversationDeleted || t === EventName.StateInvalidated).join(","));
  }

  @TestMethod
  public async hasTheEngineForgetADeletedChatAndEachChatOfAForgottenProject(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const forgotten: string[] = [];
    const engine = new Proxy(host.engine, { get: (target, name, receiver): unknown => name === "forgetAsync"
      ? (conversationIds: readonly string[]): Promise<void> => {
        forgotten.push([...conversationIds].sort().join(","));
        return target.forgetAsync(conversationIds);
      }
      : Reflect.get(target, name, receiver) });
    const dispatcher = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, engine, host.teammates, host.events);
    const project = await host.openProjectAsync();
    const deleted = await host.createConversationAsync(project);
    const kept = [await host.createConversationAsync(project), await host.createConversationAsync(project)];

    const deletion = await dispatcher.dispatch(new Request("r1", MethodName.ConversationDelete, new ConversationIdParams(deleted.id).toJson()));
    const forgetting = await dispatcher.dispatch(new Request("r2", MethodName.ProjectForget, new ProjectIdParams(project.id).toJson()));

    Assert.isFalse(deletion.hasErrors);
    Assert.isFalse(forgetting.hasErrors);
    Assert.areEqual(JSON.stringify([deleted.id, kept.map(t => t.id).sort().join(",")]), JSON.stringify(forgotten));
  }

  @TestMethod
  public async hasTheEngineTellTheProvidersOnlyWhenAChatsPlanFirstTurnsOn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const planning: string[] = [];
    const engine = new Proxy(host.engine, { get: (target, name, receiver): unknown => name === "planFirstAsync"
      ? (conversationId: string): Promise<void> => {
        planning.push(conversationId);
        return target.planFirstAsync(conversationId);
      }
      : Reflect.get(target, name, receiver) });
    const dispatcher = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, engine, host.teammates, host.events);
    const conversation = await host.createConversationAsync();

    const on = await dispatcher.dispatch(new Request("r1", MethodName.ConversationSetPlanFirst, new ChatPlanFirstParams(conversation.id, true).toJson()));
    const off = await dispatcher.dispatch(new Request("r2", MethodName.ConversationSetPlanFirst, new ChatPlanFirstParams(conversation.id, false).toJson()));

    Assert.isFalse(on.hasErrors || off.hasErrors);
    Assert.areEqual(JSON.stringify([conversation.id]), JSON.stringify(planning));
    Assert.isFalse((await host.conversations.findAsync(conversation.id))?.planFirst ?? true);
  }

  @TestMethod
  public async readsTheDataFolderItWasGivenAndKnowsNoneWithoutIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = new DataFolder("/data/modules/teamrun", "/data/modules/teamrun/teamrun.sqlite");
    const given = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events, null, folder);

    const read = await given.dispatch(new Request("r1", MethodName.DataFolderRead, null));
    const unsupported = await host.dispatcher.dispatch(new Request("r2", MethodName.DataFolderRead, null));

    Assert.areEqual(JSON.stringify(folder.toJson()), JSON.stringify(DataFolder.fromJson(read.payload).toJson()));
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
    Assert.areEqual(MethodName.DataFolderRead, unsupported.info?.arguments[0]);
  }

  @TestMethod
  public async listsAndReadsPlanUse(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const params = new PlanUsageParams("fake", null).toJson();
    host.adapter.readPlanUsage = () => Promise.resolve(new PlanReading([new PlanWindow(PlanWindowName.Weekly, 3, null)]));

    const empty = await RequestDispatcherTests.succeed(host, MethodName.PlanUsageList, null);
    const read = PlanUsage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.PlanUsageRead, params));
    const listed = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.PlanUsageList, null)).map(t => PlanUsage.fromJson(t.toJson()));
    host.adapter.readPlanUsage = () => Promise.resolve(null);
    const none = await RequestDispatcherTests.succeed(host, MethodName.PlanUsageRead, params);
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r2", MethodName.PlanUsageList, null));

    Assert.areEqual("[]", JSON.stringify(empty));
    Assert.areEqual(JSON.stringify([read.toJson()]), JSON.stringify(listed.map(t => t.toJson())));
    Assert.areEqual(PlanWindowName.Weekly, read.windows[0]?.name);
    Assert.isNull(none);
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
  }

  @TestMethod
  public async keepsTheWindowsAndTheirAnswersAndKnowsNoneWithoutTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const invalidated = host.listener.count(EventName.StateInvalidated);
    const ask = async (): Promise<PanelRequestedPayload> => {
      const requested = host.listener.next(EventName.PanelRequested);
      const opened = host.windows.requestAsync(PanelName.Providers, null, true, conversation.id);
      const payload = PanelRequestedPayload.fromJson((await requested).payload);
      Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.PanelAnswered, new PanelAnsweredParams(payload.requestId, payload.windowId, PanelOutcome.Done).toJson()));
      Assert.areEqual(payload.windowId, await opened);
      return payload;
    };

    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.WindowFocused, new WindowFocusedParams("w1", conversation.id, true).toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.WindowFocused, new WindowFocusedParams("w2", null, true).toJson()));
    const showing = await ask();
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.WindowClosed, new WindowIdParams("w1").toJson()));
    const remaining = await ask();
    const reload = host.listener.next(EventName.WindowReloadRequested);
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.WindowReload, new WindowIdParams("w2").toJson()));
    Assert.areEqual(JSON.stringify({ windowId: "w2" }), JSON.stringify((await reload).payload));
    const closed = await host.dispatcher.dispatch(new Request("r1", MethodName.WindowReload, new WindowIdParams("w1").toJson()));
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, ["w1"]]), JSON.stringify([closed.info?.name, closed.info?.arguments]));
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r1", MethodName.WindowFocused, new WindowFocusedParams("w1", null, true).toJson()));

    Assert.areEqual(JSON.stringify(["w1", "w2"]), JSON.stringify([showing.windowId, remaining.windowId]));
    Assert.areEqual(invalidated, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
    Assert.areEqual(MethodName.WindowFocused, unsupported.info?.arguments[0]);
  }

  @TestMethod
  public async listsEachTeammatesLastReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.createProviderAsync()).id, Harness.Provider, null, null));
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);

    const empty = await RequestDispatcherTests.succeed(host, MethodName.TeammateLastReplyList, null);
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Done.", null, "t")], provenance, "t", "t", "t2", [], ada.id, "Ada"));
    const listed = await RequestDispatcherTests.succeed(host, MethodName.TeammateLastReplyList, null);

    Assert.areEqual("[]", JSON.stringify(empty));
    Assert.areEqual(JSON.stringify([new TeammateLastReply(ada.id, conversation.id, "reply", "Done.", "t2").toJson()]), JSON.stringify(listed));
  }

  @TestMethod
  public async listsTeammateUsage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.createProviderAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const usage = new ReplyUsage(12, 3, null, null);
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false,
      null, null, usage);

    const empty = await RequestDispatcherTests.succeed(host, MethodName.TeammateUsageList, null);
    await host.messages.insertAsync(new Message("reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Completed, [], provenance, "t", "t", "t2",
      [], ada.id, "Ada"));
    const listed = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.TeammateUsageList, null))
      .map(t => TeammateUsage.fromJson(t.toJson()));

    Assert.areEqual("[]", JSON.stringify(empty));
    Assert.areEqual(JSON.stringify([new TeammateUsage(ada.id, conversation.id, "reply", "t", "t2", usage).toJson()]),
      JSON.stringify(listed.map(t => t.toJson())));
  }

  @TestMethod
  public async handsTheAddedAgentsMethodsToTheirServiceAndKnowsNoneWithoutIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const kind = new FakeProviderAdapter("droid").descriptor;
    const asked: string[] = [];
    const service: IAcpAgentsService = {
      listAsync: () => Promise.resolve(new AcpAgentListing([], [], "listed", null)),
      readIconAsync: params => Promise.resolve(`icon of ${params.id}`),
      addAsync: params => {
        asked.push(`add ${params.id}`);
        return Promise.resolve(kind);
      },
      addLocalAsync: params => {
        asked.push(`local ${params.name}`);
        return Promise.resolve(kind);
      },
      removeAsync: params => {
        asked.push(`remove ${params.id}`);
        return Promise.resolve();
      }
    };
    const dispatcher = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages, host.approvals, host.engine, host.teammates, host.events, host.drafts,
      null, host.tasks, host.planUsage, host.readingPositions, host.windows, host.sharedServers, host.computerUseGrants, service);
    const answer = async (method: MethodName, payload: unknown): Promise<unknown> => (await dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)))).payload;
    const id = new AcpAgentIdParams("droid").toJson();

    Assert.areEqual("listed", AcpAgentListing.fromJson(await answer(MethodName.AcpAgentList, null)).failure);
    Assert.areEqual("icon of droid", await answer(MethodName.AcpAgentIcon, id));
    Assert.areEqual("droid", ProviderKind.fromJson(await answer(MethodName.AcpAgentAdd, id)).id);
    Assert.areEqual("droid", ProviderKind.fromJson(await answer(MethodName.AcpLocalCommandAdd, new AcpLocalCommandAddParams("Mine", "node", [], []).toJson())).id);
    Assert.isNull(await answer(MethodName.AcpAgentRemove, id));
    Assert.areEqual("add droid,local Mine,remove droid", asked.join(","));

    for (const method of [MethodName.AcpAgentList, MethodName.AcpAgentIcon, MethodName.AcpAgentAdd, MethodName.AcpLocalCommandAdd, MethodName.AcpAgentRemove]) {
      const response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(method === MethodName.AcpLocalCommandAdd ? new AcpLocalCommandAddParams("Mine", "node", [], []).toJson() : id)));

      Assert.areEqual(ErrorCode.UnknownMethod, response.info?.name, method);
      Assert.areEqual(method, response.info?.arguments[0], method);
    }
  }

  @TestMethod
  public async asksAProvidersAdapterForItsTerminalSignInAndHasNoneWhenItCantSay(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const params = new ProviderIdParams(provider.id).toJson();

    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInCommand, params));
    host.adapter.readSignInCommand = () => Promise.resolve(null);
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInCommand, params));
    host.adapter.readSignInCommand = () => Promise.resolve(new ProviderSignInCommand("droid login", {}));
    Assert.areEqual("droid login", ProviderSignInCommand.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderSignInCommand, params)).command);
  }

  @TestMethod
  public async keepsTheSharedMcpServersAndTheirSwitchesAndKnowsNoneWithoutTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const definition = (name: string): SharedMcpServerDefinition => new SharedMcpServerDefinition(name, SharedMcpTransport.Stdio, "npx", [], [], null, [], null);

    const created = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpServerCreate, definition("search").toJson()));
    const updated = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpServerUpdate,
      new SharedMcpServerUpdateParams(created.id, definition("web")).toJson()));
    const on = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpProviderSet,
      new SharedMcpProviderSetParams(created.id, provider.id, true).toJson()));
    const off = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpTeammateSet,
      new SharedMcpTeammateSetParams(created.id, alice.id, SharedMcpSetting.Off).toJson()));
    const listed = (await RequestDispatcherTests.succeed(host, MethodName.SharedMcpServerList, null) as unknown[]).map(t => SharedMcpServerListing.fromJson(t));
    const invalidations = host.listener.count(EventName.StateInvalidated);
    const deleted = await RequestDispatcherTests.succeed(host, MethodName.SharedMcpServerDelete, new SharedMcpServerIdParams(created.id).toJson());

    Assert.areEqual("web", updated.definition.name);
    Assert.areEqual(JSON.stringify([provider.id]), JSON.stringify(on.providerIds));
    Assert.areEqual(SharedMcpSetting.Off, off.settingOf(alice.id));
    Assert.areEqual(JSON.stringify(off.toJson()), JSON.stringify(listed[0]?.server.toJson()));
    Assert.isNull(deleted);
    Assert.areEqual(invalidations + 1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual(0, (await RequestDispatcherTests.succeed(host, MethodName.SharedMcpServerList, null) as unknown[]).length);
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r1", MethodName.SharedMcpServerList, null));
    Assert.areEqual(ErrorCode.UnknownMethod, unsupported.info?.name);
    Assert.areEqual(MethodName.SharedMcpServerList, unsupported.info?.arguments[0]);
  }

  @TestMethod
  public async setsWhereASharedServersVariableTakesItsValueByReferenceAndInvalidatesTheState(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const created = await host.sharedServers.createAsync(new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["GITHUB_TOKEN"], null, [], null));
    const reference = "teamrun.mcpSecret0123456789abcdef0123456789abcdef";
    const invalidations = host.listener.count(EventName.StateInvalidated);

    const saved = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpSecretSet,
      new SharedMcpSecretSetParams(created.id, "GITHUB_TOKEN", reference).toJson()));
    const environment = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpSecretSet,
      new SharedMcpSecretSetParams(created.id, "GITHUB_TOKEN", null).toJson()));

    Assert.areEqual(reference, saved.referenceOf("GITHUB_TOKEN"));
    Assert.isNull(environment.referenceOf("GITHUB_TOKEN"));
    Assert.areEqual(JSON.stringify([reference]), JSON.stringify(host.secrets.removed));
    Assert.areEqual(invalidations + 2, host.listener.count(EventName.StateInvalidated));
  }

  @TestMethod
  public async startsASharedServersSignInInvalidatingTheStateOnceForItsWaitAndSignsItOutInvalidatingIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const created = await host.sharedServers.createAsync(new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [], null,
      true));
    const invalidations = host.listener.count(EventName.StateInvalidated);

    const started = SharedMcpSignInStarted.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpSignInStart,
      new SharedMcpServerIdParams(created.id).toJson()));
    const afterStart = host.listener.count(EventName.StateInvalidated);
    host.signIns.started[0]?.finished(SharedMcpAccess.granted("access-token-5b2e8d", null));
    const signedOut = SharedMcpServer.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SharedMcpSignOut, new SharedMcpServerIdParams(created.id).toJson()));

    Assert.areEqual("https://auth.example.com/authorize?state=1", started.url);
    Assert.areEqual(invalidations + 1, afterStart);
    Assert.isNull(signedOut.signIn);
    Assert.areEqual(invalidations + 3, host.listener.count(EventName.StateInvalidated));
  }

  @TestMethod
  public async listsAndRevokesComputerUseGrantsOnlyWhereTheAppGivesTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Release notes");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope(chat.id, null), new Date("2026-10-29T10:00:00.000Z"))];
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", "iVBORw0KGgo=")]]);
    const controller = new AbortController();

    const answer = await host.dispatcher.dispatch(new Request("r0", MethodName.ComputerUseGrantList, null), controller.signal);
    const listed = RequestDispatcherTests.objects(answer.payload).map(t => ComputerUseGrant.fromJson(t.toJson()));
    const revoked = await RequestDispatcherTests.succeed(host, MethodName.ComputerUseGrantRevoke, new ComputerUseGrantIdParams("g1").toJson());
    const again = await host.dispatcher.dispatch(new Request("r1", MethodName.ComputerUseGrantRevoke, new ComputerUseGrantIdParams("g1").toJson()));
    const without = new RequestDispatcher(host.kinds, host.providers, host.projects, host.conversations, host.messages,
      host.approvals, host.engine, host.teammates, host.events);
    const unsupported = await without.dispatch(new Request("r2", MethodName.ComputerUseGrantList, null));

    Assert.areEqual(JSON.stringify([["g1", "Release notes", "com.example.notes", "Notes", "iVBORw0KGgo="]]),
      JSON.stringify(listed.map(t => [t.id, t.chatTitle, t.app, t.appName, t.appIcon])));
    Assert.isFalse(host.appDescriptions.signals[0]?.aborted ?? true);
    Assert.isNull(revoked);
    Assert.areEqual(0, host.rememberedGrants.grants.length);
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, ["g1"]]), JSON.stringify([again.info?.name, again.info?.arguments]));
    Assert.areEqual(JSON.stringify([ErrorCode.UnknownMethod, MethodName.ComputerUseGrantList]), JSON.stringify([unsupported.info?.name, unsupported.info?.arguments[0]]));
    controller.abort();
    Assert.isTrue(host.appDescriptions.signals[0]?.aborted ?? false);
  }

  @TestMethod
  public async revokesTheComputerUseGrantsOfADeletedChatAndOfEachChatItsProjectTakesWithIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [first, second] = [await host.createConversationAsync(project), await host.createConversationAsync(project)];
    const kept = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const date = new Date("2026-10-29T10:00:00.000Z");
    host.rememberedGrants.grants = [first, second, kept].map((t, i) =>
      new RememberedAppGrant(`g${i + 1}`, "com.example.notes", Resources.formatToolScope(t.id, null), date));

    await RequestDispatcherTests.succeed(host, MethodName.ConversationDelete, new ConversationIdParams(first.id).toJson());
    const afterDelete = host.rememberedGrants.grants.map(t => t.id).join(",");
    await RequestDispatcherTests.succeed(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());

    Assert.areEqual("g2,g3", afterDelete);
    Assert.areEqual("g3", host.rememberedGrants.grants.map(t => t.id).join(","));
  }

  @TestMethod
  public async stopsTheRunningTasksOfATeammateRemovedFromAChatThroughItsProviderAndLeavesItsOtherChatsAndOtherTeammates(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { chat, other, ada, stopped } = await RequestDispatcherTests.teamWithTasks(host);

    await RequestDispatcherTests.succeed(host, MethodName.ConversationRemoveMember, new ConversationMemberParams(chat.id, ada.id).toJson());

    Assert.areEqual(JSON.stringify(["task-1"]), JSON.stringify(stopped));
    Assert.areEqual(JSON.stringify([["run task-2", "Running"], ["run task-1", "Stopped"]]), JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, chat.id)));
    Assert.areEqual(JSON.stringify([["run task-3", "Running"]]), JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, other.id)));
  }

  @TestMethod
  public async stopsADeletedTeammatesRunningTasksInEveryChatThroughItsProviderAndLeavesOtherTeammates(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { chat, other, ada, stopped } = await RequestDispatcherTests.teamWithTasks(host);

    await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(ada.id).toJson());

    Assert.areEqual(JSON.stringify(["task-1", "task-3"]), JSON.stringify(stopped));
    Assert.areEqual(JSON.stringify([["run task-2", "Running"], ["run task-1", "Stopped"]]), JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, chat.id)));
    Assert.areEqual(JSON.stringify([["run task-3", "Stopped"]]), JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, other.id)));
  }

  @TestMethod
  public async stopsAtOnceATaskAReplyReportsAfterItsTeammateWasRemovedFromTheChatOrDeletedEvenWhenTheStopIsRefusedAndKeepsOtherTeammates(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { chat, other, ada, stopped, listeners } = await RequestDispatcherTests.teamWithTasks(host);
    const lateAsync = (listener: ITurnListener, id: string, refused: boolean = false): Promise<void> => listener.onTaskStartedAsync(new TaskStart(id, `run ${id}`, () => {
      stopped.push(id);
      return refused ? Promise.reject(new Error("No such task.")) : Promise.resolve();
    }));

    await RequestDispatcherTests.succeed(host, MethodName.ConversationRemoveMember, new ConversationMemberParams(chat.id, ada.id).toJson());
    await lateAsync(listeners[0]!, "late-1");
    await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(ada.id).toJson());
    await lateAsync(listeners[2]!, "late-2", true);
    await lateAsync(listeners[1]!, "bob-late");

    Assert.areEqual(JSON.stringify(["task-1", "late-1", "task-3", "late-2"]), JSON.stringify(stopped));
    Assert.areEqual(JSON.stringify([["run bob-late", "Running"], ["run task-2", "Running"], ["run task-1", "Stopped"]]),
      JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, chat.id)));
    Assert.areEqual(JSON.stringify([["run task-3", "Stopped"]]), JSON.stringify(await RequestDispatcherTests.tasksOfAsync(host, other.id)));
  }

  @TestMethod
  public async routesTheSubAgentMethodsToTheEngineWhichRefusesATokenOfNoRunningTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const requests = [[MethodName.SubAgentStart, new SubAgentStartParams("gone", "helper", "Check", "Run the tests.").toJson()],
      [MethodName.SubAgentWait, new SubAgentWaitParams("gone", [], 0).toJson()], [MethodName.SubAgentStop, new SubAgentStopParams("gone", "s1").toJson()]] as const;

    const refused = await Promise.all(requests.map(([method, payload]) => host.dispatcher.dispatch(new Request("r", method, payload))));

    Assert.areEqual(JSON.stringify([ErrorCode.Unauthorized, ErrorCode.Unauthorized, ErrorCode.Unauthorized]), JSON.stringify(refused.map(t => t.info?.name)));
  }

  @TestMethod
  public async startsWaitsForAndStopsAHelperOfARunningTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const rows: SubAgent[] = [];
    const waits: SubAgentWaitResult[] = [];
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return signal.aborted ? undefined : new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
      const started = SubAgent.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SubAgentStart,
        new SubAgentStartParams(token, "helper", "Check", "Run the tests.").toJson()));
      Assert.isNotNull(started.toolUseId);
      waits.push(SubAgentWaitResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SubAgentWait, new SubAgentWaitParams(token, [], 0).toJson())));
      rows.push(started, SubAgent.fromJson(await RequestDispatcherTests.succeed(host, MethodName.SubAgentStop,
        new SubAgentStopParams(token, started.toolUseId).toJson())));
      return undefined;
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Check", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([SubAgentStatus.Running, SubAgentStatus.Stopped]), JSON.stringify(rows.map(t => t.status)));
    Assert.areEqual(JSON.stringify([[[], [rows.at(0)?.toolUseId]]]), JSON.stringify(waits.map(t => [t.ended, t.running])));
  }

  private static async teamWithTasks(host: CoreHost): Promise<{ chat: Conversation; other: Conversation; ada: Teammate; stopped: string[];
    listeners: ITurnListener[] }> {
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(project);
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    for (const [conversation, teammate] of [[chat, ada], [chat, bob], [other, ada]] as const)
      await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, teammate.id));
    const stopped: string[] = [];
    const listeners: ITurnListener[] = [];
    let count = 0;
    host.adapter.afterDetails = async () => {
      const listener = host.adapter.lastListener!;
      listeners.push(listener);
      const id = `task-${String(++count)}`;
      await listener.onTaskStartedAsync(new TaskStart(id, `run ${id}`, async () => {
        stopped.push(id);
        await listener.onTaskEndedAsync(new TaskEnd(id, BackgroundTaskStatus.Stopped, 143));
      }));
    };
    for (const [conversation, teammate] of [[chat, ada], [chat, bob], [other, ada]] as const) {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Start the server", null, null, [], [], teammate.id));
      await host.engine.waitForIdle();
    }
    return { chat, other, ada, stopped, listeners };
  }

  private static async tasksOfAsync(host: CoreHost, conversationId: string): Promise<string[][]> {
    return (await host.tasks.listAsync(new ConversationIdParams(conversationId))).map(t => [t.command, t.status]);
  }

  private static async succeed(host: CoreHost, method: MethodName, payload: unknown): Promise<unknown> {
    const response: Response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
    Assert.isFalse(response.hasErrors);
    return response.payload;
  }

  private static outcome(response: Response): string {
    return response.hasErrors ? [response.info?.name, response.info?.arguments[0], response.info?.message].join(" ") : "ok";
  }

  private static objects(value: unknown): readonly JsonReader[] {
    return JsonReader.fromValue({ items: value }).readObjectArray("items");
  }
}
