/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { ProfileSearch, SharedMcpRefusal } from "@noldova/teamrun.core";
import type { OwnMcpServer, Provider, ProviderKind, ProviderMode, ProviderModel, ProviderSignInCommand, RequestedSettings, SharedMcpTransport } from "@noldova/teamrun.protocol";

import type { AcpLaunch } from "../models/acp-launch.js";
import type { AcpMcpTool } from "../models/acp-mcp-tool.js";
import type { AcpModelMember } from "../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../models/acp-permission-switch.js";
import type { AcpSpeedOption } from "../models/acp-speed-option.js";
import type { ProcessCommand } from "../models/process-command.js";
import type { IAcpAccountReader } from "./i-acp-account.reader.js";
import type { IAcpLevelReader } from "./i-acp-level.reader.js";
import type { IAcpModelListReader } from "./i-acp-model-list.reader.js";
import type { IAcpModelStore } from "./i-acp-model-store.js";
import type { IAcpOwnMcpServersReader } from "./i-acp-own-mcp-servers.reader.js";
import type { IAcpSteering } from "./i-acp-steering.js";
import type { IAcpToolGate } from "./i-acp-tool-gate.js";
import type { IAcpPlanReader } from "./i-acp-plan.reader.js";
import type { IAcpToDoListReader } from "./i-acp-to-do-list.reader.js";
import type { IAcpQuestionReader } from "./i-acp-question.reader.js";
import type { IAcpSignOutReader } from "./i-acp-sign-out.reader.js";
import type { IAcpToDoReader } from "./i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "./i-acp-usage.reader.js";

export interface IAcpAgent {
  readonly descriptor: ProviderKind;
  readonly baseEnvironment: NodeJS.ProcessEnv;
  readonly profileSearch: ProfileSearch | null;
  readonly toolTitle: string;
  readonly authMethod: string;
  readonly authMeta: JsonObject | null;
  readonly initializeMeta: JsonObject | null;
  readonly stopReasons: readonly string[];
  readonly prefersResume: boolean;
  readonly forkMethods: readonly string[];
  readonly sendsResourceLinks: boolean;
  readonly signInUnavailable: string;
  readonly signOut: IAcpSignOutReader | null;
  readonly logsOut: boolean;
  readonly authenticates: boolean;
  readonly effortAtLaunch: boolean;
  readonly modelAtLaunch: boolean;
  readonly fallbackModels: readonly string[];
  readonly compacts: boolean;
  readonly compactsIfListed?: boolean;
  readonly runsTerminals?: boolean;
  readonly sharedServerTransports: readonly SharedMcpTransport[];
  readonly sharedServerRefusal: SharedMcpRefusal | null;
  readonly titleSessionArguments?: readonly string[];
  readonly titleSessionNotice?: RegExp;
  readonly isolatedMode?: string | undefined;
  hasNoIsolatedAsk?(provider: Provider | null): boolean;
  readonly followsTasks: boolean;
  readonly backgroundSubAgentsNote: string | null;
  readonly routedMcpTool: string | null;
  readonly awaitsTeamRunTools: boolean;
  readonly interactiveSignIn: boolean;
  readonly turnModels: IAcpModelStore | null;
  readonly usage: IAcpUsageReader | null;
  readonly account: IAcpAccountReader | null;
  readonly modelList?: IAcpModelListReader;
  readonly toDos: IAcpToDoReader | null;
  readonly questions: IAcpQuestionReader | null;
  readonly ownMcpServers?: IAcpOwnMcpServersReader;
  readonly steering?: IAcpSteering;
  readonly toolGate?: IAcpToolGate;
  readonly levels?: IAcpLevelReader;
  readonly modes: readonly ProviderMode[];
  readonly defaultMode: string | null;
  readonly planMode?: string | null;
  readonly takesUnlistedModes?: boolean;
  readonly modelOption?: string | null;
  readonly speedOption?: AcpSpeedOption | null;
  isSignedOutRefusal?(code: number | null, message: string): boolean;
  readonly plans?: IAcpPlanReader | null;
  readonly toDoList?: IAcpToDoListReader | null;
  readonly permissionSwitch: AcpPermissionSwitch | null;
  readonly launchMode: string | null;
  readonly allowAllMode?: string;
  launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null, approvedTools: readonly string[] | null,
    environment: NodeJS.ProcessEnv, chatTurn?: boolean, titleSession?: boolean): AcpLaunch;
  isSignedIn(provider: Provider | null): boolean | null;
  readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  readVersion(initialized: JsonReader): string | null;
  readSignInMethod(initialized: JsonReader): string | null;
  readEffort(session: JsonReader): string | null;
  memberOf(value: string, name: string): AcpModelMember | null;
  sessionMeta(requested: RequestedSettings): JsonObject | null;
  formatUnsupported(version: string | null): string | null;
  formatSignIn(provider: Provider | null): string;
  formatStopped(reason: string): string;
  sharedServerNameRefusal?(name: string, provider: Provider | null, workingDirectory: string | null): SharedMcpRefusal | null;
  mcpToolOf?(tool: JsonReader): AcpMcpTool | null;
  listOwnMcpServers?(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
  readMcpBlocks?(provider: Provider | null, since: string): ReadonlyMap<string, string>;
  listsToolsBeforeSession?(initialized: JsonReader): boolean;
  readUntrustedFolder?(initialized: JsonReader, environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null;
  readMissingTools?(initialized: JsonReader): string | null;
  readHomeInstructions?(environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null;
  readRefusal?(text: string): Error | null;
  forgetSignIn?(provider: Provider): void;
  prepareProfile?(provider: Provider): void;
  readSession?(session: JsonReader): void;

  readTerminalSignIn?(initialized: JsonReader): ProviderSignInCommand | null;
  currentCommand?(): ProcessCommand | null;
}
