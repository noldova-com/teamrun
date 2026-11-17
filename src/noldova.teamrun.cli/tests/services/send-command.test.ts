/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Readable } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ArgumentException } from "@noldova/context.exceptions";
import { CliCommandException, UsageException } from "@noldova/desktop.cli";
import {
  AbilityCell, AbilitySource, AuthStatus, DefaultTeammate, DetailKind, MessageSendParams, MessageSendResult, MessageStatus, Provider, ProviderAbilities, ProviderAbility,
  ProviderKind, ProviderListModelsParams, ProviderModel, ProviderModelList, ProviderSpeed, RequestedSettings
} from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class SendCommandTests {
  @TestMethod
  public async sendsToTheMentionedTeammatesAndPrintsTheMessageAndReplyIds(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync());

    const result = await context.runAsync("teamrun.send", { chatId: "c1", text: ["@Chat", "GPT", "and", "@alice,", "look"], kind: "codex", provider: "a1" });

    Assert.areEqual("Sent message m1; replies: m2, m3", result.text);
    const params = SendCommandTests.sent(context);
    Assert.areEqual("@Chat GPT and @alice, look", params.text);
    Assert.areEqual("t2,t1", params.mentionedTeammateIds.join(","));
    Assert.isNull(params.requested);
    Assert.isNull(params.providerId);
    Assert.isNull(params.responderTeammateId);
  }

  @TestMethod
  public async sendsToTheNamedTeammateWhateverTheCase(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Check", "this"], teammate: "chat  gpt", kind: "codex" });

    const params = SendCommandTests.sent(context);
    Assert.areEqual("t2", params.responderTeammateId);
    Assert.areEqual(0, params.mentionedTeammateIds.length);
    Assert.isNull(params.requested);
  }

  @TestMethod
  public async sendsTheMessageItReadsFromStandardInputForADash(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({}, "﻿\"Ship it\", 100% done!\r\n$HOME and %PATH% stay\r\n\r\n"));

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["-"], teammate: "Alice" });

    const params = SendCommandTests.sent(context);
    Assert.areEqual("\"Ship it\", 100% done!\n$HOME and %PATH% stay\n", params.text);
    Assert.areEqual("t1", params.responderTeammateId);
  }

  @TestMethod
  public async refusesToWaitOnATerminalForTheMessage(): Promise<void> {
    const terminal = Object.assign(Readable.from([]), { isTTY: true });
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({}, terminal));

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["-"], teammate: "Alice" }), UsageException);

    Assert.areEqual("- reads the message from standard input, which is a terminal here: "
      + "pipe the message in, such as from a quoted here-document (<<'EOF', the message, then EOF).", error.message);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async refusesAnEmptyMessageFromStandardInput(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({}, "\n"));

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["-"], teammate: "Alice" }), UsageException);

    Assert.areEqual("The message read from standard input is empty.", error.message);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async sendsADashAmongOtherWordsAsText(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({}, "unread"));

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["-", "then", "more"], teammate: "Alice" });

    Assert.areEqual("- then more", SendCommandTests.sent(context).text);
  }

  @TestMethod
  public async refusesATeammateNoOneIsNamed(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync());

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], teammate: "Bob" }), CliCommandException);

    Assert.areEqual("NotFound", error.code);
    Assert.areEqual("No teammate is named Bob.", error.message);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async sendsToTheGivenProviderModelEffortAndProviderWhenNoOneIsNamed(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), []);

    const result = await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "codex", model: "gpt-5", effort: "high", provider: "a1" });

    Assert.areEqual("Sent message m1; replies: (none)", result.text);
    const params = SendCommandTests.sent(context);
    Assert.areEqual("codex gpt-5 high a1", `${params.requested?.kind} ${params.requested?.model} ${params.requested?.effort} ${params.providerId}`);
  }

  @TestMethod
  public async refusesAnEffortTheKindsCellSaysItCantChangeBeforeSendingAndSendsOneTheKindCan(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), []);

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "cursor", effort: "high", provider: "a4" }),
      UsageException);
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "cursor", provider: "a4" });

    Assert.areEqual("Cursor can't change effort: its models each have one fixed setting.", error.message);
    Assert.areEqual("cursor null null a4", SendCommandTests.settingsOf(context));
    Assert.areEqual(1, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async refusesAMessageForNoTeammateWithoutAKindOrADefaultTeammate(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync()).answer("teamrun.defaultTeammateRead", () => null);

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a1" }), UsageException);

    Assert.areEqual("Name a teammate with @name or --teammate, a kind with --kind and one of its providers with --provider, or set a default teammate in Settings › TeamRun.", error.message);
    Assert.areEqual(1, context.payloadsOf("teamrun.defaultTeammateRead").length);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async refusesAKindWithoutAProvider(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), []);

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "codex", model: "gpt-5" }), UsageException);

    Assert.areEqual("--kind needs --provider: name one of that kind's providers, which list-providers lists.", error.message);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async sendsForTheDefaultTeammateWhenItNamesNoTeammateAndNoKind(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), [])
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    const result = await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"] });

    Assert.areEqual("Sent message m1; replies: (none)", result.text);
    Assert.areEqual(null, context.payloadsOf("teamrun.defaultTeammateRead")[0]);
    Assert.areEqual("claude opus high a2", SendCommandTests.settingsOf(context));
  }

  @TestMethod
  public async sendsForTheDefaultTeammateWithTheGivenModelAndEffortInPlaceOfItsOwn(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), [])
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], model: "sonnet", effort: "low", provider: "a2" });

    Assert.areEqual("claude sonnet low a2", SendCommandTests.settingsOf(context));
    Assert.areEqual(0, context.payloadsOf("teamrun.providerList").length);
  }

  @TestMethod
  public async sendsTheDefaultTeammateWithNoEffortForAModelGivenWithoutOne(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), [])
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], model: "sonnet" });

    Assert.areEqual("claude sonnet null a2", SendCommandTests.settingsOf(context));
  }

  @TestMethod
  public async sendsAGivenProviderOfAnotherKindWithItsKindAndOnlyTheGivenModelAndEffort(): Promise<void> {
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync(), []))
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a1" });
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a1", model: "gpt-5", effort: "low" });
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3", model: "sonnet" });

    Assert.areEqual(["codex null null a1", "codex gpt-5 low a1", "claude sonnet null a3"].join(","),
      [0, 1, 2].map(t => SendCommandTests.settingsOf(context, t)).join(","));
    Assert.areEqual(0, context.payloadsOf("teamrun.providerModelCatalog").length);
  }

  @TestMethod
  public async keepsTheDefaultTeammatesModelAndEffortForAGivenProviderOfItsKindOnlyWhereItsModelsListThem(): Promise<void> {
    let fallback = new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2");
    let models = [new ProviderModel("opus", "Opus", "", ["low", "high"], false, null, null)];
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync(), []))
      .answer("teamrun.defaultTeammateRead", () => fallback.toJson())
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList(models, true).toJson());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3" });
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3", effort: "low" });
    models = [new ProviderModel("opus", "Opus", "", null, false, null, null)];
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3" });
    models = [new ProviderModel("sonnet", "Sonnet", "", ["high"], true, null, null)];
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3" });
    fallback = new DefaultTeammate(new RequestedSettings("claude", null, "high"), "a2");
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3" });

    Assert.areEqual(["claude opus high a3", "claude opus low a3", "claude opus null a3", "claude null null a3", "claude null high a3"].join(","),
      [0, 1, 2, 3, 4].map(t => SendCommandTests.settingsOf(context, t)).join(","));
    const read = ProviderListModelsParams.fromJson(context.payloadsOf("teamrun.providerModelCatalog")[0]);
    Assert.areEqual("claude a3 false", `${read.kind} ${read.providerId} ${read.refresh}`);
  }

  @TestMethod
  public async carriesTheDefaultTeammatesSpeedWhereTheModelItSendsListsItAndNoneForAnotherKind(): Promise<void> {
    const fast = (id: string): ProviderModel => new ProviderModel(id, id, "", null, false, null, null, null, {}, [new ProviderSpeed("fast")], null);
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync(), []))
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high", "fast"), "a2").toJson())
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList([fast("opus"), new ProviderModel("sonnet", "Sonnet", "", null, false, null, null), fast("opus-next")],
        true).toJson());

    for (const values of [{}, { model: "sonnet" }, { model: "opus-next" }, { model: "missing" }, { provider: "a3" }, { provider: "a3", model: "sonnet" }, { provider: "a1" }])
      await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], ...values });

    Assert.areEqual("fast,null,fast,null,fast,null,null", context.payloadsOf("teamrun.messageSend").map(t => String(MessageSendParams.fromJson(t).requested?.speed)).join(","));
    Assert.areEqual(5, context.payloadsOf("teamrun.providerModelCatalog").length);
  }

  @TestMethod
  public async carriesTheDefaultTeammatesModeToAProviderOfItsKindAndNoneToAnotherKind(): Promise<void> {
    let models = [new ProviderModel("opus", "Opus", "", null, false, null, null)];
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync(), []))
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high", null, "plan"), "a2").toJson())
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList(models, true).toJson());

    for (const values of [{}, { model: "sonnet" }, { provider: "a3" }, { provider: "a3", model: "sonnet" }, { provider: "a1" }])
      await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], ...values });
    models = [new ProviderModel("sonnet", "Sonnet", "", null, true, null, null)];
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a3" });

    Assert.areEqual("plan,plan,plan,plan,null,plan", context.payloadsOf("teamrun.messageSend").map(t => String(MessageSendParams.fromJson(t).requested?.mode)).join(","));
  }

  @TestMethod
  public async refusesTheDefaultTeammateWithAGivenProviderThatIsNotAdded(): Promise<void> {
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync()))
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a9" }), CliCommandException);

    Assert.areEqual("NotFound No provider has the id a9.", `${error.code} ${error.message}`);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async refusesADefaultTeammateSavedWithNoProviderUntilAProviderIsGiven(): Promise<void> {
    const context = SendCommandTests.withProviders(SendCommandTests.answering(await RecordingCliContext.activateAsync(), []))
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("codex", null, null)).toJson())
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList([], true).toJson());

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"] }), UsageException);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], provider: "a1" });

    Assert.areEqual("The default teammate has no provider: choose its provider in Settings › TeamRun, or pass --provider.", error.message);
    Assert.areEqual("codex null null a1", SendCommandTests.settingsOf(context));
  }

  @TestMethod
  public async leavesTheDefaultTeammateUnreadWhenItNamesAKindOrATeammate(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync(), [])
      .answer("teamrun.defaultTeammateRead", () => new DefaultTeammate(new RequestedSettings("claude", "opus", "high"), "a2").toJson());

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "codex", provider: "a1" });
    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], teammate: "Alice", model: "sonnet" });

    Assert.areEqual("codex null null a1", SendCommandTests.settingsOf(context));
    const named = MessageSendParams.fromJson(context.payloadsOf("teamrun.messageSend")[1]);
    Assert.areEqual("t1 true true", `${named.responderTeammateId} ${Object.isNull(named.requested)} ${Object.isNull(named.providerId)}`);
    Assert.areEqual(0, context.payloadsOf("teamrun.defaultTeammateRead").length);
  }

  @TestMethod
  public async sendsATeammatesKindWithoutAProviderAsCoreAcceptsIt(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: "token" }), []);

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi"], kind: "codex" });

    Assert.areEqual("codex null null null", SendCommandTests.settingsOf(context));
    Assert.areEqual("token", SendCommandTests.sent(context).senderToken);
  }

  @TestMethod
  public async sendsWithTheTokenOfTheTurnItsProcessRunsFor(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: "token" }));

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Check", "this"], teammate: "Chat GPT" });

    const params = SendCommandTests.sent(context);
    Assert.areEqual("token", params.senderToken);
    Assert.areEqual("t2", params.responderTeammateId);
  }

  @TestMethod
  public async readsATeammatesSendByTheQuoteRuleAndThePersonsAsBefore(): Promise<void> {
    const text = ["In", "her", "\"@alice", "hi\"", "chat,", "@Chat", "GPT", "look"];
    const teammate = SendCommandTests.answering(await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: "token" }));
    const person = SendCommandTests.answering(await RecordingCliContext.activateAsync());

    await teammate.runAsync("teamrun.send", { chatId: "c1", text });
    await person.runAsync("teamrun.send", { chatId: "c1", text });

    Assert.areEqual("t2", SendCommandTests.sent(teammate).mentionedTeammateIds.join(","));
    Assert.areEqual("t1,t2", SendCommandTests.sent(person).mentionedTeammateIds.join(","));
  }

  @TestMethod
  public async sendsATeammatesMessageThatNamesNoOneForTheTargetChatsChosenTeammate(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: "token" }));

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["What", "changed?"] });

    const params = SendCommandTests.sent(context);
    Assert.areEqual(["0", "true", "true", "token"].join(","), [String(params.mentionedTeammateIds.length), String(Object.isNull(params.responderTeammateId)),
      String(Object.isNull(params.requested)), params.senderToken].join(","));
    Assert.areEqual(0, context.payloadsOf("teamrun.defaultTeammateRead").length);
  }

  @TestMethod
  public async sendsAsThePersonOutsideAnyTurnWhateverIdsItsProcessNames(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({ PATH: "/bin", TEAMRUN_CHAT_ID: "c2", TEAMRUN_TEAMMATE_ID: "t1" }));

    await context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi", "@alice"] });

    Assert.isNull(SendCommandTests.sent(context).senderToken);
  }

  @TestMethod
  public async refusesABlankToken(): Promise<void> {
    const context = SendCommandTests.answering(await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: " " }));

    await Assert.throwsAsync(() => context.runAsync("teamrun.send", { chatId: "c1", text: ["Hi", "@alice"] }), ArgumentException);

    Assert.areEqual(0, context.payloadsOf("teamrun.messageSend").length);
  }

  @TestMethod
  public async printsTheNoteOfAMessageThatStartedNoOne(): Promise<void> {
    const context = (await RecordingCliContext.activateAsync({ TEAMRUN_SENDER_TOKEN: "token" }))
      .answer("teamrun.teammateList", () => [SampleData.alice.toJson(), SampleData.chat.toJson()])
      .answer("teamrun.messageSend", () => new MessageSendResult(SampleData.user("m1", "c1", 0, "Hi")
        .withDetail(SampleData.detail(1, DetailKind.Note, "The chain stopped after 4 hand-offs.")), []).toJson());

    const result = await context.runAsync("teamrun.send", { chatId: "c1", text: ["@Chat", "GPT", "hi"] });

    Assert.areEqual("Sent message m1; replies: (none)\nThe chain stopped after 4 hand-offs.", result.text);
  }

  private static answering(context: RecordingCliContext, replies: readonly string[] = ["m2", "m3"]): RecordingCliContext {
    const cells = Object.fromEntries(Object.values(ProviderAbility).map(t => [t, AbilityCell.works(AbilitySource.Acp)])) as Record<ProviderAbility, AbilityCell>;
    const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, false, null, false, null, false, null,
      new ProviderAbilities({ ...cells, [ProviderAbility.ChooseEffort]: AbilityCell.cannot("its models each have one fixed setting") }));
    return context.answer("teamrun.teammateList", () => [SampleData.alice.toJson(), SampleData.chat.toJson()])
      .answer("teamrun.providerKindList", () => [new ProviderKind("codex", "Codex", true).toJson(), cursor.toJson()])
      .answer("teamrun.messageSend", () => new MessageSendResult(SampleData.user("m1", "c1", 0, "Hi"),
        replies.map((t, u) => SampleData.reply(t, "c1", u + 1, MessageStatus.Pending))).toJson());
  }

  private static sent(context: RecordingCliContext): MessageSendParams {
    return MessageSendParams.fromJson(context.payloadsOf("teamrun.messageSend")[0]);
  }

  private static withProviders(context: RecordingCliContext): RecordingCliContext {
    return context.answer("teamrun.providerList", () => [SampleData.provider.toJson(),
      new Provider("a3", "claude", "Home", "/profiles/a3", AuthStatus.LoggedIn, null, null, null, null, SampleData.time).toJson()]);
  }

  private static settingsOf(context: RecordingCliContext, index: number = 0): string {
    const params = MessageSendParams.fromJson(context.payloadsOf("teamrun.messageSend")[index]);
    return `${params.requested?.kind} ${params.requested?.model} ${params.requested?.effort} ${params.providerId}`;
  }
}
