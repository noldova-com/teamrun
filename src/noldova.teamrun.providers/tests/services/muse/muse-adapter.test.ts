/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnOutcome } from "@noldova/teamrun.core";
import { AuthStatus, MessageAttachment, ProviderAbility, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { Resources, SignOutException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { MuseTestHost } from "../../fixtures/muse-test-host.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class MuseAdapterTests {
  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new MuseTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter(AcpCommandCheck.environment(host.directory.path)), host.request("unused"), host.directory.path);
  }

  @TestMethod
  public async signsInAndOutInATerminalWithMusesOwnCommandsAndHasNoFork(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter({ XDG_CONFIG_HOME: host.directory.resolve("person") });
    const descriptor = adapter.descriptor;

    Assert.areEqual("muse:Muse Code:true:true:false:false", [descriptor.id, descriptor.displayName, descriptor.supportsResume, descriptor.supportsSignInCheck,
      descriptor.supportsFork, descriptor.supportsSignIn].join(":"));
    Assert.areEqual(`${descriptor.displayName} can't switch on its own MCP servers here: ${Resources.fxOwnServersSwitchAbility}.`, descriptor.ownMcpServersUnavailable);
    Assert.areEqual("false:muse logout:true", [descriptor.supportsSignOut, descriptor.signOutCommand, descriptor.signOutEndsWithCommand].join(":"));
    Assert.areEqual(`XDG_CONFIG_HOME:muse login:${host.directory.resolve("person")}`, [descriptor.profile?.variable, descriptor.profile?.signInCommand, descriptor.profile?.usualFolder].join(":"));
    const refused = await Assert.throwsAsync(() => adapter.signOut(host.provider), SignOutException);
    Assert.areEqual(Resources.signOutNotSupported, refused.message);
  }

  @TestMethod
  public async isNeverAskedForATitleSinceNoneOfItsModesIsReadOnly(): Promise<void> {
    await using host = new MuseTestHost();

    Assert.isUndefined(host.createAdapter().askIsolated);
  }

  @TestMethod
  public async takesSharedStdioAndHttpServers(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter();

    Assert.isNull(adapter.sharedServerUnavailable(new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null)));
    Assert.isNull(adapter.sharedServerUnavailable(new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN")));
  }

  @TestMethod
  public async checksThroughASessionAndListsTheModelsAndApprovalModesItsServerOffers(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter();

    const check = await adapter.checkSignIn(host.provider);
    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus, check.error ?? "");
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual("muse-1,muse-2", listed.models.map(t => t.id).join(","));
    Assert.areEqual("on-request:Ask on request,allow-all:Allow all", listed.modes.map(t => `${t.id}:${t.name}`).join(","));
    Assert.areEqual("on-request", listed.defaultMode);
  }

  @TestMethod
  public async namesMuseLoginForACheckAndATurnWhenSignedOut(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" });

    const check = await adapter.checkSignIn(host.provider);
    const turn = await adapter.runTurn(host.request("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(`${AuthStatus.LoggedOut}:${Resources.museSignIn}`, `${check.authStatus}:${check.error ?? ""}`);
    Assert.areEqual(`${TurnOutcome.Failed}:${Resources.museSignIn}`, `${turn.outcome}:${turn.error ?? ""}`);
  }

  @TestMethod
  public async namesMuseLoginWhenASessionIsRefusedWithMuseCodesSignInTextAndAnotherCode(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_NEW: "museLoggedOut" });

    const check = await adapter.checkSignIn(host.provider);
    const turn = await adapter.runTurn(host.request("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(`${AuthStatus.LoggedOut}:${Resources.museSignIn}`, `${check.authStatus}:${check.error ?? ""}`);
    Assert.areEqual(`${TurnOutcome.Failed}:${Resources.museSignIn}`, `${turn.outcome}:${turn.error ?? ""}`);
  }

  @TestMethod
  public async runsMuseAcpInTheChatsFolder(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("launch"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const launch = JsonReader.parse(MuseAdapterTests.textOf(listener, "{\"args\""));
    Assert.areEqual("acp", launch.readStringArray("args").join(" "));
    Assert.isTrue(launch.readString("cwd").endsWith("chat"), launch.readString("cwd"));
  }

  @TestMethod
  public async setsTheModelEffortAndApprovalModeThroughItsSelectors(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter();
    await adapter.listModels(host.provider);
    const listener = new RecordingTurnListener();

    const turn = await adapter.runTurn(host.request("methods", null, [], "allow-all", "muse-2", "low"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const sets = JsonReader.parse(MuseAdapterTests.textOf(listener, "{\"methods\"")).readStringArray("sets");
    Assert.areEqual("effort=low,mode=allow-all,model=muse-2", [...sets].sort().join(","));
  }

  @TestMethod
  public async takesAModelWhoseSessionDropsTheEffortOptionWithoutAnEffort(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ TEAMRUN_FAKE_ACP_EFFORTLESS_MODEL: "muse-2" }).runTurn(host.request("methods", null, [], null, "muse-2", "high"), listener,
      new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const sets = JsonReader.parse(MuseAdapterTests.textOf(listener, "{\"methods\"")).readStringArray("sets");
    Assert.areEqual("model=muse-2", sets.filter(t => !t.startsWith("mode=")).join(","));
    Assert.areEqual("muse-2:null", `${turn.observed.model}:${turn.observed.effort}`);
  }

  @TestMethod
  public async compactsThroughItsCompactCommand(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("Compact", "earlier", [], null, null, null, true), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.isTrue(listener.texts.includes("/compact"), listener.texts.join(","));
  }

  @TestMethod
  public async showsTheAnswerOfAFreshInstallThatCantCompactAsItsReply(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ TEAMRUN_FAKE_ACP_COMPACT_ANSWER: "Manual context compaction is not available." })
      .runTurn(host.request("Compact", "earlier", [], null, null, null, true), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.isTrue(listener.texts.includes("Manual context compaction is not available."), listener.texts.join(","));
  }

  @TestMethod
  public async sendsImagesAndFilesAndResumesItsEarlierSession(): Promise<void> {
    await using host = new MuseTestHost();
    const image = host.directory.resolve("image.png");
    const notes = host.directory.resolve("notes.txt");
    writeFileSync(image, "fixture-image");
    writeFileSync(notes, "fixture-notes");
    const adapter = host.createAdapter();
    const files = new RecordingTurnListener();
    const resumed = new RecordingTurnListener();

    await adapter.runTurn(host.request("files", null, [new MessageAttachment("image.png", "image/png", 13, image), new MessageAttachment("notes.txt", "text/plain", 13, notes)]),
      files, new AbortController().signal);
    const turn = await adapter.runTurn(host.request("methods", "earlier"), resumed, new AbortController().signal);

    const parts = JsonReader.parse(`{"parts":${MuseAdapterTests.textOf(files, "[{")}}`).readObjectArray("parts");
    Assert.areEqual("text,image,resource_link", parts.map(t => t.readString("type")).join(","));
    Assert.areEqual(pathToFileURL(notes).href, parts[2]?.readString("uri"));
    Assert.areEqual("earlier", turn.nativeSessionId);
  }

  @TestMethod
  public async reportsItsContextUse(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();

    await host.createAdapter().runTurn(host.request("usage"), listener, new AbortController().signal);

    Assert.areEqual("30000/200000", listener.usages.map(t => `${t.context?.usedTokens}/${t.context?.windowTokens}`).join(","));
  }

  @TestMethod
  public async asksThePersonWithTheChoicesItsServerOffers(): Promise<void> {
    await using host = new MuseTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push("yes");

    const turn = await host.createAdapter().runTurn(host.request("approve"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.isTrue(listener.details.some(t => t.text.includes("\"optionId\":\"yes\"")));
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new MuseTestHost();
    const adapter = host.createAdapter();
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => host.request(prompt, resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, host.provider, () => adapter.listModels(host.provider)),
      [ProviderAbility.UnrestrictedMode]: AbilityChecks.listsModes(() => adapter.listModels(host.provider)),
      ...turns.probes({ [ProviderAbility.Questions]: "elicitation", [ProviderAbility.PlanChecklist]: "plan", [ProviderAbility.ReplyUsage]: "usage",
        [ProviderAbility.SubAgentRows]: TurnAbilityProbes.plain, [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: "generated-image", [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents(TurnAbilityProbes.plain),
      [ProviderAbility.ApprovedTools]: () => turns.runsApprovedToolAsync({ title: TurnAbilityProbes.approvedTool,
        _meta: { "gemini-cli": { mcp: { server_name: "teamrun", tool_name: TurnAbilityProbes.approvedTool } } } }, true)
    });
  }

  @TestMethod
  public async sendsMuseThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new MuseTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }

  private static textOf(listener: RecordingTurnListener, start: string): string {
    return listener.texts.find(t => t.startsWith(start)) ?? "";
  }
}
