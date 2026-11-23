/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { request } from "node:http";
import { createServer, type Server } from "node:net";

import "@noldova/context.core";
import { Failure, FailureCode, SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { type IModuleSecrets, MethodFailureException } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EventHub, type ILog, type IOutsideMessages, type ITimer, OutsideReply, OutsideReplyState } from "@noldova/teamrun.core";
import { ErrorCode, Event, EventName, McpServer, McpToolCallParams, McpToolListParams, OutsideConnection } from "@noldova/teamrun.protocol";
import { McpHttpEndpoint, OutsideConnectionMethod, OutsideSessions, Resources } from "@noldova/teamrun.runtime";
import { ServiceException } from "@noldova/teamrun.services";

import { DeclaredSettings } from "../fixtures/declared-settings.fixture.js";
import { RefusingServer } from "../fixtures/refusing-server.fixture.js";

@TestClass
export class OutsideSessionsTests {
  @TestMethod
  public async staysOffByDefaultWithNoTokenAndRefusesEveryToken(): Promise<void> {
    await using rig = new Rig();
    await rig.sessions.startAsync();

    const connection = await rig.sessions.readAsync();

    Assert.areEqual(JSON.stringify(new OutsideConnection(false, `http://127.0.0.1:${Resources.outsideDefaultPort}/mcp`, null, null, null).toJson()), JSON.stringify(connection.toJson()));
    Assert.areEqual(0, rig.endpoints.length);
    Assert.isFalse(rig.sessions.acceptsSessionToken("anything"));
    Assert.areEqual(JSON.stringify(McpServer.toolError(Resources.outsideTokenRefused)),
      JSON.stringify(await rig.sessions.callMcpToolAsync(new McpToolCallParams("anything", Resources.outsideListTool, {}))));
    const refused = await Assert.throwsAsync(() => rig.sessions.listMcpToolsAsync(new McpToolListParams("anything")), ServiceException);
    Assert.areEqual(`${ErrorCode.Unauthorized} ${Resources.outsideTokenRefused}`, `${refused.info.name} ${refused.message}`);
  }

