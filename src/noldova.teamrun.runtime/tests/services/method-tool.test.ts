/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import {
  type IMethodHandler,
  type IToolCallPermissions,
  MethodFailureException,
  PermissionDecision,
  type RequestContext,
  ToolCall,
  ToolFailureException
} from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { Conversation, Teammate } from "@noldova/teamrun.protocol";
import { MethodTool, TeamRunChanges } from "@noldova/teamrun.runtime";

import { ChangeServices } from "../fixtures/change-services.fixture.js";
import { ScriptedPermissions } from "../fixtures/scripted-permissions.fixture.js";

@TestClass
export class MethodToolTests {
  @TestMethod
  public async makesALowRiskChangeWithoutAskingAndAnswersWithTheMethodsResult(): Promise<void> {
    const services = new ChangeServices();
    const handler = new RecordingMethod(() => Promise.resolve({ id: "c9", title: "Plans" }));
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const call = MethodToolTests.callOf("c1/t1", { project_id: "p1" }, permissions);

    const created = await MethodToolTests.toolOf("teamrun_create_chat", services, handler).handleAsync(call);
    const renamed = await MethodToolTests.toolOf("teamrun_rename_chat", services, new RecordingMethod(() => Promise.resolve(null)))
      .handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: "c2", title: "Known bugs" }, permissions));

    Assert.areEqual(JSON.stringify([{ title: null, projectId: "p1" }]), JSON.stringify(handler.payloads));
    Assert.areEqual(JSON.stringify(["teamrun.tools", 0]), JSON.stringify([handler.contexts[0]!.client, handler.contexts[0]!.connection]));
    Assert.isTrue(handler.contexts[0]!.signal === call.signal);
    Assert.areEqual(0, permissions.requests.length);
    Assert.isTrue(call.hasMarkedSending);
    Assert.areEqual(JSON.stringify({ id: "c9", title: "Plans" }), created.content[0]!.value);
    Assert.isTrue(created.content[0]!.isUntrusted);
    Assert.areEqual("Done.", renamed.content[0]!.value);
  }

  @TestMethod
  public async startsAChatWithoutAProjectWhenNoneIsNamedAndNamesNoArgumentAsRequired(): Promise<void> {
    const services = new ChangeServices();
    const handler = new RecordingMethod(() => Promise.resolve({ id: "c9", title: "Scratch", projectId: null }));
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const tool = MethodToolTests.toolOf("teamrun_create_chat", services, handler);
    const change = TeamRunChanges.all.find(t => t.descriptor.name === "teamrun_create_chat");
    Assert.isDefined(change);
    const schema = JSON.stringify(change.descriptor.inputSchema);

    await tool.handleAsync(MethodToolTests.callOf("c1/t1", {}, permissions));
    await tool.handleAsync(MethodToolTests.callOf("c1/t1", { title: "Scratch" }, permissions));

    Assert.areEqual(JSON.stringify([{ title: null, projectId: null }, { title: "Scratch", projectId: null }]), JSON.stringify(handler.payloads));
    Assert.isTrue(schema.includes("\"required\":[]"), schema);
    Assert.areEqual(0, permissions.requests.length);
  }

  @TestMethod
  public async asksForEachRiskyChangeWithItsTitleAndDetailsBeforeCallingItsMethod(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const cases: readonly [string, JsonObject][] = [
      ["teamrun_forget_project", { project_id: "p2" }],
      ["teamrun_delete_chat", { chat_id: "c3" }],
      ["teamrun_remove_teammate_from_chat", { chat_id: "c2", teammate_id: "t2" }],
      ["teamrun_cancel_replies", { chat_id: "c2" }],
      ["teamrun_create_teammate", { name: "Cy", provider_id: "v2", model: "m3" }],
      ["teamrun_update_teammate", { teammate_id: "t2", name: "Bea", effort: "low" }],
      ["teamrun_delete_teammate", { teammate_id: "t2" }]
    ];

    const handler = new RecordingMethod(() => Promise.resolve(null));
    for (const [tool, input] of cases)
      await MethodToolTests.toolOf(tool, services, handler).handleAsync(MethodToolTests.callOf("c1/t1", input, permissions));

    Assert.areEqual(cases.length, handler.payloads.length);
    Assert.areEqual(JSON.stringify([
      ["teamrun.forgetProject", "p2", "Forget the project \"Docs\" and delete its chat", "High", ["AllowOnce", "Deny"],
        [["Project", "Text", "Docs"], ["Folder", "Code", "/work/docs"], ["Chats", "Text", "1"]]],
      ["teamrun.deleteChat", "c3", "Delete the chat \"Guide\"", "High", ["AllowOnce", "Deny"], [["Chat", "Text", "Guide"], ["Project", "Text", "Docs"]]],
      ["teamrun.removeTeammateFromChat", "c2.t2", "Remove Bo from the chat \"Bugs\"", "Medium", ["AllowOnce", "Deny"],
        [["Teammate", "Text", "Bo"], ["Chat", "Text", "Bugs"]]],
      ["teamrun.cancelReplies", "c2", "Stop the replies in the chat \"Bugs\"", "Medium", ["AllowOnce", "Deny"], [["Chat", "Text", "Bugs"], ["Project", "Text", "Site"]]],
      ["teamrun.createTeammate", "Cy", "Add the teammate Cy", "Medium", ["AllowOnce", "Deny"],
        [["Name", "AgentText", "Cy"], ["Provider", "Text", "Codex"], ["Model", "AgentText", "m3"]]],
      ["teamrun.updateTeammate", "t2", "Change the teammate Bo", "Medium", ["AllowOnce", "Deny"],
        [["Teammate", "Text", "Bo"], ["Name", "AgentText", "Bea"], ["Provider", "Text", "Claude"], ["Effort", "AgentText", "low"]]],
      ["teamrun.deleteTeammate", "t2", "Delete the teammate Bo", "High", ["AllowOnce", "Deny"], [["Teammate", "Text", "Bo"]]]
    ]), JSON.stringify(permissions.requests.map(t => [t.action, t.subject, t.title, t.risk, t.options, t.details.map(u => [u.label, u.kind, u.value])])));
  }

  @TestMethod
  public async showsATeammatesRoleAndWhatItsChangeKeepsAsTheTeammatesOwn(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const handler = new RecordingMethod(() => Promise.resolve(null));

    await MethodToolTests.toolOf("teamrun_update_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { teammate_id: "t1", role: "Lead" }, permissions));
    await MethodToolTests.toolOf("teamrun_delete_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { teammate_id: "t1" }, permissions));
    await MethodToolTests.toolOf("teamrun_create_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { name: "Di", role: "Tester", provider_id: "v1", effort: "high" }, permissions));

    Assert.areEqual(JSON.stringify([
      [["Teammate", "Text", "Ada"], ["Name", "Text", "Ada"], ["Role", "AgentText", "Lead"], ["Provider", "Text", "Claude"], ["Model", "Text", "m1"],
        ["Effort", "Text", "high"]],
      [["Teammate", "Text", "Ada"], ["Role", "Text", "Reviewer"]],
      [["Name", "AgentText", "Di"], ["Role", "AgentText", "Tester"], ["Provider", "Text", "Claude"], ["Effort", "AgentText", "high"]]
    ]), JSON.stringify(permissions.requests.map(t => t.details.map(u => [u.label, u.kind, u.value]))));
    Assert.areEqual(JSON.stringify([
      { role: "Lead", teammateId: "t1" },
      { teammateId: "t1" },
      { role: "Tester", harness: "Provider", model: null, effort: "high", name: "Di", providerId: "v1" }
    ]), JSON.stringify(handler.payloads));
  }

  @TestMethod
  public async sendsOnlyWhatAnUpdateNamesClearingTheSpeedWithAModelOrProviderAndTheModeWithAProviderReadOnTheTeammatesProvider(): Promise<void> {
    const services = new ChangeServices();
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const tool = MethodToolTests.toolOf("teamrun_update_teammate", services, handler);
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);

    await tool.handleAsync(MethodToolTests.callOf("c1/t2", { teammate_id: "t1", model: "m2" }, permissions));
    await tool.handleAsync(MethodToolTests.callOf("c1/t2", { teammate_id: "t1", provider_id: "v2" }, permissions));
    await tool.handleAsync(MethodToolTests.callOf("c1/t2", { teammate_id: "t9", name: "Ghost" }, permissions));

    Assert.areEqual(JSON.stringify([
      { speed: null, expectedProviderId: "v1", model: "m2", teammateId: "t1" },
      { speed: null, mode: null, contextWindow: null, expectedProviderId: "v1", providerId: "v2", teammateId: "t1" },
      { name: "Ghost", teammateId: "t9" }
    ]), JSON.stringify(handler.payloads));
    Assert.areEqual(2, permissions.requests.length);
  }

  @TestMethod
  public async sendsAndShowsTheContextWindowACallNamesAndTheOneAnUpdateKeeps(): Promise<void> {
    const services = new ChangeServices();
    services.teammates[0] = { ...services.teammates[0], contextWindow: 200_000 } as Teammate;
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);

    await MethodToolTests.toolOf("teamrun_create_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { name: "Di", provider_id: "v1", context_window: 1_000_000 }, permissions));
    await MethodToolTests.toolOf("teamrun_update_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { teammate_id: "t2", context_window: 150_000 }, permissions));
    await MethodToolTests.toolOf("teamrun_update_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { teammate_id: "t1", context_window: null }, permissions));
    await MethodToolTests.toolOf("teamrun_update_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/default", { teammate_id: "t1", name: "Ava" }, permissions));

    const ada = [["Role", "Text", "Reviewer"], ["Provider", "Text", "Claude"], ["Model", "Text", "m1"], ["Effort", "Text", "high"]];
    Assert.areEqual(JSON.stringify([
      [["Name", "AgentText", "Di"], ["Provider", "Text", "Claude"], ["Context window", "AgentText", "1,000,000 tokens"]],
      [["Teammate", "Text", "Bo"], ["Name", "Text", "Bo"], ["Provider", "Text", "Claude"], ["Context window", "AgentText", "150,000 tokens"]],
      [["Teammate", "Text", "Ada"], ["Name", "Text", "Ada"], ...ada],
      [["Teammate", "Text", "Ada"], ["Name", "AgentText", "Ava"], ...ada, ["Context window", "Text", "200,000 tokens"]]
    ]), JSON.stringify(permissions.requests.map(t => t.details.map(u => [u.label, u.kind, u.value]))));
    Assert.areEqual(JSON.stringify([
      { role: null, harness: "Provider", model: null, effort: null, name: "Di", providerId: "v1", contextWindow: 1_000_000 },
      { expectedProviderId: "v1", contextWindow: 150_000, teammateId: "t2" },
      { expectedProviderId: "v1", contextWindow: null, teammateId: "t1" },
      { name: "Ava", teammateId: "t1" }
    ]), JSON.stringify(handler.payloads));
  }

  @TestMethod
  public async asksBeforeChangingATeammateWhoseProviderWasDeletedShowingItHasNone(): Promise<void> {
    const services = new ChangeServices();
    services.providers.splice(0, 1);
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const permissions = new ScriptedPermissions(() => PermissionDecision.Denied);

    await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_update_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/t1", { teammate_id: "t2", name: "Bea" }, permissions)), ToolFailureException);

    Assert.areEqual(JSON.stringify([["Teammate", "Text", "Bo"], ["Name", "AgentText", "Bea"], ["Provider", "Text", "No provider"]]),
      JSON.stringify(permissions.requests.map(t => t.details.map(u => [u.label, u.kind, u.value]))[0]));
    Assert.areEqual(0, handler.payloads.length);
  }

  @TestMethod
  public async stopsTheRepliesOfItsOwnChatWithoutAsking(): Promise<void> {
    const permissions = new ScriptedPermissions(() => PermissionDecision.Denied);
    const handler = new RecordingMethod(() => Promise.resolve(null));

    await MethodToolTests.toolOf("teamrun_cancel_replies", new ChangeServices(), handler)
      .handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: "c1" }, permissions));

    Assert.areEqual(0, permissions.requests.length);
    Assert.areEqual(JSON.stringify([{ chatId: "c1" }]), JSON.stringify(handler.payloads));
  }

  @TestMethod
  public async refusesTheChangesItsCallersReplyCouldntRecord(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const cases: readonly [string, JsonObject, string][] = [
      ["teamrun_forget_project", { project_id: "p1" }, "A teammate can't forget the project of the chat it is answering in, since its reply couldn't record the result."],
      ["teamrun_delete_chat", { chat_id: "c1" }, "A teammate can't delete the chat it is answering in, since its reply couldn't record the result."],
      ["teamrun_delete_chat", { chat_id: "c2" },
        "A teammate can't delete a chat in the project it is answering in, since TeamRun changes no chat of a project while a turn runs there."],
      ["teamrun_remove_teammate_from_chat", { chat_id: "c1", teammate_id: "t1" },
        "A teammate can't remove itself from the chat it is answering in, since its reply couldn't record the result."],
      ["teamrun_delete_teammate", { teammate_id: "t1" }, "A teammate can't delete itself while it answers, since its reply couldn't record the result."]
    ];

    for (const [tool, input, message] of cases) {
      const call = MethodToolTests.callOf("c1/t1", input, permissions);
      const failure = await Assert.throwsAsync(() => MethodToolTests.toolOf(tool, services, handler).handleAsync(call), ToolFailureException);
      Assert.areEqual(`Refused ${message}`, `${failure.failure.code} ${failure.failure.message}`);
      Assert.isFalse(call.hasMarkedSending);
    }
    for (const [tool, input] of [["teamrun_remove_teammate_from_chat", { chat_id: "c1", teammate_id: "t1" }], ["teamrun_delete_teammate", { teammate_id: "t1" }],
      ["teamrun_forget_project", { project_id: "p1" }], ["teamrun_delete_chat", { chat_id: "c3" }], ["teamrun_delete_chat", { chat_id: "missing" }]] as const)
      await MethodToolTests.toolOf(tool, services, handler).handleAsync(MethodToolTests.callOf(tool === "teamrun_forget_project" ? "gone/t1" : "c1/default", input,
        permissions));
    await MethodToolTests.toolOf("teamrun_delete_chat", services, handler).handleAsync(MethodToolTests.callOf("gone/t1", { chat_id: "c2" }, permissions));

    Assert.areEqual(6, handler.payloads.length);
    Assert.areEqual(5, permissions.requests.length);
  }

  @TestMethod
  public async letsAChatWithoutAProjectChangeAnotherSuchChatOrAProjectAndShowsNoProjectForIt(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const handler = new RecordingMethod(() => Promise.resolve(null));

    await MethodToolTests.toolOf("teamrun_delete_chat", services, handler).handleAsync(MethodToolTests.callOf("c4/t1", { chat_id: "c5" }, permissions));
    await MethodToolTests.toolOf("teamrun_forget_project", services, handler).handleAsync(MethodToolTests.callOf("c4/t1", { project_id: "p1" }, permissions));
    await MethodToolTests.toolOf("teamrun_cancel_replies", services, handler).handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: "c4" }, permissions));

    Assert.areEqual(3, handler.payloads.length);
    Assert.areEqual(JSON.stringify([["c5", "Delete the chat \"Scratch\" and the 3 files it holds", [["Chat", "Text", "Scratch"], ["Files", "Text", "3"]]],
      ["p1", "Forget the project \"Site\" and delete its 2 chats", [["Project", "Text", "Site"], ["Folder", "Code", "/work/site"], ["Chats", "Text", "2"]]],
      ["c4", "Stop the replies in the chat \"Notes\"", [["Chat", "Text", "Notes"]]]]),
    JSON.stringify(permissions.requests.map(t => [t.subject, t.title, t.details.map(u => [u.label, u.kind, u.value])])));
  }

  @TestMethod
  public async refusesToMoveAChatWithoutAProjectWhoseFolderHoldsFilesAndMovesAnEmptyOneAChatOfAProjectOrPassesAnUnknownOneOn(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const call = MethodToolTests.callOf("c1/t1", { chat_id: "c5", project_id: "p1" }, permissions);

    const failure = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_move_chat", services, handler).handleAsync(call), ToolFailureException);
    for (const chatId of ["c4", "c3", "missing"])
      await MethodToolTests.toolOf("teamrun_move_chat", services, handler).handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: chatId, project_id: "p1" }, permissions));

    Assert.areEqual("Refused A teammate can't move a chat without a project whose folder holds files; the person moves it with Move to project… in TeamRun's window, which asks first.", `${failure.failure.code} ${failure.failure.message}`);
    Assert.isFalse(call.hasMarkedSending);
    Assert.areEqual("c4,c3,missing", handler.payloads.map(t => t["chatId"]).join(","));
  }

  @TestMethod
  public async failsWithoutChangingWhenThePersonDoesntAllowIt(): Promise<void> {
    const cases: readonly [PermissionDecision, string][] = [
      [PermissionDecision.Denied, "Denied The person didn't allow it, so nothing changed."],
      [PermissionDecision.DeniedAlways, "Denied The person didn't allow it, so nothing changed."],
      [PermissionDecision.Expired, "Expired Nobody answered in time, so nothing changed."],
      [PermissionDecision.Withdrawn, "Withdrawn The call ended before the person answered, so nothing changed."]
    ];
    const handler = new RecordingMethod(() => Promise.resolve(null));

    for (const [decision, expected] of cases) {
      const call = MethodToolTests.callOf("c1/t1", { chat_id: "c3" }, new ScriptedPermissions(() => decision));
      const failure = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_chat", new ChangeServices(), handler).handleAsync(call),
        ToolFailureException);
      Assert.areEqual(expected, `${failure.failure.code} ${failure.failure.message}`);
      Assert.isFalse(call.hasMarkedSending);
    }

    Assert.areEqual(0, handler.payloads.length);
  }

  @TestMethod
  public async failsAsStaleWhenWhatThePersonAllowedChangedOrWentFirst(): Promise<void> {
    const services = new ChangeServices();
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const renaming = new ScriptedPermissions(() => {
      services.chats[2] = { ...services.chats[2]!, title: "Handbook" } as Conversation;
      return PermissionDecision.AllowedOnce;
    });
    const removing = new ScriptedPermissions(() => {
      services.teammates.splice(1, 1);
      return PermissionDecision.AllowedOnce;
    });
    const adding = new ScriptedPermissions(() => {
      services.folderFiles.set("c5", 4);
      return PermissionDecision.AllowedOnce;
    });

    const renamed = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_chat", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: "c3" }, renaming)), ToolFailureException);
    const removed = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_teammate", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/t1", { teammate_id: "t2" }, removing)), ToolFailureException);
    const added = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_chat", services, handler)
      .handleAsync(MethodToolTests.callOf("c4/t1", { chat_id: "c5" }, adding)), ToolFailureException);

    for (const failure of [renamed, removed, added])
      Assert.areEqual("Stale What the person allowed changed before TeamRun acted, so nothing changed.", `${failure.failure.code} ${failure.failure.message}`);
    Assert.areEqual(0, handler.payloads.length);
  }

  @TestMethod
  public async refusesADeleteOrMoveWhoseChatsFilesCantBeCountedAtTheAskTheCheckAfterItOrTheGuard(): Promise<void> {
    const services = new ChangeServices();
    const handler = new RecordingMethod(() => Promise.resolve(null));
    const counting = services.countFiles;
    const unreadable = (): number => {
      throw new Error("EACCES: permission denied, scandir");
    };
    const asking = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const breaking = new ScriptedPermissions(() => {
      services.countFiles = unreadable;
      return PermissionDecision.AllowedOnce;
    });

    services.countFiles = unreadable;
    const asked = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_chat", services, handler)
      .handleAsync(MethodToolTests.callOf("c4/t1", { chat_id: "c5" }, asking)), ToolFailureException);
    const guarded = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_move_chat", services, handler)
      .handleAsync(MethodToolTests.callOf("c1/t1", { chat_id: "c5", project_id: "p1" }, asking)), ToolFailureException);
    services.countFiles = counting;
    const checked = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_delete_chat", services, handler)
      .handleAsync(MethodToolTests.callOf("c4/t1", { chat_id: "c5" }, breaking)), ToolFailureException);

    for (const failure of [asked, guarded, checked])
      Assert.areEqual("Refused Couldn't count the chat's files, so nothing changed.", `${failure.failure.code} ${failure.failure.message}`);
    Assert.areEqual("0 1 0", `${asking.requests.length} ${breaking.requests.length} ${handler.payloads.length}`);
  }

  @TestMethod
  public async leavesAChangeWhoseSubjectIsGoneForItsMethodToRefuse(): Promise<void> {
    const services = new ChangeServices();
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const missing = new RecordingMethod(() => Promise.reject(new MethodFailureException(new Failure(FailureCode.NotFound, "No such item."))));
    const cases: readonly [string, JsonObject][] = [
      ["teamrun_forget_project", { project_id: "p9" }], ["teamrun_delete_chat", { chat_id: "c9" }],
      ["teamrun_remove_teammate_from_chat", { chat_id: "c9", teammate_id: "t1" }], ["teamrun_remove_teammate_from_chat", { chat_id: "c1", teammate_id: "t9" }],
      ["teamrun_remove_teammate_from_chat", { chat_id: "c1", teammate_id: "t2" }], ["teamrun_create_teammate", { name: "Cy", provider_id: "v9" }],
      ["teamrun_update_teammate", { teammate_id: "t1", provider_id: "v9" }], ["teamrun_delete_teammate", { teammate_id: "t9" }]
    ];

    for (const [tool, input] of cases) {
      const failure = await Assert.throwsAsync(() => MethodToolTests.toolOf(tool, services, missing)
        .handleAsync(MethodToolTests.callOf("c2/t2", input, permissions)), ToolFailureException);
      Assert.areEqual("OutcomeUncertain teamrun.notFound No such item.", `${failure.failure.code} ${failure.failure.moduleCode} ${failure.failure.message}`);
    }

    Assert.areEqual(0, permissions.requests.length);
    Assert.areEqual(cases.length, missing.payloads.length);
  }

  @TestMethod
  public async reportsAMethodsFailureAsUncertainSinceItCameAfterThePointOfNoReturn(): Promise<void> {
    const permissions = new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
    const cases: readonly [unknown, string][] = [
      [new MethodFailureException(new Failure(FailureCode.Conflict, "Taken.")), "OutcomeUncertain teamrun.conflict Taken."],
      [new MethodFailureException(new Failure(FailureCode.Unavailable, "Closing.")), "OutcomeUncertain teamrun.unavailable Closing."],
      [new Error("Broken."), "OutcomeUncertain null Broken."],
      ["Lost.", "OutcomeUncertain null Lost."]
    ];

    for (const [error, expected] of cases) {
      const call = MethodToolTests.callOf("c1/t1", { chat_id: "c2", title: "Known bugs" }, permissions);
      const failure = await Assert.throwsAsync(() => MethodToolTests.toolOf("teamrun_rename_chat", new ChangeServices(),
        new RecordingMethod(() => Promise.reject(error))).handleAsync(call), ToolFailureException);
      Assert.areEqual(expected, `${failure.failure.code} ${String(failure.failure.moduleCode ?? null)} ${failure.failure.message}`);
      Assert.isTrue(call.hasMarkedSending);
    }
  }

  private static toolOf(name: string, services: ChangeServices, handler: IMethodHandler): MethodTool {
    return new MethodTool("teamrun", TeamRunChanges.all.find(t => t.descriptor.name === name)!, handler, services.createSubjects(),
      services.conversationsService);
  }

  private static callOf(scope: string, input: JsonObject, permissions: IToolCallPermissions): ToolCall {
    return new ToolCall("s1", scope, {}, input, 30_000, new AbortController().signal, permissions);
  }
}

class RecordingMethod implements IMethodHandler {
  public readonly contexts: RequestContext[] = [];
  private readonly answer: () => Promise<JsonValue>;

  public constructor(answer: () => Promise<JsonValue>) {
    this.answer = answer;
  }

  public get payloads(): JsonObject[] {
    return this.contexts.map(t => t.payload as JsonObject);
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.contexts.push(context);
    return this.answer();
  }
}
