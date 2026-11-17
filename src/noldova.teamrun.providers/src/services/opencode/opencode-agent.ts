/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ProfileSearch, type SharedMcpRefusal } from "@noldova/teamrun.core";
import { type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpLevelReader } from "../../interfaces/i-acp-level.reader.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { UsualFolder } from "../usual-folder.js";
import { OpencodeDataFolder } from "./opencode-data-folder.js";
import { OpencodeEnvironment } from "./opencode-environment.js";
import { OpencodeLevelReader } from "./opencode-level.reader.js";
import { OpencodeMcpServers } from "./opencode-mcp-servers.js";

export class OpencodeAgent implements IAcpAgent {
  private readonly commands: CommandSource;
  private readonly data: OpencodeDataFolder;
  private approvedTools: readonly string[] = [];

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string = Resources.opencodeToolTitle;
  public readonly authMethod: string = Resources.opencodeAuthMethod;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = false;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = true;
  public readonly signInUnavailable: string = Resources.opencodeSignInUnavailable;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = false;
  public readonly authenticates: boolean = false;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = true;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = null;
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.acpBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = true;
  public readonly usage: IAcpUsageReader | null = null;
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader | null = null;
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly levels: IAcpLevelReader;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.opencodeBuildMode, Resources.opencodeBuildModeName, Resources.opencodeBuildModeDescription),
    new ProviderMode(Resources.opencodePlanMode, Resources.opencodePlanModeName, Resources.opencodePlanModeDescription, false, true),
    new ProviderMode(Resources.opencodeAllowAllMode, Resources.opencodeAllowAllModeName, Resources.opencodeAllowAllModeDescription, true)];
  public readonly defaultMode: string | null = Resources.opencodeBuildMode;
  public readonly planMode: string = Resources.opencodePlanMode;
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string = Resources.opencodeAllowAllMode;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string,
    locate: () => ProcessCommand | null = CommandSource.none, data: OpencodeDataFolder = new OpencodeDataFolder(environment, formerProfileDirectory)) {
    this.descriptor = new ProviderKind(Resources.opencodeKindId, Resources.opencodeDisplayName, true, false, null,
      new ProviderProfile(Resources.xdgDataVariable, Resources.opencodeSignInCommand, data.directory, null, {}, {}, [data.directory, formerProfileDirectory]),
      false, Resources.opencodeSignOutCommand, true, null, false, Resources.opencodeOwnMcpServersNote,
      ProviderAbilityTable.opencode, false, false, undefined, Resources.opencodeOwnMcpServersShortNote);
    this.profileSearch = new ProfileSearch(UsualFolder.places(environment, Resources.xdgDataVariable, Resources.opencodeUsualDataFolder, UsualFolder.home(environment)),
      Resources.opencodeProfileEntries);
    this.commands = new CommandSource(command, locate);
    this.baseEnvironment = environment;
    this.data = data;
    this.levels = new OpencodeLevelReader((provider, environment) => this.launchWith(Resources.opencodeLevelArguments, provider, null, environment, false));
  }

  public launch(provider: Provider | null, requested: RequestedSettings | null, _workingDirectory: string | null = null, approvedTools: readonly string[] | null = null,
    environment: NodeJS.ProcessEnv = this.baseEnvironment, chatTurn: boolean = false): AcpLaunch {
    if (!Object.isNull(approvedTools))
      this.approvedTools = [...approvedTools];
    return this.launchWith(Resources.opencodeArguments, provider, requested, environment, chatTurn);
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

  public formatUnsupported(version: string | null): string | null {
    const parts = Object.isNull(version) ? null : Resources.opencodeVersionPattern.exec(version);
    if (Object.isNull(version) || Object.isNull(parts))
      return null;
    const numbers = parts.slice(1).map(t => Number.parseInt(t, 10));
    if (numbers[0]! >= Resources.opencodeUnsupportedMajor)
      return Resources.formatOpencodeUnsupported(version);
    const older = Resources.opencodeMinimumVersion.findIndex((t, i) => numbers[i] !== t);
    return older >= 0 && numbers[older]! < Resources.opencodeMinimumVersion[older]! ? Resources.formatOpencodeUnsupported(version) : null;
  }

  public formatSignIn(_provider: Provider | null): string {
    return Resources.opencodeSignInHint;
  }

  public formatStopped(reason: string): string {
    return Resources.formatOpencodeStopped(reason);
  }

  private launchWith(args: readonly string[], provider: Provider | null, requested: RequestedSettings | null, environment: NodeJS.ProcessEnv,
    chatTurn: boolean): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.opencodeNotFound);
    const folder = this.data.of(provider, environment);
    const directory = UsualFolder.home(environment);
    return new AcpLaunch(command.withArguments(...args),
      OpencodeEnvironment.build(environment, folder, this.data.isAdded(provider), requested?.mode ?? null, this.approvedTools,
        chatTurn && provider?.ownMcpServers === true, chatTurn ? null : OpencodeMcpServers.names(environment, directory)), directory);
  }
}