  @TestMethod
  public async makesATokenWhenTurnedOnKeepsItThroughARestartAndServesItsToolsOverHttpOnTheChosenPort(): Promise<void> {
    await using rig = new Rig();
    const port = await Rig.freePortAsync();
    rig.settings.write(Resources.outsidePortSetting, port);
    await rig.sessions.startAsync();

    rig.settings.write(Resources.outsideSessionsSetting, true);
    const connection = await rig.sessions.readAsync();
    const token = String(connection.token);
    const listed = await OutsideSessionsTests.postAsync(connection.url, token, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const refused = await OutsideSessionsTests.postAsync(connection.url, "wrong", { jsonrpc: "2.0", id: 2, method: "tools/list" });
    await rig.sessions.closeAsync();
    await using again = new Rig(rig.settings, rig.secrets);
    await again.sessions.startAsync();
    await again.sessions.readAsync();

    Assert.areEqual(`true http://127.0.0.1:${port}/mcp null`, `${connection.enabled} ${connection.url} ${connection.failure}`);
    Assert.isTrue(/^[A-Za-z0-9_-]{43}$/.test(token));
    Assert.areEqual(token, rig.secrets.saved.get(Resources.outsideTokenSecret));
    Assert.areEqual(200, listed.status);
    Assert.isTrue([Resources.outsideListTool, Resources.outsideSendTool, Resources.outsideReadTool].every(t => listed.body.includes(`"name":"${t}"`)));
    Assert.areEqual(401, refused.status);
    Assert.isTrue(again.sessions.acceptsSessionToken(token));
    Assert.isFalse(again.sessions.acceptsSessionToken("wrong"));
    Assert.areEqual(1, again.secrets.saves);
  }

  @TestMethod
  public async reportsAPortInUseOrOtherwiseRefusedAndListensAgainOnTheNextPort(): Promise<void> {
    await using rig = new Rig();
    using taken = await OutsideSessionsTests.occupyAsync();
    rig.settings.write(Resources.outsidePortSetting, taken.port);
    rig.settings.write(Resources.outsideSessionsSetting, true);
    await rig.sessions.startAsync();
    const inUse = await rig.sessions.readAsync();
    rig.refuses = true;
    rig.settings.write(Resources.outsidePortSetting, "not a port");
    const refused = await rig.sessions.readAsync();
    rig.refuses = false;
    const port = await Rig.freePortAsync();
    rig.settings.write(Resources.outsidePortSetting, port);
    const listening = await rig.sessions.readAsync();
    rig.settings.write(Resources.outsideSessionsSetting, false);
    const off = await rig.sessions.readAsync();

    Assert.areEqual(Resources.formatOutsidePortFailure(taken.port, "EADDRINUSE"), inUse.failure);
    Assert.areEqual(`Port ${taken.port} is in use; choose another in Settings.`, inUse.failure);
    Assert.areEqual(Resources.formatOutsidePortFailure(Resources.outsideDefaultPort, null), refused.failure);
    Assert.isNull(listening.failure);
    Assert.areEqual(`false ${port} null`, `${off.enabled} ${new URL(off.url).port} ${off.failure}`);
    Assert.isFalse(rig.sessions.acceptsSessionToken(String(off.token)));
    Assert.areEqual(2, rig.log.lines.length);
    Assert.areEqual(Resources.formatOutsideNotListening(taken.port, "Error EADDRINUSE"), rig.log.lines[0]);
    Assert.areEqual(Resources.formatOutsideNotListening(Resources.outsideDefaultPort, "Error"), rig.log.lines[1]);
  }

  @TestMethod
  public async staysOffSayingSoWhenTheKeychainCannotBeReadAndListensOnceItCan(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.failure = new Error("The keychain is locked.");
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const refused = await rig.sessions.readAsync();
    const guessed = rig.sessions.acceptsSessionToken("guess");
    rig.secrets.failure = null;
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    const connection = await rig.sessions.readAsync();

    Assert.isTrue(refused.enabled);
    Assert.isNull(refused.token);
    Assert.areEqual(Resources.outsideTokenUnkept, refused.failure);
    Assert.isFalse(guessed);
    Assert.areEqual(Resources.formatOutsideNotApplied("Error"), rig.log.lines.join());
    Assert.isNull(connection.failure);
    Assert.isTrue(rig.sessions.acceptsSessionToken(String(connection.token)));
  }

  @TestMethod
  public async logsAnEndpointThatCantBeMadeAndStillAppliesTheNextChange(): Promise<void> {
    await using rig = new Rig();
    rig.endpointFailure = new Error("No more sockets.");
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    await rig.sessions.readAsync();
    rig.endpointFailure = null;
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    const connection = await rig.sessions.readAsync();

    Assert.areEqual([Resources.formatOutsideNotApplied("Error"), Resources.formatOutsideNotApplied("Error")].join(), rig.log.lines.join());
    Assert.isNull(connection.failure);
    Assert.isTrue(rig.sessions.acceptsSessionToken(String(connection.token)));
  }

  @TestMethod
  public async appliesAgainWithTheKeptTokenWhenTheAppConnectsDuringAFirstReadThatFails(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saved.set(Resources.outsideTokenSecret, "kept");
    const reads = Promise.withResolvers<void>();
    rig.secrets.heldReads = reads.promise;
    rig.secrets.heldFailure = OutsideSessionsTests.secretFailure(SecretFailureReason.NotConnected);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    await Rig.turnsUntilAsync(() => rig.secrets.reads > 0);
    rig.windows.change();
    reads.resolve();
    await Rig.turnsUntilAsync(() => rig.endpoints.length > 0);
    const connection = await rig.sessions.readAsync();
    const listened = await OutsideSessionsTests.postAsync(connection.url, "kept", { jsonrpc: "2.0", id: 1, method: "tools/list" });

    Assert.areEqual("kept null", `${connection.token} ${connection.failure}`);
    Assert.areEqual(200, listened.status);
    Assert.areEqual(1, rig.endpoints.length);
    Assert.areEqual(String.empty, rig.log.lines.join());
  }

  @TestMethod
  public async startsWithoutWaitingOnTheToken(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saved.set(Resources.outsideTokenSecret, "kept");
    const reads = Promise.withResolvers<void>();
    rig.secrets.heldReads = reads.promise;
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);
    let started = false;

    void rig.sessions.startAsync().then(() => { started = true; });
    await Rig.turnsUntilAsync(() => started);
    const acceptedEarly = rig.sessions.acceptsSessionToken("kept");
    reads.resolve();
    const connection = await rig.sessions.readAsync();

    Assert.isTrue(started);
    Assert.isFalse(acceptedEarly);
    Assert.isNull(connection.failure);
    Assert.isTrue(rig.sessions.acceptsSessionToken("kept"));
  }

