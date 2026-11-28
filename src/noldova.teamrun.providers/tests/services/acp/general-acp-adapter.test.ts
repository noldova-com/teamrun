/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderKindVersions, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { AuthStatus, BackgroundTaskStatus, DetailKind, Provider, ProviderAbility, RequestedSettings } from "@noldova/teamrun.protocol";
import { AcpAdapter, GeneralAcpAdapter, GeneralAcpAgent, type IProcessTree, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class GeneralAcpAdapterTests {
  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, ...AcpCommandCheck.environment(host.directory.path) }, host.directory.path);
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAcpAdapter(agent), host.request("unused"), host.directory.path);
  }

  @TestMethod
  public async compactsOnlyWhenItListsCompactAndCountsItOnlyOnceTheAgentReportsTheCompaction(): Promise<void> {
    const run = async (commands: string, reports: string): Promise<string> => {
      await using host = new GrokTestHost();
      const prompts = join(host.directory.path, "prompts.txt");
      const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, TEAMRUN_FAKE_ACP_COMMANDS: commands, TEAMRUN_FAKE_ACP_PROMPTS: prompts,
        TEAMRUN_FAKE_ACP_COMPACT_ANSWER: "Summary written.", TEAMRUN_FAKE_ACP_COMPACT_REPORTS: reports }, host.directory.path);
      const adapter = host.createAcpAdapter(agent);
      const signal = new AbortController().signal;
      const session = (await adapter.runTurn(host.request("hello"), new RecordingTurnListener(), signal)).nativeSessionId;
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(new TurnRequest(null, host.directory.path, "/compact", host.request("hello").requested, session, [], null, null, {}, true),
        listener, signal);
      const sent = existsSync(prompts) && readFileSync(prompts, "utf8").includes(JSON.stringify({ text: "/compact" }));
      return JSON.stringify([turn.outcome, !Object.isNull(session) && turn.nativeSessionId === session, listener.texts, sent]);
    };

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, true, [Resources.formatContextCompacted("Devin"), "Summary written."], true]), await run("compact,review", "completed"));
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, true, ["Summary written.", Resources.formatCompactionUnreported("Devin")], true]), await run("compact", ""));
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, true, ["Summary written.", Resources.formatCompactionUnreported("Devin")], true]),
      await run("compact", "in_progress,failed"));
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, true, [Resources.formatCommandUnlisted("Devin", "/compact", ["review"])], false]), await run("review", "completed"));
  }

  @TestMethod
  public async runsTheAgentsCommandsInItsTerminalsAndFollowsOneThatOutlivesItsToolCallUntilItsStop(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path));
    const listener = new RecordingTurnListener();

    try {
      const turn = await adapter.runTurn(host.request("terminal-background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskOutputs.some(t => t.text.includes("ready")), "The terminal's output never reached its task.");
      const [start] = listener.taskStarts;

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1, true, 0]),
        JSON.stringify([turn.outcome, listener.taskStarts.length, start?.command.startsWith(process.execPath) ?? false, listener.taskEnds.length]));
      await start?.stop();
      await Wait.until(() => listener.taskEnds.length === 1, "The stopped terminal's task never ended.");
      Assert.areEqual(JSON.stringify([[start?.taskId, BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async stopsATerminalByItsOwnStopWhenItsTreeCannotBeEnded(): Promise<void> {
    await using host = new GrokTestHost();
    const asked: number[] = [];
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(), endLeftovers: () => Promise.resolve(),
      endOwnTree: processId => { asked.push(processId); return Promise.resolve(false); } };
    const adapter = new AcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path), host.info,
      host.programs.wrap(host.starter), host.timings, host.timer, null, null, tree);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.request("terminal-background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskOutputs.some(t => t.text.includes("ready")), "The terminal's output never reached its task.");
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => listener.taskEnds.length === 1, "The stopped terminal's task never ended.");
      Assert.areEqual(JSON.stringify([1, BackgroundTaskStatus.Stopped]), JSON.stringify([asked.length, listener.taskEnds[0]?.status]));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async answersAWaitedTerminalsExitAndOutputAndFollowsNoTerminalThatEndedWithinItsToolCall(): Promise<void> {
    const waited = new RecordingTurnListener();
    const [created, exit, output, released] = await GeneralAcpAdapterTests.answersOfAsync("terminal-wait", waited);
    Assert.areEqual(JSON.stringify([true, { exitCode: 3, signal: null }, "fixture done", false, { exitCode: 3, signal: null }, {}, 0]),
      JSON.stringify([!Object.isUndefined(created?.readOptionalString("terminalId")), exit?.toJson(), output?.readString("output").trim(), output?.readBoolean("truncated"),
        output?.readObject("exitStatus").toJson(), released?.toJson(), waited.taskStarts.length]));
  }

  @TestMethod
  public async killsATerminalTheAgentAsksToKillAndFollowsNoTerminalThatEndedWithinItsToolCall(): Promise<void> {
    const killed = new RecordingTurnListener();
    const [, running, kill, ended, freed] = await GeneralAcpAdapterTests.answersOfAsync("terminal-kill", killed);
    Assert.areEqual(JSON.stringify([false, {}, true, {}, 0]),
      JSON.stringify([running?.hasField("exitStatus"), kill?.toJson(), ended?.hasField("exitCode"), freed?.toJson(), killed.taskStarts.length]));
  }

  @TestMethod
  public async answersATerminalWhoseCommandIsMissing(): Promise<void> {
    const [made, failed, said, dropped] = await GeneralAcpAdapterTests.answersOfAsync("terminal-missing");
    if (process.platform === "win32")
      Assert.areEqual(JSON.stringify([-32602, Resources.formatCommandNotOnPath("teamrun-missing-command")]),
        JSON.stringify([made?.readNullableInteger("code"), made?.readString("message")]));
    else
      Assert.areEqual(JSON.stringify([true, { exitCode: null, signal: null }, true, {}]), JSON.stringify([!Object.isUndefined(made?.readOptionalString("terminalId")),
        failed?.toJson(), said?.readString("output").includes("ENOENT"), dropped?.toJson()]));
  }

  @TestMethod
  public async answersATerminalRequestWhoseOptionalFieldsAreNull(): Promise<void> {
    const [opened, stopped, closed, unbound] = await GeneralAcpAdapterTests.answersOfAsync("terminal-nulls");
    Assert.areEqual(JSON.stringify([true, {}, true, {}]), JSON.stringify([!Object.isUndefined(opened?.readOptionalString("terminalId")), stopped?.toJson(),
      closed?.hasField("exitCode"), unbound?.toJson()]));
  }

  @TestMethod
  public async cutsATerminalsOutputAtItsLimitAndRefusesItOnceReleased(): Promise<void> {
    const [, , cut, , gone] = await GeneralAcpAdapterTests.answersOfAsync("terminal-released");
    Assert.areEqual(JSON.stringify(["é\n", true, -32602, true]),
      JSON.stringify([cut?.readString("output"), cut?.readBoolean("truncated"), gone?.readNullableInteger("code"), gone?.readString("message").startsWith("TeamRun has no terminal ")]));
  }

  @TestMethod
  public async refusesATerminalOutsideTheChatsFolder(): Promise<void> {
    const [outside] = await GeneralAcpAdapterTests.answersOfAsync("terminal-outside");
    Assert.areEqual(JSON.stringify([-32602, true]),
      JSON.stringify([outside?.readNullableInteger("code"), outside?.readString("message").includes("only inside the chat's folder")]));
  }

  @TestMethod
  public async refusesATerminalForASessionOtherThanTheTurns(): Promise<void> {
    const [other] = await GeneralAcpAdapterTests.answersOfAsync("terminal-other");
    Assert.areEqual(JSON.stringify([-32602, true]),
      JSON.stringify([other?.readNullableInteger("code"), other?.readString("message").includes("other than the turn's")]));
  }

  @TestMethod
  public async followsAQuietTerminalTheAgentReleasesUntilItEndsStopped(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path));
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.request("terminal-follow-release"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The released terminal's task never ended.");
      Assert.areEqual(JSON.stringify([1, 0, BackgroundTaskStatus.Stopped]),
        JSON.stringify([listener.taskStarts.length, listener.taskOutputs.length, listener.taskEnds[0]?.status]));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async endsAFollowedTerminalThatExitsByItselfAfterItsLastOutputCompletedOnZeroAndFailedOtherwise(): Promise<void> {
    const run = async (code: string): Promise<string> => {
      await using host = new GrokTestHost();
      const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path));
      const listener = new RecordingTurnListener();
      const tailBeforeEnd: boolean[] = [];
      const recordEndAsync = listener.onTaskEndedAsync.bind(listener);
      listener.onTaskEndedAsync = end => {
        tailBeforeEnd.push(listener.taskOutputs.map(t => t.text).join("").endsWith("finished\n"));
        return recordEndAsync(end);
      };
      try {
        await adapter.runTurn(host.request("terminal-finish"), listener, new AbortController().signal);
        writeFileSync(host.directory.resolve("finish.txt"), code);
        await Wait.until(() => listener.taskEnds.length === 1, "The finished terminal's task never ended.");
        return JSON.stringify([listener.taskEnds[0]?.status, listener.taskEnds[0]?.exitCode, tailBeforeEnd]);
      }
      finally {
        await adapter.shutdown();
      }
    };

    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Completed, 0, [true]]), await run("0"));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Failed, 3, [true]]), await run("3"));
  }

  @TestMethod
  public async stopsAForkedChildThatHoldsTheOutputAfterItsFirstProcessExitedAndEndsTheTask(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path));
    const listener = new RecordingTurnListener();
    const runs = (processId: number): boolean => {
      try {
        process.kill(processId, 0);
        return true;
      }
      catch {
        return false;
      }
    };

    try {
      await adapter.runTurn(host.request("terminal-fork"), listener, new AbortController().signal);
      const [, child, root] = /child (\d+) root (\d+)/u.exec(listener.taskOutputs.map(t => t.text).join("")) ?? [];
      const [childId, rootId] = [Number(child), Number(root)];
      await Wait.until(() => !runs(rootId), "The command's first process never exited.");
      const running = [listener.taskStarts.length, listener.taskEnds.length, runs(childId)];
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => !runs(childId), "The forked child still ran after the stop.");
      await Wait.until(() => listener.taskEnds.length === 1, "The forked command's task never ended.");
      Assert.areEqual(JSON.stringify([[1, 0, true], BackgroundTaskStatus.Stopped]), JSON.stringify([running, listener.taskEnds[0]?.status]));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async stopsItsTerminalsWhenTheAgentEndsAndAtShutdownEvenWhenEndingTheirTreesFails(): Promise<void> {
    await using host = new GrokTestHost();
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(), endLeftovers: () => Promise.resolve(),
      endOwnTree: processId => { process.kill(processId); return Promise.reject(new Error("The listing failed.")); } };
    const adapter = new AcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path), host.info,
      host.programs.wrap(host.starter), host.timings, host.timer, null, null, tree);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.request("terminal-agent-exit"), listener, new AbortController().signal).catch(() => null);
      await Wait.until(() => listener.taskEnds.length === 1, "The terminal's task never ended with its agent.");
      await adapter.runTurn(host.request("terminal-background"), listener, new AbortController().signal);
      await adapter.shutdown();
      await Wait.until(() => listener.taskEnds.length === 2, "The terminal's task never ended at shutdown.");
      Assert.areEqual(JSON.stringify([2, BackgroundTaskStatus.Stopped, BackgroundTaskStatus.Stopped]),
        JSON.stringify([listener.taskStarts.length, ...listener.taskEnds.map(t => t.status)]));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async offersTerminalsOnlyToAnAddedAgent(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const adapter = host.createAdapter();

    try {
      await adapter.runTurn(host.request("terminal-background"), listener, new AbortController().signal);
      Assert.areEqual(JSON.stringify(["no terminals", 0]), JSON.stringify([listener.texts.join(""), listener.taskStarts.length]));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async offersItsAgentsInstallOnlyWhenItHasOne(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", new ProcessCommand("devin", ["acp"]), {}, {}, "home");
    const installation = { unavailable: null, missingTool: null, isInstalled: false, readVersions: () => Promise.resolve(ProviderKindVersions.unknown),
      install: () => Promise.resolve("folder") };

    const installed = new GeneralAcpAdapter(agent, installation, host.info, host.starter, host.timings);
    const local = new GeneralAcpAdapter(agent, null, host.info, host.starter, host.timings);

    Assert.isInstanceOf(installed, AcpAdapter);
    Assert.areEqual("devin", installed.descriptor.id);
    Assert.isTrue(installed.installation === installation);
    Assert.isUndefined(local.installation);
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new GrokTestHost();
    const options = [{ id: "model", name: "Model", category: "model", type: "select", currentValue: "devin-a", options: [{ value: "devin-a", name: "Devin A" }] },
      { id: "effort", name: "Thinking", category: "thought_level", type: "select", currentValue: "high", options: [{ value: "low" }, { value: "high" }] },
      { id: "mode", name: "Mode", category: "mode", type: "select", currentValue: "ask", options: [{ value: "ask", name: "Ask" }, { value: "yolo", name: "YOLO" }] }];
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true }, mcpCapabilities: { http: true } } };
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(options),
      TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities), TEAMRUN_FAKE_ACP_COMMANDS: "compact", TEAMRUN_FAKE_ACP_COMPACT_REPORTS: "completed" }, host.directory.path);
    const installation = { unavailable: null, missingTool: null, isInstalled: true, readVersions: () => Promise.resolve(ProviderKindVersions.unknown),
      install: () => Promise.resolve("folder") };
    const adapter = new GeneralAcpAdapter(agent, installation, host.info, host.programs.wrap(host.starter), host.stoppingTimings);
    const provider = new Provider("d", "devin", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(provider, host.directory.path, prompt,
      new RequestedSettings("devin", null, null), resume, attachments), host.directory.path);

    try {
      await AbilityChecks.runAsync(adapter.descriptor, {
        ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
        [ProviderAbility.UnrestrictedMode]: AbilityChecks.listsModes(() => adapter.listModels(provider)),
        ...turns.probes({ [ProviderAbility.Questions]: "elicitation", [ProviderAbility.PlanChecklist]: "plan", [ProviderAbility.ReplyUsage]: "usage",
          [ProviderAbility.SubAgentRows]: TurnAbilityProbes.plain, [ProviderAbility.BackgroundCommands]: "terminal-background",
          [ProviderAbility.GeneratedImages]: "generated-image", [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
        ...turns.subAgents(TurnAbilityProbes.plain),
        [ProviderAbility.ApprovedTools]: () => turns.runsApprovedToolAsync({ title: TurnAbilityProbes.approvedTool,
          _meta: { "gemini-cli": { mcp: { server_name: "teamrun", tool_name: TurnAbilityProbes.approvedTool } } } }, true)
      });
    }
    finally {
      await adapter.shutdown();
    }
    const terminals = host.programs.started.filter(t => t.arguments.some(u => u.includes("setInterval")));

    Assert.isTrue(terminals.length > 0);
    Assert.areEqual(String.empty, terminals.filter(t => GeneralAcpAdapterTests.isRunning(t.processId)).map(t => t.processId).join(","));
  }

  private static async answersOfAsync(prompt: string, listener: RecordingTurnListener = new RecordingTurnListener()): Promise<readonly JsonReader[]> {
    await using host = new GrokTestHost();
    const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path));
    try {
      await adapter.runTurn(host.request(prompt), listener, new AbortController().signal);
      return JsonReader.parse(listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("")).readObjectArray("answers");
    }
    finally {
      await adapter.shutdown();
    }
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH")
        return false;
      throw error;
    }
  }
}
