/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import {
  type ApprovalAsk,
  type ForkRequest,
  type IProviderAdapter,
  type IProviderKindInstallation,
  type ISignInListener,
  type ITurnListener,
  type PlanReading,
  type ProfileSearch,
  type QuestionAsk,
  type SessionCarry,
  type SharedMcpRefusal,
  SignInCheck,
  TurnDetail,
  type TurnRequest,
  TurnResult,
  TurnStart,
  TurnOutcome,
  UsageLimit
} from "@noldova/teamrun.core";
import { AuthStatus, DetailKind, ForkedSession, ObservedSettings, type Provider, ProviderIdentity, ProviderKind, ProviderContextWindows, ProviderMode, ProviderModel, ProviderModelList,
  ProviderProfile, type ProviderSignInCommand, ProviderSpeed }
  from "@noldova/teamrun.protocol";
import { AbilityCell, AbilitySource, type OwnMcpServer, ProviderAbilities, ProviderAbility, type ReplyAction, type ReplyUsage, RoleApplication, type SharedMcpServerDefinition }
  from "@noldova/teamrun.protocol";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeProviderAdapter implements IProviderAdapter {
  private readonly requestWaits: { count: number; resolve: () => void }[] = [];

  public descriptor: ProviderKind;
  public installation?: IProviderKindInstallation;
  public readSignInCommand?: (provider: Provider) => Promise<ProviderSignInCommand | null>;
  public profileSearch?: ProfileSearch;
  public takesTeamRunTools: boolean = true;
  public readonly requests: TurnRequest[] = [];
  public askIsolated?: (request: TurnRequest, listener: ITurnListener, signal: AbortSignal) => Promise<TurnResult | null>;
  public readCompaction?: (provider: Provider | null, nativeSessionId: string) => Promise<string | null>;
  public carrySession?: (from: Provider | null, to: Provider, nativeSessionId: string) => Promise<SessionCarry>;
  public lastListener: ITurnListener | null = null;
  public readonly checkedProviders: Provider[] = [];
  public readonly foundCheckedProviders: Provider[] = [];
  public checkFoundSignIn?: (provider: Provider) => Promise<SignInCheck> = provider => {
    this.foundCheckedProviders.push(provider);
    ChangeSignal.notify();
    if (this.failingProfileDirs.includes(provider.profileDir))
      return Promise.reject(new TypeError("Fixture check failed"));
    return Promise.resolve(this.signInCheck);
  };
  public failingProfileDirs: readonly string[] = [];
  public readonly signedInProviders: Provider[] = [];
  public signInFailure: unknown = null;
  public holdSignInUntilAbort: boolean = false;
  public resolveSignInOnAbort: boolean = false;
  public signInLink: string | null = null;
  public readonly signedOutProviders: Provider[] = [];
  public signOutFailure: unknown = null;
  public signOutHold: Promise<void> | null = null;
  public signInCheck: SignInCheck | Promise<SignInCheck> = new SignInCheck(AuthStatus.LoggedIn, new ProviderIdentity("dev@example.com", "plus"), "1.0.0", null);
  public models: readonly string[] = ["fake-small", "fake-large"];
  public speeds: Readonly<Record<string, readonly string[]>> = {};
  public contextWindows: Readonly<Record<string, ProviderContextWindows>> = {};
  public modeIds: readonly string[] = [];
  public unrestrictedModes: readonly string[] = [];
  public readOnlyModes: readonly string[] = [];
  public explorerMode?: string;
  public explorerUnavailable?: string;
  public backgroundSubAgentsNote?: string | null;
  public planMode: string | null = null;
  public listModelsFailure: unknown = null;
  public listModelsPartial: boolean = false;
  public readonly listedFolders: (string | null)[] = [];
  public listModelsHold: Promise<void> | null = null;
  public readonly refreshes: boolean[] = [];
  public signedIn: boolean | null = true;
  public detailTexts: readonly string[] = ["Working"];
  public turnTexts: readonly (readonly string[])[] = [];
  public streamedTexts: readonly string[] = [];
  public thinkingBeforeDetails: number = 0;
  public thinkingAfterDetails: number = 0;
  public approvalAsk: ApprovalAsk | null = null;
  public approvalAsks: readonly ApprovalAsk[] = [];
  public questionAsk: QuestionAsk | null = null;
  public questionPosts: readonly QuestionAsk[] = [];
  public afterDetails: (() => unknown) | null = null;
  public readonly plannedSessions: (readonly string[])[] = [];
  public holdTurn: ((request: TurnRequest, signal: AbortSignal) => Promise<void>) | null = null;
  public outcome: TurnOutcome = TurnOutcome.Completed;
  public error: string | null = null;
  public action: ReplyAction | null = null;
  public readonly limits: Map<string, UsageLimit> = new Map<string, UsageLimit>();
  public failWith: unknown = null;
  public failBeforeStart: boolean = false;
  public holdUntilAbort: boolean = false;
  public outcomeOnAbort: TurnOutcome = TurnOutcome.Interrupted;
  public writeFiles: Readonly<Record<string, string>> = {};
  public extraDetails: readonly TurnDetail[] = [];
  public steps: readonly (TurnDetail | (() => unknown))[] = [];
  public usage: ReplyUsage | null = null;
  public shutdowns: number = 0;
  public readonly forkRequests: ForkRequest[] = [];
  public forkFailure: unknown = null;
  public forksWhenResuming: boolean = false;
  public reportsTurnIds: boolean = true;
  public unresumable: readonly string[] = [];
  public readPlanUsage?: (provider: Provider | null) => Promise<PlanReading | null>;
  public sharedServerUnavailable?: (server: SharedMcpServerDefinition, provider: Provider, workingDirectory: string | null) => SharedMcpRefusal | null;
  public sharedServerNamespaceOf?: (name: string) => string;
  public savedSecretsUnavailable?: (server: SharedMcpServerDefinition) => SharedMcpRefusal | null;
  public listOwnMcpServers?: (provider: Provider | null) => Promise<readonly OwnMcpServer[] | null>;
  public prepareProfile?: (provider: Provider) => void;
  public signOut?: (provider: Provider) => Promise<void>;
  public closeSessions?: (nativeSessionIds: readonly string[]) => Promise<void>;
  public formatQuestionReply?: (replyTo: string, question: string, answer: string) => string;

  public constructor(id: string = "fake", supportsFork: boolean = false, supportsSignIn: boolean = false, usualFolder: string | null = null,
    ownMcpServersUnavailable: string | null = null, supportsSignOut: boolean = false, singleAccount: string | null = null,
    choosesServerPath: boolean = false, reportsLimits: boolean = false) {
    const works = AbilityCell.works(AbilitySource.Acp);
    const cells = Object.fromEntries(Object.values(ProviderAbility).map(t => [t, works])) as Record<ProviderAbility, AbilityCell>;
    const abilities = new ProviderAbilities({ ...cells, [ProviderAbility.Fork]: supportsFork ? works : AbilityCell.cannot("The fake provider doesn't fork."),
      [ProviderAbility.OwnServersSwitch]: Object.isNull(ownMcpServersUnavailable) ? works : AbilityCell.cannot(ownMcpServersUnavailable) });
    this.descriptor = new ProviderKind(id, "Fake provider", true, supportsSignIn, null,
      Object.isNull(usualFolder) ? null : new ProviderProfile("FAKE_HOME", null, usualFolder), supportsSignOut, null, false, singleAccount, false, null, abilities,
      false, false, { resume: false, fork: false, ownMcpServersUnavailable: null }, null, choosesServerPath, reportsLimits);
    if (supportsSignOut)
      this.signOut = async provider => {
        this.signedOutProviders.push(provider);
        ChangeSignal.notify();
        await this.signOutHold;
        if (!Object.isNull(this.signOutFailure))
          throw this.signOutFailure;
      };
  }

  public answerTitles(ask: (request: TurnRequest, signal: AbortSignal) => Promise<string | null>): void {
    this.askIsolated = async (request, listener, signal) => {
      signal.addEventListener("abort", () => ChangeSignal.notify(), { once: true });
      const answer = await ChangeSignal.after(ask(request, signal));
      if (!Object.isNull(answer))
        await listener.onDetailAsync(new TurnDetail(DetailKind.Text, answer, null, null));
      return new TurnResult(TurnOutcome.Completed, null, new ObservedSettings(this.descriptor.id, null, null, null), null);
    };
  }

  public runsIsolated(): void {
    this.askIsolated = (request, listener, signal) => this.runTurn(request, listener, signal);
  }

  public plansFirst(nativeSessionIds: readonly string[]): Promise<void> {
    this.plannedSessions.push(nativeSessionIds);
    ChangeSignal.notify();
    return Promise.resolve();
  }

  public forkSession(request: ForkRequest): Promise<ForkedSession> {
    this.forkRequests.push(request);
    ChangeSignal.notify();
    if (!Object.isNull(this.forkFailure))
      return Promise.reject(this.forkFailure);

    const providerId = request.provider?.id ?? null;
    return Promise.resolve(this.forksWhenResuming
      ? new ForkedSession(this.descriptor.id, providerId, request.nativeSessionId, request.lastTurnId)
      : new ForkedSession(this.descriptor.id, providerId, `fork-${this.forkRequests.length}`));
  }

  public checkSignIn(provider: Provider): Promise<SignInCheck> {
    this.checkedProviders.push(provider);
    ChangeSignal.notify();
    if (this.failingProfileDirs.includes(provider.profileDir))
      return Promise.reject(new TypeError("Fixture check failed"));
    return Promise.resolve(this.signInCheck);
  }

  public signIn(provider: Provider, signal: AbortSignal, listener: ISignInListener): Promise<void> {
    this.signedInProviders.push(provider);
    ChangeSignal.notify();
    if (!Object.isNull(this.signInLink))
      listener.openLink(this.signInLink);
    if (!Object.isNull(this.signInFailure))
      return Promise.reject(this.signInFailure);
    if (!this.holdSignInUntilAbort)
      return Promise.resolve();

    return new Promise((resolve, reject) => signal.addEventListener("abort",
      () => this.resolveSignInOnAbort ? resolve() : reject(new Error("Fixture sign-in stopped")), { once: true }));
  }

  public get modes(): readonly ProviderMode[] {
    return this.modeIds.map(t => new ProviderMode(t, t, null, this.unrestrictedModes.includes(t), this.readOnlyModes.includes(t)));
  }

  public get defaultMode(): string | null {
    return this.modeIds[0] ?? null;
  }

  public listModels(_provider: Provider | null, refresh: boolean = false, workingDirectory: string | null = null): Promise<ProviderModelList> {
    this.refreshes.push(refresh);
    this.listedFolders.push(workingDirectory);
    ChangeSignal.notify();
    if (!Object.isNull(this.listModelsFailure))
      return Promise.reject(this.listModelsFailure);

    const list = new ProviderModelList(this.models.map((id, index) => {
      const speeds = (this.speeds[id] ?? []).map(t => new ProviderSpeed(t));
      return new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true, null, {}, speeds, null, this.contextWindows[id] ?? null);
    }), this.signedIn, false, null, false, this.modes, this.defaultMode, false, null, this.listModelsPartial);
    return Object.isNull(this.listModelsHold) ? Promise.resolve(list) : this.listModelsHold.then(() => list);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.lastListener = listener;
    this.requests.push(request);
    ChangeSignal.notify();
    for (const wait of this.requestWaits.filter(t => t.count <= this.requests.length)) {
      this.requestWaits.splice(this.requestWaits.indexOf(wait), 1);
      wait.resolve();
    }
    if (this.failBeforeStart)
      throw new Error("Fixture failed before starting a session");
    const resume = this.unresumable.includes(request.resumeNativeSessionId ?? "") ? null : request.resumeNativeSessionId;
    if (resume !== request.resumeNativeSessionId)
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, `Fixture could not resume ${request.resumeNativeSessionId}`, null, null));
    const sessionId = Object.isNull(resume) ? `session-${this.requests.length}`
      : Object.isNull(request.resumeAt) ? resume : `fork-of-${resume}-at-${request.resumeAt}`;
    const turnId = this.reportsTurnIds ? `turn-${this.requests.length}` : null;
    const observed = new ObservedSettings(this.descriptor.id, "fake-large", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart(sessionId, !Object.isNull(resume),
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions));
    await listener.onObservedAsync(observed);
    if (!Object.isNull(this.failWith))
      throw this.failWith;
    const writes = Object.entries(this.writeFiles);
    if (writes.length > 0)
      await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "fixture writes", { command: "fixture writes", status: "inProgress" }, "fixture-writes"));
    for (const [name, content] of writes) {
      const path = join(request.workingDirectory, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    for (const step of this.steps)
      if (step instanceof TurnDetail)
        await listener.onDetailAsync(step);
      else
        await step();
    ChangeSignal.notify();
    for (let index = 0; index < this.thinkingBeforeDetails; index++)
      listener.onThinking();
    for (const detail of this.extraDetails)
      await listener.onDetailAsync(detail);
    for (const text of this.turnTexts[this.requests.length - 1] ?? this.detailTexts)
      await listener.onDetailAsync(new TurnDetail(DetailKind.Text, text, null, null));
    for (const text of this.streamedTexts)
      await listener.onDetailAsync(new TurnDetail(DetailKind.Text, text, null, "streamed-item"));
    for (let index = 0; index < this.thinkingAfterDetails; index++)
      listener.onThinking();
    if (!Object.isNull(this.usage))
      await listener.onUsageAsync(this.usage);
    if (!Object.isNull(this.approvalAsk)) {
      const optionId = await listener.onApprovalRequested(this.approvalAsk);
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, `decided ${optionId}`, null, null));
    }
    await Promise.all(this.approvalAsks.map(async t => {
      const optionId = await listener.onApprovalRequested(t);
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, `${t.providerRequestId}: ${optionId}`, null, null));
    }));
    if (!Object.isNull(this.questionAsk)) {
      const answers = await listener.onQuestionsAsked(this.questionAsk);
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, `answered ${JSON.stringify(answers?.map(t => t.toJson()) ?? null)}`, null, null));
    }
    for (const ask of this.questionPosts)
      await listener.onQuestionsPostedAsync(ask);
    await this.afterDetails?.();
    if (writes.length > 0)
      await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "fixture writes", { command: "fixture writes", status: "completed" }, "fixture-writes"));
    ChangeSignal.notify();
    if (!Object.isNull(this.holdTurn))
      await ChangeSignal.after(this.holdTurn(request, signal));
    if (this.holdUntilAbort)
      await FakeProviderAdapter.waitForAbort(signal);
    if (signal.aborted)
      return new TurnResult(this.outcomeOnAbort, sessionId, observed, null, turnId);

    const limit = this.limits.get(request.provider?.id ?? String.empty);
    if (!Object.isNullOrUndefined(limit))
      return new TurnResult(TurnOutcome.Failed, sessionId, observed, "Fixture reached its usage limit", turnId, null, limit);

    return new TurnResult(this.outcome, sessionId, observed, this.error, turnId, this.action);
  }

  public requested(count: number): Promise<void> {
    if (this.requests.length >= count)
      return Promise.resolve();

    return new Promise(resolve => this.requestWaits.push({ count, resolve }));
  }

  public shutdown(): Promise<void> {
    this.shutdowns += 1;
    ChangeSignal.notify();
    return Promise.resolve();
  }

  private static waitForAbort(signal: AbortSignal): Promise<void> {
    if (signal.aborted)
      return Promise.resolve();

    return new Promise(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  }
}