  @TestMethod
  public async waitsWithNoFailureAfterARestartWhileTheAppIsNotConnectedAndListensWithTheKeptTokenOnceItIs(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saved.set(Resources.outsideTokenSecret, "kept");
    rig.secrets.failure = OutsideSessionsTests.secretFailure(SecretFailureReason.NotConnected);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const waiting = await rig.sessions.readAsync();
    rig.windows.change();
    const stillWaiting = await rig.sessions.readAsync();
    rig.secrets.failure = null;
    rig.windows.change();
    const connection = await rig.sessions.readAsync();
    rig.windows.change();
    await rig.sessions.readAsync();
    const listened = await OutsideSessionsTests.postAsync(connection.url, "kept", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const followed = rig.windows.listeners.size;
    await rig.sessions.closeAsync();

    Assert.areEqual("true null null", `${waiting.enabled} ${waiting.token} ${waiting.failure}`);
    Assert.areEqual("true null", `${stillWaiting.enabled} ${stillWaiting.failure}`);
    Assert.areEqual("kept null", `${connection.token} ${connection.failure}`);
    Assert.areEqual(200, listened.status);
    Assert.areEqual(1, rig.endpoints.length);
    Assert.areEqual(String.empty, rig.log.lines.join());
    Assert.areEqual("1 0", `${followed} ${rig.windows.listeners.size}`);
  }

  @TestMethod
  public async staysOffWithItsOwnMessageWhenTheAppHasNoDeviceIdentityAndListensOnceTheTokenCanBeKept(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.failure = OutsideSessionsTests.secretFailure(SecretFailureReason.NoDevice);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const refused = await rig.sessions.readAsync();
    rig.windows.change();
    const stillRefused = await rig.sessions.readAsync();
    rig.secrets.failure = null;
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    const connection = await rig.sessions.readAsync();

    Assert.areEqual(`true ${Resources.outsideTokenNoDevice}`, `${refused.enabled} ${refused.failure}`);
    Assert.areEqual(Resources.outsideTokenNoDevice, stillRefused.failure);
    Assert.areEqual(1, rig.log.lines.length);
    Assert.isNull(connection.failure);
    Assert.isTrue(rig.sessions.acceptsSessionToken(String(connection.token)));
  }

  @TestMethod
  public async makesAndKeepsANewTokenWhenTheKeptOneCantBeDecryptedListensWithItRefusesTheOldOneAndNotesItOnce(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saved.set(Resources.outsideTokenSecret, "old");
    rig.secrets.heldFailure = OutsideSessionsTests.secretFailure(SecretFailureReason.Undecryptable);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const remade = await rig.sessions.readAsync();
    const shownAgain = (await rig.sessions.readAsync()).note;
    const listened = await OutsideSessionsTests.postAsync(remade.url, String(remade.token), { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const refusesOld = !rig.sessions.acceptsSessionToken("old");
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    const next = await rig.sessions.readAsync();

    Assert.areEqual(`true null ${Resources.outsideTokenRemade} ${Resources.outsideTokenRemade}`, `${remade.enabled} ${remade.failure} ${remade.note} ${shownAgain}`);
    Assert.areNotEqual("old", remade.token);
    Assert.areEqual(remade.token, rig.secrets.saved.get(Resources.outsideTokenSecret));
    Assert.areEqual(200, listened.status);
    Assert.isTrue(refusesOld);
    Assert.areEqual(`${remade.token} null null`, `${next.token} ${next.failure} ${next.note}`);
    Assert.areEqual(String.empty, rig.log.lines.join());
  }

  @TestMethod
  public async notesNoNewTokenWhenTheOneMadeForAnUndecryptableReadCantBeKeptYetAndWaitsForTheApp(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saved.set(Resources.outsideTokenSecret, "old");
    rig.secrets.heldFailure = OutsideSessionsTests.secretFailure(SecretFailureReason.Undecryptable);
    rig.secrets.saveFailure = OutsideSessionsTests.secretFailure(SecretFailureReason.NotConnected);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const waiting = await rig.sessions.readAsync();

    Assert.areEqual("true null null", `${waiting.enabled} ${waiting.failure} ${waiting.note}`);
    Assert.areEqual("old", rig.secrets.saved.get(Resources.outsideTokenSecret));
    Assert.areEqual(0, rig.endpoints.length);
    Assert.areEqual(String.empty, rig.log.lines.join());
  }

  @TestMethod
  public async staysOffWithTheKeyringMessageForAnUnprotectedSaveOrAFailureThatGivesNoReasonWithoutReadingItsMessage(): Promise<void> {
    await using unprotected = new Rig();
    unprotected.secrets.saveFailure = OutsideSessionsTests.secretFailure(SecretFailureReason.Unprotected);
    unprotected.settings.write(Resources.outsideSessionsSetting, true);
    await using unknown = new Rig();
    unknown.secrets.failure = new MethodFailureException(new Failure(FailureCode.Unavailable, "Open TeamRun to use secrets on this machine."));
    unknown.settings.write(Resources.outsideSessionsSetting, true);

    await unprotected.sessions.startAsync();
    await unknown.sessions.startAsync();
    const failures = [(await unprotected.sessions.readAsync()).failure, (await unknown.sessions.readAsync()).failure];
    unknown.windows.change();
    const afterChange = (await unknown.sessions.readAsync()).failure;

    Assert.areEqual([Resources.outsideTokenUnkept, Resources.outsideTokenUnkept, Resources.outsideTokenUnkept].join(), [...failures, afterChange].join());
    Assert.areEqual("1 1", `${unprotected.log.lines.length} ${unknown.log.lines.length}`);
  }

  @TestMethod
  public async closesBeforeStartingWithoutFollowingAnything(): Promise<void> {
    await using rig = new Rig();

    await rig.sessions.closeAsync();

    Assert.areEqual(0, rig.windows.listeners.size);
    Assert.areEqual(0, rig.endpoints.length);
  }

  @TestMethod
  public async staysOffSayingSoWhenNoKeyringCanKeepANewToken(): Promise<void> {
    await using rig = new Rig();
    rig.secrets.saveFailure = new Error("No keyring protects the value.");
    rig.settings.write(Resources.outsideSessionsSetting, true);

    await rig.sessions.startAsync();
    const connection = await rig.sessions.readAsync();

    Assert.isTrue(connection.enabled);
    Assert.isNull(connection.token);
    Assert.areEqual(Resources.outsideTokenUnkept, connection.failure);
    Assert.areEqual(Resources.formatOutsideNotApplied("Error"), rig.log.lines.join());
    Assert.areEqual(0, rig.secrets.saved.size);
    Assert.isFalse(rig.sessions.acceptsSessionToken("guess"));
  }

  @TestMethod
  public async listsSendsAndReadsThroughTheEngineWithAQuotedOneLineLabel(): Promise<void> {
    await using rig = await Rig.onAsync();
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Answered, "Done"));
    const call = (name: string, input: JsonObject): Promise<JsonObject> => rig.sessions.callMcpToolAsync(new McpToolCallParams(rig.token, name, input));

    const tools = await rig.sessions.listMcpToolsAsync(new McpToolListParams(rig.token));
    const listed = await call(Resources.outsideListTool, {});
    const chats = await call(Resources.outsideChatsTool, {});
    const sent = [
      await call(Resources.outsideSendTool, { teammate_id: "t1", text: "Check the build" }),
      await call(Resources.outsideSendTool, { teammate_id: "t1", text: "Again", from: "  Codex\n\u0007on \u202E @alpha\u200B " }),
      await call(Resources.outsideSendTool, { teammate_id: "t1", text: "Long", from: "x".repeat(60) }),
      await call(Resources.outsideSendTool, { teammate_id: "t1", text: "Bare", from: "@\n@" }),
      await call(Resources.outsideSendTool, { chat_id: "c1", text: "Into the plan", from: "Codex" }),
      await call(Resources.outsideSendTool, { chat_id: "c1", teammate_id: "t1", text: "To Alice there" })
    ];
    const read = await call(Resources.outsideReadTool, { message_ids: ["m1", "never"] });
    const unknown = await call("teamrun_delete_everything", {});

    Assert.areEqual(`${Resources.outsideListTool},${Resources.outsideChatsTool},${Resources.outsideSendTool},${Resources.outsideReadTool}`,
      tools.map(t => String(t["name"])).join(","));
    const sendTool = JSON.stringify(tools.find(t => t["name"] === Resources.outsideSendTool));
    Assert.isTrue(sendTool.includes(`"required":["${Resources.textArgument}"]`) && sendTool.includes(`"${Resources.chatIdArgument}":{"type":"string"`));
    Assert.areEqual(OutsideSessionsTests.result(await rig.outside.listOutsideAsync()), JSON.stringify(listed));
    Assert.areEqual(OutsideSessionsTests.result(await rig.outside.listOutsideChatsAsync()), JSON.stringify(chats));
    Assert.areEqual(["m1", "m2", "m3", "m4", "m5", "m6"].map(t => OutsideSessionsTests.result({ message_id: t })).join(), sent.map(t => JSON.stringify(t)).join());
    Assert.areEqual(JSON.stringify(["unnamed session", "Codex on alpha", "x".repeat(40), "unnamed session", "Codex", "unnamed session"]),
      JSON.stringify(rig.outside.sent.map(t => t.label)));
    Assert.areEqual("t1 Check the build null|null Into the plan c1|t1 To Alice there c1",
      [0, 4, 5].map(t => rig.outside.sent[t]).map(t => `${t?.teammateId} ${t?.text} ${t?.chatId}`).join("|"));
    Assert.areEqual(OutsideSessionsTests.result([{ message_id: "m1", state: "answered", reply: "Done" }, { message_id: "never", state: "unknown" }]), JSON.stringify(read));
    Assert.areEqual(JSON.stringify(McpServer.toolError(Resources.formatOutsideToolUnknown("teamrun_delete_everything"))), JSON.stringify(unknown));
  }

  @TestMethod
  public async refusesEachInvalidArgumentAsAToolErrorWithoutSending(): Promise<void> {
    await using rig = await Rig.onAsync();
    const cases: [string, JsonObject, string][] = [
      [Resources.outsideSendTool, { text: "Hi" }, Resources.outsideTeammateRequired],
      [Resources.outsideSendTool, { teammate_id: 7, text: "Hi" }, Resources.outsideTeammateRequired],
      [Resources.outsideSendTool, { teammate_id: " ", text: "Hi" }, Resources.outsideTeammateRequired],
      [Resources.outsideSendTool, { teammate_id: "t1" }, Resources.outsideTextRequired],
      [Resources.outsideSendTool, { teammate_id: "t1", text: " \n" }, Resources.outsideTextRequired],
      [Resources.outsideSendTool, { teammate_id: "t1", text: "x".repeat(Resources.outsideTextLimit + 1) }, Resources.outsideTextRequired],
      [Resources.outsideSendTool, { teammate_id: "t1", text: "Hi", from: 3 }, Resources.outsideFromNotText],
      [Resources.outsideSendTool, { chat_id: 7, text: "Hi" }, Resources.outsideChatRequired],
      [Resources.outsideSendTool, { chat_id: " ", teammate_id: "t1", text: "Hi" }, Resources.outsideChatRequired],
      [Resources.outsideSendTool, { chat_id: "c1", teammate_id: 7, text: "Hi" }, Resources.outsideTeammateRequired],
      [Resources.outsideSendTool, { chat_id: "c1", teammate_id: "", text: "Hi" }, Resources.outsideTeammateRequired],
      [Resources.outsideSendTool, { chat_id: "c1" }, Resources.outsideTextRequired],
      [Resources.outsideReadTool, {}, Resources.outsideIdsRequired],
      [Resources.outsideReadTool, { message_ids: "m1" }, Resources.outsideIdsRequired],
      [Resources.outsideReadTool, { message_ids: [] }, Resources.outsideIdsRequired],
      [Resources.outsideReadTool, { message_ids: ["m1", 2] }, Resources.outsideIdsRequired],
      [Resources.outsideReadTool, { message_ids: Array.from({ length: Resources.outsideReadLimit + 1 }, (_, index) => `m${index}`) }, Resources.outsideIdsRequired],
      [Resources.outsideReadTool, { message_ids: ["m1"], wait_seconds: "5" }, Resources.outsideWaitOutOfRange],
      [Resources.outsideReadTool, { message_ids: ["m1"], wait_seconds: 1.5 }, Resources.outsideWaitOutOfRange],
      [Resources.outsideReadTool, { message_ids: ["m1"], wait_seconds: -1 }, Resources.outsideWaitOutOfRange],
      [Resources.outsideReadTool, { message_ids: ["m1"], wait_seconds: Resources.outsideWaitLimit + 1 }, Resources.outsideWaitOutOfRange]
    ];

    const answers = await Promise.all(cases.map(([name, input]) => rig.sessions.callMcpToolAsync(new McpToolCallParams(rig.token, name, input))));

    Assert.areEqual(cases.map(t => JSON.stringify(McpServer.toolError(t[2]))).join("\n"), answers.map(t => JSON.stringify(t)).join("\n"));
    Assert.areEqual(0, rig.outside.sent.length);
  }

  @TestMethod
  public async answersABusyOrUnknownTeammateAsAToolErrorAndLetsAnyOtherFailureThrough(): Promise<void> {
    await using rig = await Rig.onAsync();
    const send = (): Promise<JsonObject> => rig.sessions.callMcpToolAsync(new McpToolCallParams(rig.token, Resources.outsideSendTool, { teammate_id: "t1", text: "Hi" }));

    const post = (): Promise<JsonObject> => rig.sessions.callMcpToolAsync(new McpToolCallParams(rig.token, Resources.outsideSendTool, { chat_id: "c1", text: "Hi" }));

    rig.outside.failure = new ServiceException(ErrorCode.Conflict, "A reply is in progress.");
    const busy = await send();
    const chatBusy = await post();
    rig.outside.failure = new ServiceException(ErrorCode.NotFound, "No teammate t1.");
    const unknown = await send();
    rig.outside.failure = new ServiceException(ErrorCode.NotFound, "The chat \"c1\" does not exist.");
    const unknownChat = await post();
    rig.outside.failure = new Error("The database is closed.");
    const thrown = await Assert.throwsAsync(send, Error);

    Assert.areEqual(JSON.stringify(McpServer.toolError(Resources.outsideTeammateBusy)), JSON.stringify(busy));
    Assert.areEqual(JSON.stringify(McpServer.toolError(Resources.outsideChatBusy)), JSON.stringify(chatBusy));
    Assert.areEqual(JSON.stringify(McpServer.toolError("No teammate t1.")), JSON.stringify(unknown));
    Assert.areEqual(JSON.stringify(McpServer.toolError("The chat \"c1\" does not exist.")), JSON.stringify(unknownChat));
    Assert.areEqual("The database is closed.", thrown.message);
  }

  @TestMethod
  public async refusesAPostIntoAChatAndItsListOnceTheTokenIsResetOrSessionsAreTurnedOff(): Promise<void> {
    await using rig = await Rig.onAsync();
    const post = (token: string): Promise<JsonObject> => rig.sessions.callMcpToolAsync(new McpToolCallParams(token, Resources.outsideSendTool, { chat_id: "c1", text: "Hi" }));
    const list = (token: string): Promise<JsonObject> => rig.sessions.callMcpToolAsync(new McpToolCallParams(token, Resources.outsideChatsTool, {}));

    const posted = await post(rig.token);
    const reset = await rig.sessions.resetAsync();
    const afterReset = [await post(rig.token), await list(rig.token)];
    rig.settings.write(Resources.outsideSessionsSetting, false);
    await rig.sessions.readAsync();
    const afterOff = [await post(String(reset.token)), await list(String(reset.token))];

    const refused = JSON.stringify(McpServer.toolError(Resources.outsideTokenRefused));
    Assert.areEqual(OutsideSessionsTests.result({ message_id: "m1" }), JSON.stringify(posted));
    Assert.areEqual(Array(4).fill(refused).join(), [...afterReset, ...afterOff].map(t => JSON.stringify(t)).join());
    Assert.areEqual(1, rig.outside.sent.length);
  }

  @TestMethod
  public async waitsForEveryReplyToEndWakingOnEachEventAndAnswersAtOnceWhenAllHaveEndedOrNoWaitIsAsked(): Promise<void> {
    await using rig = await Rig.onAsync();
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Working));
    rig.outside.replies.set("m2", new OutsideReply("m2", OutsideReplyState.Waiting));

