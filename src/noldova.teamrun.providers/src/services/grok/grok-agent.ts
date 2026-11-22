/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ProfileSearch, type SharedMcpRefusal } from "@noldova/teamrun.core";
import { type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpModelListReader } from "../../interfaces/i-acp-model-list.reader.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpOwnMcpServersReader } from "../../interfaces/i-acp-own-mcp-servers.reader.js";
import type { IAcpPlanReader } from "../../interfaces/i-acp-plan.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpSteering } from "../../interfaces/i-acp-steering.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { UsualFolder } from "../usual-folder.js";
import { GrokEnvironment } from "./grok-environment.js";
import { GrokShortHome } from "./grok-short-home.js";
import { GrokHome } from "./grok-home.js";
import { GrokMcpBlockReader } from "./grok-mcp-block.reader.js";
import { GrokPlanReader } from "./grok-plan.reader.js";
import { GrokQuestionReader } from "./grok-question.reader.js";
import { GrokModelListReader } from "./grok-model-list.reader.js";
import { GrokModelReader } from "./grok-model.reader.js";
import { GrokAccountReader } from "./grok-account.reader.js";
import { GrokMcpServersReader } from "./grok-mcp-servers.reader.js";
import { GrokSignOutReader } from "./grok-sign-out.reader.js";
import { GrokSteering } from "./grok-steering.js";
import { GrokUsageReader } from "./grok-usage.reader.js";

