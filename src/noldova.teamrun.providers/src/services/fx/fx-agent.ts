/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ProfileSearch, type SharedMcpRefusal } from "@noldova/teamrun.core";
import { type OwnMcpServer, type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, ProviderSpeed, type RequestedSettings, type SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpSteering } from "../../interfaces/i-acp-steering.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { AcpSpeedOption } from "../../models/acp-speed-option.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { OwnMcpServersFile } from "../own-mcp-servers-file.js";
import { UsualFolder } from "../usual-folder.js";
import { FxEnvironment } from "./fx-environment.js";
import { FxSteering } from "./fx-steering.js";
import { FxUsageReader } from "./fx-usage.reader.js";

export class FxAgent implements IAcpAgent {
  private readonly commands: CommandSource;
  private readonly homeDirectory: string;
  private readonly platform: string;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string = Resources.fxToolTitle;
  public readonly authMethod: string = String.empty;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = true;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = true;
  public readonly steering: IAcpSteering = new FxSteering();
  public readonly signInUnavailable: string = Resources.fxSignInUnavailable;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = false;
  public readonly authenticates: boolean = false;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = false;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = null;
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = null;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = false;
  public readonly usage: IAcpUsageReader = new FxUsageReader();
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader | null = null;
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.fxAutoMode, Resources.fxAutoModeName, Resources.fxAutoModeDescription),
    new ProviderMode(Resources.fxAskMode, Resources.fxAskModeName, Resources.fxAskModeDescription),
    new ProviderMode(Resources.fxFullAccessMode, Resources.fxFullAccessModeName, Resources.fxFullAccessModeDescription, true)];
  public readonly defaultMode: string | null = Resources.fxAutoMode;
  public readonly isolatedMode: string = Resources.fxAskMode;
  public readonly modelOption: string = Resources.fxModelOption;
  public readonly speedOption: AcpSpeedOption = new AcpSpeedOption(Resources.fxSpeedOption, [
    [new ProviderSpeed(Resources.fxStandardSpeed, Resources.fxStandardSpeedName), Resources.fxStandardSpeedValue],
    [new ProviderSpeed(Resources.fxFastSpeed, Resources.fxFastSpeedName), Resources.fxFastSpeedValue]]);
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string | null = null;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, locate: () => ProcessCommand | null = CommandSource.none,
    platform: string = process.platform) {
    this.homeDirectory = UsualFolder.home(environment, platform);
    const own = join(this.homeDirectory, Resources.fxFolderName);
    this.descriptor = new ProviderKind(Resources.fxKindId, Resources.fxDisplayName, true, false, null,
      new ProviderProfile(Resources.fxHomeVariable, Resources.fxSignInCommand, own, null, {}, {}, [own]),
      true, null, false, Resources.fxOneAccountPerComputer, false, null, ProviderAbilityTable.fx);
    this.profileSearch = new ProfileSearch([own], Resources.fxProfileEntries);
    this.commands = new CommandSource(command, locate);
    this.baseEnvironment = environment;
    this.platform = platform;
  }

  public launch(_provider: Provider | null, _requested: RequestedSettings | null, workingDirectory: string | null = null, _approvedTools: readonly string[] | null = null,
    environment: NodeJS.ProcessEnv = this.baseEnvironment): AcpLaunch {
    return this.launchWith(Resources.fxArguments, environment, workingDirectory ?? this.homeDirectory);
  }

  public statusLaunch(_provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch {
    return this.launchWith(Resources.fxStatusArguments, environment, this.homeDirectory);
  }

  public signOutLaunch(account: string, environment: NodeJS.ProcessEnv): AcpLaunch {
    return this.launchWith([Resources.logoutArgument, account], environment, this.homeDirectory);
  }

  private launchWith(args: readonly string[], environment: NodeJS.ProcessEnv, directory: string): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(this.platform === Resources.windowsPlatform ? Resources.fxWindowsNotFound : Resources.fxNotFound);
    return new AcpLaunch(command.withArguments(...args), FxEnvironment.build(environment), directory);
  }

  public isSignedOutRefusal(code: number | null, message: string): boolean {
    return code === Resources.fxSignedOutCode && message.includes(Resources.fxSignInCommand);
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

  public readVersion(initialized: JsonReader): string | null {
    const info = initialized.hasField(Resources.acpAgentInfoField) ? initialized.readNullableObject(Resources.acpAgentInfoField) : null;
    return info?.readOptionalString(Resources.acpVersionField) ?? null;
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
    return OwnMcpServersFile.listInAsync(join(this.homeDirectory, Resources.fxFolderName, Resources.ownMcpFile));
  }

  public formatSignIn(_provider: Provider | null): string {
    return Resources.fxSignedOut;
  }

  public formatStopped(reason: string): string {
    return Resources.formatFxStopped(reason);
  }
}
