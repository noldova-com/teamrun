/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ProfileSearch, SharedMcpRefusal } from "@noldova/teamrun.core";
import { OwnMcpServer, OwnMcpServerState, type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings,
  Resources as ProtocolResources, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import { ModelListException } from "../../exceptions/model-list.exception.js";
import { ToolsUnavailableException } from "../../exceptions/tools-unavailable.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";
import { AcpUsageReader } from "../acp/acp-usage.reader.js";
import { UsualFolder } from "../usual-folder.js";
import { CopilotHooks } from "./copilot-hooks.js";
import { CopilotMcpServers } from "./copilot-mcp-servers.js";
import { CopilotToDoReader } from "./copilot-to-do.reader.js";

export class CopilotAgent implements IAcpAgent {
  private readonly commands: CommandSource;
  private readonly workDirectory: string;
  private readonly homeDirectory: string;
  private readonly policyFolder: string;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string = Resources.copilotToolTitle;
  public readonly authMethod: string = Resources.copilotAuthMethod;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject = { [Resources.copilotMetaField]: { [Resources.copilotEventsField]: [Resources.copilotSubAgentStarted, Resources.copilotSubAgentCompleted] } };
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = false;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = false;
  public readonly signInUnavailable: string = Resources.copilotSignInUnavailable;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = false;
  public readonly authenticates: boolean = false;
  public readonly effortAtLaunch: boolean = true;
  public readonly modelAtLaunch: boolean = true;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = true;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [SharedMcpTransport.Http];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = new SharedMcpRefusal(Resources.copilotSharedStdioRefused, Resources.copilotSharedStdioRefusedShort);
  public readonly titleSessionArguments: readonly string[] = Resources.copilotTitleSessionArguments;
  public readonly titleSessionNotice: RegExp = Resources.copilotNotice;
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.copilotBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = false;
  public readonly usage: IAcpUsageReader = new AcpUsageReader();
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader;
  public readonly questions: IAcpQuestionReader | null = null;
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.copilotAgentMode, Resources.copilotAgentModeName, Resources.copilotAgentModeDescription),
    new ProviderMode(Resources.copilotPlanMode, Resources.copilotPlanModeName, Resources.copilotPlanModeDescription, false, true),
    new ProviderMode(Resources.copilotAutopilotMode, Resources.copilotAutopilotModeName, Resources.copilotAutopilotModeDescription, true),
    new ProviderMode(Resources.copilotAllowAllMode, Resources.copilotAllowAllModeName, Resources.copilotAllowAllModeDescription, true)];
  public readonly defaultMode: string | null = Resources.copilotAgentMode;
  public readonly isolatedMode: string = Resources.copilotAgentMode;
  public readonly planMode: string = Resources.copilotPlanMode;
  public readonly permissionSwitch: AcpPermissionSwitch | null = new AcpPermissionSwitch(Resources.copilotAllowAllOption, Resources.copilotAllowAllMode,
    Resources.copilotAllowAllOn, Resources.copilotAllowAllOff);
  public readonly launchMode: string | null = null;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, workDirectory: string, locate: () => ProcessCommand | null = CommandSource.none,
    homeDirectory: string = homedir(), policyFolder: string = CopilotHooks.policyFolder(process.platform, environment)) {
    this.descriptor = new ProviderKind(Resources.copilotKindId, Resources.copilotDisplayName, true, false,
      Resources.copilotDefaultModelName, new ProviderProfile(Resources.copilotHomeVariable, Resources.copilotSignInCommand,
        UsualFolder.of(environment, null, Resources.copilotHomeFolderName, homeDirectory), Resources.copilotToolCommand),
      false, Resources.toolLogoutCommand, false, null, false, null, ProviderAbilityTable.copilot);
    this.profileSearch = new ProfileSearch(UsualFolder.places(environment, Resources.copilotHomeVariable, Resources.copilotHomeFolderName, homeDirectory),
      Resources.copilotProfileEntries);
    this.commands = new CommandSource(command, locate);
    this.baseEnvironment = environment;
    this.workDirectory = workDirectory;
    this.homeDirectory = homeDirectory;
    this.policyFolder = policyFolder;
    this.toDos = new CopilotToDoReader(UsualFolder.of(environment, null, Resources.copilotHomeFolderName, homeDirectory));
  }

  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null, approvedTools: readonly string[] | null = null,
    environment: NodeJS.ProcessEnv = this.baseEnvironment, chatTurn: boolean = false): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.copilotNotFound);
    mkdirSync(this.workDirectory, { recursive: true });
    const args = [...Resources.copilotArguments];
    if (!Object.isNullOrUndefined(requested?.model)) {
      if (!ProtocolResources.modelNamePattern.test(requested.model))
        throw new ModelListException(Resources.formatCopilotModelNameInvalid(requested.model));
      args.push(Resources.copilotModelArgument, requested.model);
    }
    if (!Object.isNullOrUndefined(requested?.effort))
      args.push(Resources.copilotEffortArgument, requested.effort);
    const allowed = (approvedTools ?? []).filter(t => Resources.approvedToolNamePattern.test(t));
    if (allowed.length > 0)
      args.push(Resources.formatCopilotAllowedTools(ProtocolResources.mcpServerName, allowed));
    return new AcpLaunch(command.withArguments(...args, ...this.mcpArguments(provider, workingDirectory, chatTurn && provider?.ownMcpServers === true)),
      this.environmentFor(provider, environment), this.workDirectory);
  }

  public headlessLaunch(provider: Provider | null, environment: NodeJS.ProcessEnv = this.baseEnvironment): AcpLaunch {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.copilotNotFound);
    mkdirSync(this.workDirectory, { recursive: true });
    return new AcpLaunch(command.withArguments(...Resources.copilotHeadlessArguments, ...this.mcpArguments(provider, null, false)), this.environmentFor(provider, environment),
      this.workDirectory);
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

  public formatSignIn(provider: Provider | null): string {
    return Resources.formatCopilotSignIn(provider?.profileDir ?? null);
  }

  public formatStopped(reason: string): string {
    return Resources.formatCopilotStopped(reason);
  }

  public hasNoIsolatedAsk(provider: Provider | null): boolean {
    return CopilotHooks.presentIn(this.homeOf(provider), this.policyFolder);
  }

  public sharedServerNameRefusal(name: string, provider: Provider | null, workingDirectory: string | null): SharedMcpRefusal | null {
    try {
      return this.ownServerSources(provider, workingDirectory).some(([, , named]) => named.includes(name))
        ? new SharedMcpRefusal(Resources.copilotSharedServerNamedLikeOwn, Resources.copilotSharedServerNamedLikeOwnShort)
        : null;
    }
    catch {
      return null;
    }
  }

  public async listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    return (await CopilotMcpServers.namesInAsync(join(this.homeOf(provider), Resources.copilotMcpConfigFile))).filter(t => t !== ProtocolResources.mcpServerName)
      .map(t => new OwnMcpServer(t, OwnMcpServerState.Configured));
  }

  private homeOf(provider: Provider | null): string {
    return provider?.profileDir ?? join(this.homeDirectory, Resources.copilotHomeFolderName);
  }

  private ownServerSources(provider: Provider | null, workingDirectory: string | null): readonly (readonly [string, string, readonly string[]])[] {
    const home = this.homeOf(provider);
    const files = [[Resources.copilotUserMcpSource, join(home, Resources.copilotMcpConfigFile)] as const,
      ...(Object.isNull(workingDirectory) ? [] : CopilotMcpServers.projectFiles(workingDirectory)).map(t => [Resources.copilotProjectMcpSource, t] as const),
      ...CopilotMcpServers.pluginFiles(home).map(t => [Resources.copilotPluginMcpSource, t] as const)];
    return [...files.map(([source, file]) => [source, file, CopilotMcpServers.namesIn(file)] as const),
      [Resources.copilotPluginMcpSource, join(home, Resources.copilotSettingsFile), CopilotMcpServers.enabledPlugins(home)] as const];
  }

  private mcpArguments(provider: Provider | null, workingDirectory: string | null, keepsOwnServers: boolean): readonly string[] {
    const names = new Set(this.ownServerSources(provider, workingDirectory).flatMap(([source, file, named]) => {
      if (named.includes(ProtocolResources.mcpServerName))
        throw new ToolsUnavailableException(Resources.formatCopilotTeamRunServerNamed(source, file));
      return named;
    }));
    return keepsOwnServers ? [] : [Resources.copilotDisableBuiltinMcpsArgument, ...[...names].map(t => `${Resources.copilotDisableMcpServerArgument}=${t}`)];
  }

  private environmentFor(provider: Provider | null, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, Resources.copilotExcludedEnvironment);
    if (!Object.isNullOrUndefined(provider?.profileDir)) {
      for (const name of Object.keys(environment).filter(t => Resources.copilotProfileExcludedEnvironment.test(t)))
        delete environment[name];
      environment[Resources.copilotHomeVariable] = provider.profileDir;
    }
    return environment;
  }
}
