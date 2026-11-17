/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AttachmentStore, ForkRequest, type IProviderAdapter, McpEndpoint, SessionTokens, TurnOutcome, TurnRequest, type TurnResult, type TurnSteer, TurnTools }
  from "@noldova/teamrun.core";
import { DetailKind, MessageAttachment, ProviderAbility, ReplyPlan } from "@noldova/teamrun.protocol";
import { Resources } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../recording-turn-listener.fixture.js";
import { Wait } from "../wait.fixture.js";
import { AbilityChecks, type AbilityProbe, type AbilityProbes } from "./ability-checks.fixture.js";

export type TurnAbility = ProviderAbility.RunTurn | ProviderAbility.Resume | ProviderAbility.Fork | ProviderAbility.Compact | ProviderAbility.Images |
  ProviderAbility.Files | ProviderAbility.SteerTurn | ProviderAbility.PermissionCards | ProviderAbility.Questions | ProviderAbility.PlanChecklist |
  ProviderAbility.ReplyUsage | ProviderAbility.SubAgentRows | ProviderAbility.BackgroundCommands | ProviderAbility.GeneratedImages;

export type TurnScenarios = Readonly<Record<ProviderAbility.Questions | ProviderAbility.PlanChecklist | ProviderAbility.ReplyUsage | ProviderAbility.SubAgentRows |
  ProviderAbility.BackgroundCommands | ProviderAbility.GeneratedImages | ProviderAbility.PermissionCards | ProviderAbility.SteerTurn, string>>;

export class TurnAbilityProbes {
  public static readonly plain: string = "hello";
  public static readonly approvedTool: string = "teamrun_list_chats";
  private static readonly generatedImage: string = "\"itemType\":\"imageGeneration\"";
  private readonly adapter: IProviderAdapter;
  private readonly adapterFor: (prompt: string) => IProviderAdapter;
  private readonly request: (prompt: string, resume: string | null, attachments: readonly MessageAttachment[]) => TurnRequest;
  private readonly folder: string;
  private readonly turns = new Map<string, Promise<{ readonly turn: TurnResult; readonly listener: RecordingTurnListener }>>();

  public constructor(adapter: IProviderAdapter, request: (prompt: string, resume: string | null, attachments: readonly MessageAttachment[]) => TurnRequest,
    folder: string, adapterFor: (prompt: string) => IProviderAdapter = () => adapter) {
    this.adapter = adapter;
    this.adapterFor = adapterFor;
    this.request = request;
    this.folder = folder;
  }

  public probes(scenarios: TurnScenarios): Pick<AbilityProbes, TurnAbility> {
    const shows = (ability: keyof TurnScenarios, seen: (listener: RecordingTurnListener) => boolean): AbilityProbe =>
      async () => seen((await this.turnAsync(scenarios[ability])).listener);
    return {
      [ProviderAbility.RunTurn]: async () => (await this.turnAsync(TurnAbilityProbes.plain)).turn.outcome === TurnOutcome.Completed,
      [ProviderAbility.Resume]: () => this.resumesAsync(),
      [ProviderAbility.Fork]: () => this.forksAsync(),
      [ProviderAbility.Compact]: () => this.compactsAsync(),
      [ProviderAbility.Images]: () => this.sendsAsync("images", "image.png", "image/png", t => t.texts.some(u => u.includes("\"type\":\"image\""))),
      [ProviderAbility.Files]: () => this.sendsAsync("files", "notes.txt", "text/plain", t => t.texts.some(u => u.includes("notes.txt"))),
      [ProviderAbility.SteerTurn]: () => this.steersAsync(scenarios[ProviderAbility.SteerTurn]),
      [ProviderAbility.PermissionCards]: shows(ProviderAbility.PermissionCards, t => t.asks.length > 0),
      [ProviderAbility.Questions]: shows(ProviderAbility.Questions, t => t.questionAsks.length > 0),
      [ProviderAbility.PlanChecklist]: shows(ProviderAbility.PlanChecklist,
        t => t.details.some(u => u.kind === DetailKind.Plan && Object.isNull(ReplyPlan.fromJson(u.payload).text) && ReplyPlan.fromJson(u.payload).steps.length > 0)),
      [ProviderAbility.ReplyUsage]: shows(ProviderAbility.ReplyUsage, t => t.usages.some(u => !Object.isNull(u.inputTokens) || !Object.isNull(u.outputTokens) || !Object.isNull(u.costUsd))),
      [ProviderAbility.SubAgentRows]: shows(ProviderAbility.SubAgentRows, t => t.details.some(u => u.kind === DetailKind.SubAgent)),
      [ProviderAbility.BackgroundCommands]: shows(ProviderAbility.BackgroundCommands, t => t.taskStarts.length > 0),
      [ProviderAbility.GeneratedImages]: shows(ProviderAbility.GeneratedImages, t => t.details.some(u => TurnAbilityProbes.isGeneratedImage(u.payload)))
    };
  }

  public command(command: string): Pick<AbilityProbes, ProviderAbility.ListedCommands> {
    return {
      [ProviderAbility.ListedCommands]: async () => {
        const asked = this.request(command, null, []);
        const listener = new RecordingTurnListener();
        const turn = await this.adapterFor(command).runTurn(new TurnRequest(asked.provider, asked.workingDirectory, asked.prompt, asked.requested, null, [],
          asked.instructions, asked.freshPrompt, asked.environment, false, asked.tools, asked.sharedServers, null, t => asked.adoptSender(t), asked.sharedValues,
          asked.instructionsWithoutTools, asked.isolated, command), listener, new AbortController().signal);
        return listener.details.find(t => t.kind === DetailKind.Note)?.text ?? turn.outcome === TurnOutcome.Completed;
      }
    };
  }