export class GrokAgent implements IAcpAgent {
  private readonly commands: CommandSource;
  private readonly home: GrokHome;
  private readonly shortHome: GrokShortHome;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string = Resources.grokToolTitle;
  public readonly authMethod: string = Resources.grokCachedAuthMethod;
  public readonly authMeta: JsonObject = { headless: true };
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = false;
  public readonly forkMethods: readonly string[] = Resources.xaiSessionForkMethods;
  public readonly sendsResourceLinks: boolean = false;
  public readonly signInUnavailable: string = Resources.grokSignInUnavailable;
  public readonly signOut: IAcpSignOutReader = new GrokSignOutReader();
  public readonly logsOut: boolean = false;
  public readonly authenticates: boolean = true;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public readonly fallbackModels: readonly string[] = Resources.grokFallbackModels;
  public readonly compacts: boolean = true;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = null;
  public readonly followsTasks: boolean = true;
  public readonly backgroundSubAgentsNote: string | null = null;
  public readonly routedMcpTool: string | null = Resources.grokRoutedMcpTool;
  public readonly awaitsTeamRunTools: boolean = true;
  public readonly usage: IAcpUsageReader = new GrokUsageReader();
  public readonly account: IAcpAccountReader = new GrokAccountReader();
  public readonly modelList: IAcpModelListReader = new GrokModelListReader();
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader = new GrokQuestionReader();
  public readonly plans: IAcpPlanReader = new GrokPlanReader();
  public readonly ownMcpServers: IAcpOwnMcpServersReader = new GrokMcpServersReader();
  public readonly steering: IAcpSteering = new GrokSteering();
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.grokDefaultMode, Resources.grokDefaultModeName, Resources.grokDefaultModeDescription),
    new ProviderMode(Resources.grokPlanMode, Resources.grokPlanModeName, Resources.grokPlanModeDescription, false, true),
    new ProviderMode(Resources.grokAskMode, Resources.grokAskModeName, Resources.grokAskModeDescription, false, true),
    new ProviderMode(Resources.grokAlwaysApproveMode, Resources.grokAlwaysApproveModeName, Resources.grokAlwaysApproveModeDescription, true)];
  public readonly defaultMode: string | null = Resources.grokDefaultMode;
  public readonly isolatedMode: string = Resources.grokAskMode;
  public readonly planMode: string = Resources.grokPlanMode;
  public readonly takesUnlistedModes: boolean = true;
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string = Resources.grokAlwaysApproveMode;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string,
    locate: () => ProcessCommand | null = CommandSource.none, home: GrokHome = new GrokHome(environment, formerProfileDirectory),
    shortHome: GrokShortHome = new GrokShortHome()) {
    this.descriptor = new ProviderKind(Resources.grokKindId, Resources.grokDisplayName, true, true, null,
      new ProviderProfile(Resources.grokHomeVariable, null, home.directory, null, {}, {}, [home.directory, formerProfileDirectory]),
      true, null, false, null, false, null, ProviderAbilityTable.grok);
    this.profileSearch = new ProfileSearch(UsualFolder.places(environment, Resources.grokHomeVariable, Resources.grokDirectoryName, UsualFolder.home(environment)),
      Resources.grokProfileEntries, [home.titleDirectory, formerProfileDirectory]);
    this.commands = new CommandSource(command, locate);
    this.baseEnvironment = environment;
    this.home = home;
    this.shortHome = shortHome;
  }

  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null = null, _approvedTools: readonly string[] | null = null,
    environment: NodeJS.ProcessEnv = this.baseEnvironment, _chatTurn: boolean = false, titleSession: boolean = false): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.grokNotFound);
    const args = [...Resources.grokAgentArguments, Resources.grokPermissionModeArgument,
      requested?.mode === Resources.grokAlwaysApproveMode ? Resources.grokAlwaysApproveMode : Resources.grokDefaultPermissionMode];
    args.push(...Resources.grokAgentCommandArguments);
    if (!Object.isNullOrUndefined(requested?.model))
      args.push(Resources.grokModelArgument, requested.model);
    if (!Object.isNullOrUndefined(requested?.effort))
      args.push(Resources.grokEffortArgument, requested.effort);
    args.push(Resources.grokStdioCommand);
    const home = this.home.of(provider, environment);
    const added = this.home.isAdded(provider);
    const launched = this.environmentOf(environment, home, added, requested, workingDirectory, titleSession);
    if (this.modes.some(t => t.id === requested?.mode && t.readOnly))
      launched[Resources.grokSubAgentsVariable] = Resources.grokDisabledValue;
    return new AcpLaunch(command.withArguments(...args), launched, UsualFolder.home(environment));
  }

  private environmentOf(environment: NodeJS.ProcessEnv, home: string, added: boolean, requested: RequestedSettings | null, workingDirectory: string | null,
    titleSession: boolean): NodeJS.ProcessEnv {
    if (!titleSession)
      return GrokEnvironment.build(environment, this.shortHome.of(home, workingDirectory, environment), added, Object.isNull(requested));
    mkdirSync(this.home.titleDirectory, { recursive: true });
    const signIn = added ? undefined : environment[Resources.grokAuthPathVariable];
    return GrokEnvironment.build(environment, this.home.titleDirectory, added, false, signIn ?? join(home, Resources.grokAuthFile));
  }

  public readMcpBlocks(provider: Provider | null, since: string): ReadonlyMap<string, string> {
    return GrokMcpBlockReader.read(this.home.of(provider), since);
  }

  public isSignedIn(_provider: Provider | null): boolean | null {
    return null;
  }

  public readModels(initialized: JsonReader): readonly ProviderModel[] {
    return GrokModelReader.read(initialized);
  }

  public readVersion(initialized: JsonReader): string | null {
    return GrokModelReader.version(initialized);
  }

  public readSignInMethod(initialized: JsonReader): string | null {
    return GrokModelReader.signInMethod(initialized);
  }

  public readEffort(session: JsonReader): string | null {
    const meta = session.hasField(Resources.acpMetaField) ? session.readNullableObject(Resources.acpMetaField) : null;
    return meta?.readOptionalString(Resources.reasoningEffortField) ?? null;
  }

  public memberOf(_value: string, _name: string): AcpModelMember | null {
    return null;
  }

  public sessionMeta(requested: RequestedSettings): JsonObject | null {
    return Object.isNull(requested.effort) ? null : { reasoningEffort: requested.effort };
  }

  public formatUnsupported(_version: string | null): string | null {
    return null;
  }

  public formatSignIn(provider: Provider | null): string {
    return Resources.formatGrokSignIn(this.home.of(provider));
  }

  public formatStopped(reason: string): string {
    return Resources.formatGrokStopped(reason);
  }
}