    const now = await rig.read(["m1"], 0);
    const ended = await rig.read(["never"], 30);
    const waiting = rig.read(["m1", "m2"], 30);
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Answered, "One"));
    rig.events.publish(new Event(EventName.MessageUpdated, {}));
    await rig.listeningAsync();
    const listeners = rig.events.listenerCount;
    rig.outside.replies.set("m2", new OutsideReply("m2", OutsideReplyState.Failed, "Broke"));
    rig.events.publish(new Event(EventName.MessageUpdated, {}));
    const both = await waiting;

    Assert.areEqual(OutsideSessionsTests.result([{ message_id: "m1", state: "working" }]), JSON.stringify(now));
    Assert.areEqual(OutsideSessionsTests.result([{ message_id: "never", state: "unknown" }]), JSON.stringify(ended));
    Assert.areEqual(1, listeners);
    Assert.areEqual(OutsideSessionsTests.result([{ message_id: "m1", state: "answered", reply: "One" }, { message_id: "m2", state: "failed", error: "Broke" }]),
      JSON.stringify(both));
    Assert.areEqual("30000", rig.timer.delays.map(t => t.milliseconds).join());
    Assert.areEqual(0, rig.events.listenerCount);
    Assert.isTrue(rig.timer.delays.every(t => t.signal.aborted));
  }

  @TestMethod
  public async wakesForAChangeThatLandsWhileItReads(): Promise<void> {
    await using rig = await Rig.onAsync();
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Working));
    rig.outside.onRead = (): void => {
      rig.outside.onRead = () => undefined;
      rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Answered, "One"));
      rig.events.publish(new Event(EventName.MessageUpdated, {}));
    };

    const waiting = rig.read(["m1"], 30);
    await Rig.turnsUntilAsync(() => rig.outside.reads > 1);
    const readsBeforeTimeUp = rig.outside.reads;
    rig.timer.delays[0]?.end();
    const answer = await waiting;

    Assert.areEqual(2, readsBeforeTimeUp);
    Assert.areEqual(OutsideSessionsTests.result([{ message_id: "m1", state: "answered", reply: "One" }]), JSON.stringify(answer));
    Assert.areEqual(0, rig.events.listenerCount);
  }

  @TestMethod
  public async endsAWaitWithWhatItHasWhenItsTimeIsUpTheCallerGoesTheTokenIsResetSessionsTurnOffOrTheAppQuits(): Promise<void> {
    await using rig = await Rig.onAsync();
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Working));
    const working = OutsideSessionsTests.result([{ message_id: "m1", state: "working" }]);
    const caller = new AbortController();

    const timed = rig.read(["m1"], 5);
    rig.timer.delays[0]?.end();
    const abandoned = rig.read(["m1"], 5, caller.signal);
    caller.abort();
    const reset = rig.read(["m1"], 5);
    const connection = await rig.sessions.resetAsync();
    const resetAnswer = await reset;
    const off = rig.read(["m1"], 5, undefined, String(connection.token));
    rig.settings.write(Resources.outsideSessionsSetting, false);
    const offAnswer = await off;
    rig.settings.write(Resources.outsideSessionsSetting, true);
    const token = String((await rig.sessions.readAsync()).token);
    const quit = rig.read(["m1"], 5, undefined, token);
    await rig.sessions.closeAsync();

    Assert.areEqual([working, working, working, working, working].join(), [await timed, await abandoned, resetAnswer, offAnswer, await quit].map(t => JSON.stringify(t)).join());
    Assert.areEqual(0, rig.events.listenerCount);
    Assert.areEqual(1, rig.outside.forgets);
    Assert.areNotEqual(rig.token, connection.token);
    Assert.isFalse(rig.sessions.acceptsSessionToken(rig.token));
    Assert.isFalse(rig.sessions.acceptsSessionToken(token));
    Assert.areEqual(connection.token, token);
  }

  @TestMethod
  public async readsTheRepliesNoMoreOnceAWaitEnds(): Promise<void> {
    await using rig = await Rig.onAsync();
    rig.outside.replies.set("m1", new OutsideReply("m1", OutsideReplyState.Working));

    const timed = rig.read(["m1"], 5);
    await Rig.turnsUntilAsync(() => rig.timer.delays.length === 1);
    rig.timer.delays[0]?.end();
    await timed;
    const timedReads = rig.outside.reads;
    const off = rig.read(["m1"], 5);
    await Rig.turnsUntilAsync(() => rig.timer.delays.length === 2);
    rig.settings.write(Resources.outsideSessionsSetting, false);
    await off;

    Assert.areEqual("1 2", `${timedReads} ${rig.outside.reads}`);
  }

  @TestMethod
  public async appliesASwitchMadeWhileATokenIsResetOnlyAfterTheResetSoTheShownTokenIsTheOneAccepted(): Promise<void> {
    const secrets = new MemorySecrets();
    secrets.saved.set(Resources.outsideTokenSecret, "old");
    await using rig = new Rig(new DeclaredSettings(), secrets);
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    await rig.sessions.startAsync();
    const saves = Promise.withResolvers<void>();
    const reads = Promise.withResolvers<void>();
    secrets.heldSaves = saves.promise;
    secrets.heldReads = reads.promise;
    const before = secrets.reads;

    const reset = rig.sessions.resetAsync();
    rig.settings.write(Resources.outsideSessionsSetting, true);
    await Rig.turnsUntilAsync(() => secrets.reads > before);
    saves.resolve();
    await Rig.turnsUntilAsync(() => rig.outside.forgets > 0);
    reads.resolve();
    const connection = await reset;

    Assert.areNotEqual("old", connection.token);
    Assert.isTrue(rig.sessions.acceptsSessionToken(String(connection.token)));
    Assert.isFalse(rig.sessions.acceptsSessionToken("old"));
  }

  @TestMethod
  public async answersTheConnectionMethodsWithTheConnectionsJson(): Promise<void> {
    const connection = new OutsideConnection(true, "http://127.0.0.1:47391/mcp", "token", null, null);

    const answer = await new OutsideConnectionMethod(() => Promise.resolve(connection)).handleAsync();

    Assert.areEqual(JSON.stringify(connection.toJson()), JSON.stringify(answer));
  }

  private static secretFailure(reason: SecretFailureReason): MethodFailureException {
    return new MethodFailureException(new Failure(FailureCode.Unavailable, "The secret call failed.", SecretFailures.detailsOf(reason)));
  }

  private static result(value: unknown): string {
    return JSON.stringify({ content: [{ type: "text", text: JSON.stringify(value) }] });
  }

  private static occupyAsync(): Promise<{ readonly port: number; [Symbol.dispose](): void }> {
    return new Promise((resolve, reject) => {
      const server: Server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        resolve({ port: typeof address === "object" && address !== null ? address.port : 0, [Symbol.dispose]: () => void server.close() });
      });
    });
  }

  private static postAsync(url: string, token: string, message: object): Promise<{ readonly status: number; readonly body: string }> {
    return new Promise((resolve, reject) => {
      const sent = request(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` }
      }, response => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { text += chunk; });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, body: text }));
      });
      sent.on("error", reject);
      sent.end(JSON.stringify(message));
    });
  }
}

class Rig implements AsyncDisposable {
  public readonly settings: DeclaredSettings;
  public readonly secrets: MemorySecrets;
  public readonly outside: FakeOutside = new FakeOutside();
  public readonly events: EventHub = new EventHub();
  public readonly timer: HeldTimer = new HeldTimer();
  public readonly log: RecordingLog = new RecordingLog();
  public readonly windows: FakeAppWindows = new FakeAppWindows();
  public readonly endpoints: McpHttpEndpoint[] = [];
  public readonly sessions: OutsideSessions;
  public refuses: boolean = false;
  public endpointFailure: Error | null = null;
  public token: string = String.empty;

  public constructor(settings: DeclaredSettings = new DeclaredSettings(), secrets: MemorySecrets = new MemorySecrets()) {
    this.settings = settings;
    this.secrets = secrets;
    this.sessions = new OutsideSessions(settings, secrets, this.outside, this.events, this.timer, () => this.endpoint(), this.log, this.windows);
  }

  public static async onAsync(): Promise<Rig> {
    const rig = new Rig();
    rig.settings.write(Resources.outsidePortSetting, await Rig.freePortAsync());
    rig.settings.write(Resources.outsideSessionsSetting, true);
    await rig.sessions.startAsync();
    rig.token = String((await rig.sessions.readAsync()).token);
    return rig;
  }

  public static freePortAsync(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
  }

  public static async turnsUntilAsync(condition: () => boolean): Promise<void> {
    for (let turn = 0; turn < 100 && !condition(); turn++)
      await Promise.resolve();
  }

  public async listeningAsync(): Promise<void> {
    for (let turn = 0; turn < 100 && this.events.listenerCount === 0; turn++)
      await Promise.resolve();
  }

  public read(ids: readonly string[], seconds: number, signal?: AbortSignal, token: string = this.token): Promise<JsonObject> {
    return this.sessions.callMcpToolAsync(new McpToolCallParams(token, Resources.outsideReadTool, { message_ids: [...ids], wait_seconds: seconds }), signal);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.sessions.closeAsync();
  }

  private endpoint(): McpHttpEndpoint {
    if (!Object.isNull(this.endpointFailure))
      throw this.endpointFailure;
    const endpoint = this.refuses ? new McpHttpEndpoint(this.log, new RefusingServer()) : new McpHttpEndpoint(this.log);
    this.endpoints.push(endpoint);
    return endpoint;
  }
}

class FakeOutside implements IOutsideMessages {
  public readonly sent: { readonly teammateId: string | null; readonly text: string; readonly label: string; readonly chatId: string | null }[] = [];
  public readonly replies: Map<string, OutsideReply> = new Map();
  public failure: Error | null = null;
  public forgets: number = 0;
  public reads: number = 0;
  public onRead: () => void = () => undefined;

  public async listOutsideAsync(): Promise<readonly JsonObject[]> {
    return [{ id: "t1", name: "Alice", provider: "codex", model: null, state: "idle" }];
  }

  public async listOutsideChatsAsync(): Promise<readonly JsonObject[]> {
    return [{ id: "c1", title: "Release plan", project: "alpha", teammate: { id: "t1", name: "Alice" }, teammates: [{ id: "t1", name: "Alice" }], state: "idle" }];
  }

  public sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId: string | null = null): Promise<string> {
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    this.sent.push({ teammateId, text, label, chatId });
    return Promise.resolve(`m${this.sent.length}`);
  }

  public async readOutsideAsync(messageId: string): Promise<OutsideReply> {
    const reply = this.replies.get(messageId) ?? new OutsideReply(messageId, OutsideReplyState.Unknown);
    this.reads++;
    this.onRead();
    return reply;
  }

  public async forgetOutsideAsync(): Promise<void> {
    this.forgets++;
  }
}

class MemorySecrets implements IModuleSecrets {
  public readonly saved: Map<string, string> = new Map();
  public failure: Error | null = null;
  public saveFailure: Error | null = null;
  public heldFailure: Error | null = null;
  public saves: number = 0;
  public reads: number = 0;
  public heldSaves: Promise<void> = Promise.resolve();
  public heldReads: Promise<void> = Promise.resolve();

  public async saveAsync(name: string, value: string): Promise<void> {
    if (!Object.isNull(this.saveFailure))
      throw this.saveFailure;
    await this.heldSaves;
    this.saved.set(name, value);
    this.saves++;
  }

  public async readAsync(name: string): Promise<string | null> {
    if (!Object.isNull(this.failure))
      throw this.failure;
    this.reads++;
    const value = this.saved.get(name) ?? null;
    await this.heldReads;
    const failure = this.heldFailure;
    this.heldFailure = null;
    if (!Object.isNull(failure))
      throw failure;
    return value;
  }

  public removeAsync(name: string): Promise<void> {
    this.saved.delete(name);
    return Promise.resolve();
  }

  public isSetAsync(name: string): Promise<boolean> {
    return Promise.resolve(this.saved.has(name));
  }
}

class HeldTimer implements ITimer {
  public readonly delays: { readonly milliseconds: number; readonly signal: AbortSignal; readonly end: () => void }[] = [];

  public now(): number {
    return 0;
  }

  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      this.delays.push({ milliseconds, signal, end: resolve });
      signal.addEventListener("abort", () => reject(signal.reason));
    });
  }
}

class FakeAppWindows {
  public readonly listeners: Set<() => void> = new Set();

  public onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  public change(): void {
    for (const listener of [...this.listeners])
      listener();
  }
}

class RecordingLog implements ILog {
  public readonly lines: string[] = [];

  public write(message: string): void {
    this.lines.push(message);
  }
}