  public subAgents(prompt: string): Pick<AbilityProbes, ProviderAbility.BackgroundSubAgents | ProviderAbility.StopSubAgent> {
    return {
      [ProviderAbility.BackgroundSubAgents]: async () => TurnAbilityProbes.outlivesTurn((await this.turnAsync(prompt)).listener),
      [ProviderAbility.StopSubAgent]: async () => (await this.turnAsync(prompt)).listener.taskStarts.some(t => !Object.isNull(t.subAgentId) && t.hasOwnStop)
    };
  }

  public turnAsync(prompt: string, resume: string | null = null, attachments: readonly MessageAttachment[] = []):
    Promise<{ readonly turn: TurnResult; readonly listener: RecordingTurnListener }> {
    const key = JSON.stringify([prompt, resume, attachments.map(t => t.path)]);
    const known = this.turns.get(key);
    if (!Object.isUndefined(known))
      return known;
    const listener = new RecordingTurnListener();
    const running = this.adapterFor(prompt).runTurn(this.request(prompt, resume, attachments), listener, new AbortController().signal)
      .then(turn => ({ turn, listener }));
    this.turns.set(key, running);
    return running;
  }

  public async runsApprovedToolAsync(toolCall: Readonly<Record<string, unknown>>, readOnly: boolean = false): Promise<boolean> {
    const { turn, listener } = await this.approvedTurnAsync(`use tool ${JSON.stringify(toolCall)}`, readOnly);
    return turn.outcome === TurnOutcome.Completed && listener.asks.length === 0 && listener.texts.some(t => t.includes("\"optionId\":\"yes\""));
  }

  public async approvedTurnAsync(prompt: string, readOnly: boolean = false): Promise<{ readonly turn: TurnResult; readonly listener: RecordingTurnListener }> {
    const plain = this.request(TurnAbilityProbes.plain, null, []);
    const listed = { name: TurnAbilityProbes.approvedTool, ...readOnly ? { annotations: { readOnlyHint: true } } : {} };
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([listed]), callToolAsync: () => Promise.resolve({}) },
      [TurnAbilityProbes.approvedTool], new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "session-1"));
    tools.markListed();
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "no";
    const turn = await this.adapterFor(prompt).runTurn(new TurnRequest(plain.provider, plain.workingDirectory, prompt, plain.requested, null, [], null, null, {}, false,
      tools),
      listener, new AbortController().signal);
    return { turn, listener };
  }

  private async resumesAsync(): Promise<boolean> {
    const first = (await this.turnAsync(TurnAbilityProbes.plain)).turn.nativeSessionId;
    if (Object.isNull(first))
      return false;
    const { turn } = await this.turnAsync(TurnAbilityProbes.plain, first);
    return turn.outcome === TurnOutcome.Completed && turn.nativeSessionId === first;
  }

  private async forksAsync(): Promise<boolean> {
    const plain = this.request(TurnAbilityProbes.plain, null, []);
    const session = (await this.turnAsync(TurnAbilityProbes.plain)).turn;
    if (Object.isNull(session.nativeSessionId))
      return false;
    const request = new ForkRequest(plain.provider, plain.workingDirectory, session.nativeSessionId, session.nativeTurnId ?? "0", plain.requested);
    return await AbilityChecks.refusalOf(() => this.adapter.forkSession(request)) === true;
  }

  private async compactsAsync(): Promise<boolean> {
    const session = (await this.turnAsync(TurnAbilityProbes.plain)).turn.nativeSessionId;
    const plain = this.request(TurnAbilityProbes.plain, session, []);
    const listener = new RecordingTurnListener();
    const turn = await this.adapterFor(TurnAbilityProbes.plain).runTurn(new TurnRequest(plain.provider, plain.workingDirectory, "/compact", plain.requested, session, [], null, null, {}, true),
      listener, new AbortController().signal);
    const kind = this.adapter.descriptor.displayName;
    return turn.outcome === TurnOutcome.Completed
      && !listener.details.some(t => t.text === Resources.formatCannotCompact(kind) || t.text === Resources.formatCompactionUnreported(kind));
  }

  public async sendsAsync(prompt: string, name: string, mediaType: string, seen: (listener: RecordingTurnListener) => boolean): Promise<boolean> {
    const path = join(this.folder, name);
    writeFileSync(path, "fixture");
    const attachments = [new MessageAttachment(name, mediaType, 7, path)];
    const { turn, listener } = await this.turnAsync(AttachmentStore.formatPrompt(prompt, attachments), null, attachments);
    return turn.outcome === TurnOutcome.Completed && seen(listener);
  }

  private async steersAsync(prompt: string): Promise<boolean> {
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);
    const stop = new AbortController();
    const running = this.adapterFor(prompt).runTurn(this.request(prompt, null, []), listener, stop.signal);
    await Wait.untilOrSettled(() => listener.texts.length > 0 || offers.some(t => !Object.isNull(t)), running);
    stop.abort();
    await running;
    return offers.some(t => !Object.isNull(t));
  }

  private static outlivesTurn(listener: RecordingTurnListener): boolean {
    return listener.wakes.length > 0 || listener.taskStarts.some(t => !Object.isNull(t.subAgentId) && !listener.taskEnds.some(u => u.taskId === t.taskId));
  }

  private static isGeneratedImage(payload: unknown): boolean {
    return JSON.stringify(payload ?? null).includes(TurnAbilityProbes.generatedImage);
  }
}
