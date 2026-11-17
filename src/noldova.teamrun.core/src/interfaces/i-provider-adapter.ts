/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ForkedSession, OwnMcpServer, Provider, ProviderKind, ProviderMode, ProviderModelList, ProviderSignInCommand, SharedMcpServerDefinition } from "@noldova/teamrun.protocol";

import type { SessionCarry } from "../enums/session-carry.js";
import type { ForkRequest } from "../models/fork-request.js";
import type { PlanReading } from "../models/plan-reading.js";
import type { ProfileSearch } from "../models/profile-search.js";
import type { SharedMcpRefusal } from "../models/shared-mcp-refusal.js";
import type { SignInCheck } from "../models/sign-in-check.js";
import type { TurnRequest } from "../models/turn-request.js";
import type { TurnResult } from "../models/turn-result.js";
import type { IProviderKindInstallation } from "./i-provider-kind-installation.js";
import type { ISignInListener } from "./i-sign-in-listener.js";
import type { ITurnListener } from "./i-turn-listener.js";

export interface IProviderAdapter {
  readonly descriptor: ProviderKind;
  readonly installation?: IProviderKindInstallation;
  readonly profileSearch?: ProfileSearch;
  readonly modes: readonly ProviderMode[];
  readonly defaultMode: string | null;
  readonly explorerMode?: string;
  readonly explorerUnavailable?: string;
  readonly backgroundSubAgentsNote?: string | null;
  readonly takesTeamRunTools?: boolean;
  readonly planMode?: string | null;

  checkSignIn(provider: Provider): Promise<SignInCheck>;
  checkFoundSignIn?(provider: Provider): Promise<SignInCheck>;
  prepareProfile?(provider: Provider): void;
  signIn(provider: Provider, signal: AbortSignal, listener: ISignInListener): Promise<void>;
  readSignInCommand?(provider: Provider): Promise<ProviderSignInCommand | null>;
  signOut?(provider: Provider): Promise<void>;
  listModels(provider: Provider | null, refresh?: boolean, workingDirectory?: string | null): Promise<ProviderModelList>;
  runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;
  readPlanUsage?(provider: Provider | null): Promise<PlanReading | null>;
  askIsolated?(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null>;
  plansFirst?(nativeSessionIds: readonly string[]): Promise<void>;
  sharedServerUnavailable?(server: SharedMcpServerDefinition, provider: Provider, workingDirectory: string | null): SharedMcpRefusal | null;
  sharedServerNamespaceOf?(name: string): string;
  savedSecretsUnavailable?(server: SharedMcpServerDefinition): SharedMcpRefusal | null;
  listOwnMcpServers?(provider: Provider | null): Promise<readonly OwnMcpServer[] | null>;
  forkSession(request: ForkRequest): Promise<ForkedSession>;
  closeSessions?(nativeSessionIds: readonly string[]): Promise<void>;
  readCompaction?(provider: Provider | null, nativeSessionId: string): Promise<string | null>;
  carrySession?(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry>;
  formatQuestionReply?(replyTo: string, question: string, answer: string): string;
  shutdown(): Promise<void>;
}
