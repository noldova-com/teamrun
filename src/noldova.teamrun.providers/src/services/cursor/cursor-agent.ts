/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, resolve } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ProfileSearch, type SharedMcpRefusal } from "@noldova/teamrun.core";
import { type OwnMcpServer, type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import { ProviderRefusedException } from "../../exceptions/provider-refused.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpPlanReader } from "../../interfaces/i-acp-plan.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpToDoListReader } from "../../interfaces/i-acp-to-do-list.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { OwnMcpServersFile } from "../own-mcp-servers-file.js";
import { UsualFolder } from "../usual-folder.js";
import { CursorEnvironment } from "./cursor-environment.js";
import { CursorPermissions } from "./cursor-permissions.js";
import { CursorProfile } from "./cursor-profile.js";
import { CursorPlanReader } from "./cursor-plan.reader.js";
import { CursorQuestionReader } from "./cursor-question.reader.js";
import { CursorToDoListReader } from "./cursor-to-do-list.reader.js";

export class CursorAgent implements IAcpAgent {
  private readonly commands: CommandSource;
  private readonly defaultProfileDirectory: string;
  private readonly platform: string;
  private approvedTools: readonly string[] = [];
  private permissions: CursorPermissions = CursorPermissions.none;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch = new ProfileSearch([], [Resources.profileMarker]);
  public readonly toolTitle: string = Resources.cursorToolTitle;
  public readonly authMethod: string = Resources.cursorAuthMethod;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = false;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = true;
  public readonly signInUnavailable: string = Resources.cursorSignInUnavailable;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = false;
  public readonly authenticates: boolean = false;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = true;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = false;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = null;
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.acpBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = false;
  public readonly usage: IAcpUsageReader | null = null;
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader = new CursorQuestionReader();
  public readonly plans: IAcpPlanReader = new CursorPlanReader();
  public readonly toDoList: IAcpToDoListReader = new CursorToDoListReader();
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.cursorAgentMode, Resources.cursorAgentModeName, Resources.cursorAgentModeDescription),
    new ProviderMode(Resources.cursorAskMode, Resources.cursorAskModeName, Resources.cursorAskModeDescription, false, true),
    new ProviderMode(Resources.cursorPlanMode, Resources.cursorPlanModeName, Resources.cursorPlanModeDescription, false, true),
    new ProviderMode(Resources.cursorAllowAllMode, Resources.cursorAllowAllModeName, Resources.cursorAllowAllModeDescription, true)];
  public readonly defaultMode: string | null = Resources.cursorAgentMode;
  public readonly isolatedMode: string | undefined;
  public readonly planMode: string = Resources.cursorPlanMode;
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string | null = null;
  public readonly allowAllMode: string = Resources.cursorAllowAllMode;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string,
    locate: () => ProcessCommand | null = CommandSource.none, platform: string = process.platform) {
    this.descriptor = new ProviderKind(Resources.cursorKindId, Resources.cursorDisplayName, true, false, null,
      new ProviderProfile(Resources.cursorConfigVariable, Resources.cursorSignInCommand, defaultProfileDirectory, null, Resources.cursorSignInVariables(platform)),
      true, null, false, platform === Resources.cursorMacPlatform ? Resources.cursorOneAccountPerMac : null,
      false, null, ProviderAbilityTable.cursor);
    this.commands = new CommandSource(command, locate);
    this.baseEnvironment = environment;
    this.defaultProfileDirectory = defaultProfileDirectory;
    this.platform = platform;
    this.isolatedMode = platform === Resources.cursorMacPlatform ? undefined : Resources.cursorAskMode;
  }

  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null = null, approvedTools: readonly string[] | null = null,
    environment: NodeJS.ProcessEnv = this.baseEnvironment, chatTurn: boolean = false): AcpLaunch {
    if (!Object.isNull(approvedTools))
      this.approvedTools = [...approvedTools];
    if (chatTurn)
      this.permissions = this.personsPermissions(provider, environment);
    return this.prepare(provider, Object.isNullOrUndefined(requested?.model) ? Resources.cursorArguments
      : [Resources.cursorModelArgument, requested.model, ...Resources.cursorArguments], environment, !chatTurn, chatTurn ? workingDirectory : null);
  }

  public readRefusal(text: string): Error | null {
    const refusal = Resources.cursorRefusals.find(t => text === `${Resources.cursorRefusalLead}${t}`);
    if (Object.isUndefined(refusal))
      return null;
    if (refusal === Resources.cursorSignInRefusal)
      return new AcpRequestException(refusal, Resources.acpAuthRequiredCode);
    return new ProviderRefusedException(Resources.formatCursorRefused(refusal));
  }

  public signOutLaunch(provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch {
    return this.prepare(provider, [Resources.logoutArgument], environment);
  }

  public aboutLaunch(provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch {
    return this.prepare(provider, [Resources.cursorAboutArgument], environment);
  }

  public prepareProfile(provider: Provider): void {
    new CursorProfile(provider.profileDir, this.platform).prepare(this.approvedTools, this.permissions);
  }

  public currentCommand(): ProcessCommand | null {
    return this.commands.current;
  }

  public isSignedIn(_provider: Provider | null): boolean | null {
    return null;
  }

  public readModels(_initialized: JsonReader): readonly ProviderModel[] | null {
    return null;
  }

  public readVersion(_initialized: JsonReader): string | null {
    return null;
  }

  public readSignInMethod(_initialized: JsonReader): string | null {
    return null;
  }

  public readEffort(_session: JsonReader): string | null {
    return null;
  }

  public memberOf(_value: string, _name: string): AcpModelMember | null {
    return null;
  }

  public sessionMeta(): JsonObject | null {
    return null;
  }

  public formatUnsupported(_version: string | null): string | null {
    return null;
  }

  public listOwnMcpServers(_provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    return OwnMcpServersFile.listInAsync(join(UsualFolder.home(this.baseEnvironment, this.platform), Resources.cursorPersonFolderName, Resources.ownMcpFile));
  }

  public formatSignIn(provider: Provider | null): string {
    return Resources.formatCursorSignIn(provider?.profileDir ?? this.defaultProfileDirectory, this.platform === Resources.cursorMacPlatform);
  }

  public formatStopped(reason: string): string {
    return Resources.formatCursorStopped(reason);
  }

  private prepare(provider: Provider | null, args: readonly string[], environment: NodeJS.ProcessEnv, titleSession: boolean = false,
    turnDirectory: string | null = null): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.cursorNotFound);
    const profile = new CursorProfile(provider?.profileDir ?? this.defaultProfileDirectory, this.platform);
    profile.prepare(this.approvedTools, titleSession ? new CursorPermissions([], this.permissions.deny) : this.permissions);
    return new AcpLaunch(command.withArguments(...args), CursorEnvironment.build(environment, profile, titleSession), turnDirectory ?? profile.directory);
  }

  private personsPermissions(provider: Provider | null, environment: NodeJS.ProcessEnv): CursorPermissions {
    const folder = UsualFolder.of(environment, Resources.cursorConfigVariable, Resources.cursorPersonFolderName, UsualFolder.home(environment, this.platform));
    return this.samePlace(folder, provider?.profileDir ?? this.defaultProfileDirectory) ? CursorPermissions.none
      : CursorPermissions.read(join(folder, Resources.cursorConfigFileName));
  }

  private samePlace(first: string, second: string): boolean {
    return this.platform === Resources.windowsPlatform ? resolve(first).toLowerCase() === resolve(second).toLowerCase() : resolve(first) === resolve(second);
  }
}
