/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, delimiter, dirname } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { ProfileSearch, SharedMcpRefusal } from "@noldova/teamrun.core";
import { type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderSignInCommand, type RequestedSettings, type SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpConfigOption } from "../../models/acp-config-option.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import { AcpMcpTool } from "../../models/acp-mcp-tool.js";
import { AcpRegistryPackage } from "../../models/acp-registry-package.js";
import type { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { AcpEnvironment } from "./acp-environment.js";
import { AcpUsageReader } from "./acp-usage.reader.js";
import { GeminiFolderTrust } from "./gemini-folder-trust.js";

export class GeneralAcpAgent implements IAcpAgent {
  private readonly command: ProcessCommand | null;
  private readonly locate: () => ProcessCommand | null;
  private readonly program: () => string | null;
  private readonly variables: () => Readonly<Record<string, string>>;
  private readonly homeDirectory: string;
  private learnedModes: readonly ProviderMode[] = [];
  private learnedDefault: string | null = null;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch | null = null;
  public readonly toolTitle: string;
  public readonly authMethod: string = String.empty;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = true;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = true;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = true;
  public readonly authenticates: boolean = false;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = false;
  public readonly compactsIfListed: boolean = true;
  public readonly runsTerminals: boolean = true;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = null;
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.acpBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = true;
  public readonly usage: IAcpUsageReader = new AcpUsageReader();
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader | null = null;
  public readonly interactiveSignIn: boolean = false;
  public readonly turnModels: IAcpModelStore | null = null;
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string | null = null;

  public constructor(id: string, displayName: string, command: ProcessCommand | null, variables: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>),
    environment: NodeJS.ProcessEnv, homeDirectory: string, locate: () => ProcessCommand | null = CommandSource.none, program: () => string | null = () => command?.executable ?? null) {
    this.descriptor = new ProviderKind(id, displayName, true, true, null, null, true, null, false,
      Resources.formatGeneralAcpSingleAccount(displayName), false, null, ProviderAbilityTable.acpAgent, false, true);
    this.command = command;
    this.locate = locate;
    this.program = program;
    this.variables = typeof variables === "function" ? variables : () => variables;
    this.baseEnvironment = environment;
    this.homeDirectory = homeDirectory;
    this.toolTitle = Resources.formatGeneralAcpToolTitle(displayName);
    this.signInUnavailable = Resources.formatGeneralAcpSignInUnavailable(displayName);
  }

  public get modes(): readonly ProviderMode[] {
    return this.learnedModes;
  }

  public get defaultMode(): string | null {
    return this.learnedDefault;
  }

  public launch(_provider: Provider | null, _requested: RequestedSettings | null, workingDirectory: string | null = null,
    _approvedTools: readonly string[] | null = null, environment: NodeJS.ProcessEnv = this.baseEnvironment): AcpLaunch {
    const command = this.command ?? this.locate();
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.formatGeneralAcpNotFound(this.descriptor.displayName));
    return new AcpLaunch(command, { ...AcpEnvironment.copy(environment, Resources.generalAcpExcludedEnvironment), ...this.variables() }, workingDirectory ?? this.homeDirectory);
  }

  public readSession(session: JsonReader): void {
    let learned: { readonly modes: readonly ProviderMode[]; readonly current: string | null } | null;
    try {
      learned = GeneralAcpAgent.modesOf(session);
    }
    catch {
      return;
    }
    if (!Object.isNull(learned))
      this.learn(learned.modes, learned.current);
  }

  public mcpToolOf(tool: JsonReader): AcpMcpTool | null {
    return AcpMcpTool.read(tool, [Resources.acpMetaField, Resources.geminiCliMetaField, Resources.geminiCliMcpField],
      Resources.geminiCliServerNameField, Resources.geminiCliToolNameField);
  }

  public readUntrustedFolder(initialized: JsonReader, environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null {
    if (!GeneralAcpAgent.isGemini(initialized))
      return null;
    const launch = this.launch(null, null, workingDirectory, null, environment);
    return GeminiFolderTrust.isUntrusted(launch.environment, launch.directory, launch.command.arguments) ? Resources.geminiCliUntrustedFolder : null;
  }

  public listsToolsBeforeSession(initialized: JsonReader): boolean {
    const version = GeneralAcpAgent.isGemini(initialized) ? this.readVersion(initialized)?.split(Resources.versionSeparator).map(Number) ?? [] : [];
    const [major = Number.NaN, minor = Number.NaN] = version;
    const leastMajor = Resources.geminiCliListsToolsBeforeSessionMajor;
    return major > leastMajor || major === leastMajor && minor >= Resources.geminiCliListsToolsBeforeSessionMinor;
  }

  public readMissingTools(initialized: JsonReader): string | null {
    return GeneralAcpAgent.isGemini(initialized) ? Resources.geminiCliToolsUnlisted : null;
  }

  public currentCommand(): ProcessCommand | null {
    return this.command ?? this.locate();
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

  public readSignInMethod(initialized: JsonReader): string | null {
    const methods = initialized.hasField(Resources.acpAuthMethodsField) ? initialized.readObjectArray(Resources.acpAuthMethodsField) : [];
    const method = methods.find(t => (t.readOptionalString(Resources.typeField) ?? Resources.acpAgentAuthType) === Resources.acpAgentAuthType);
    return method?.readNonBlankString(Resources.idField) ?? null;
  }

  public readTerminalSignIn(initialized: JsonReader): ProviderSignInCommand | null {
    if (!Object.isNull(this.readSignInMethod(initialized)) || !initialized.hasField(Resources.acpAuthMethodsField))
      return null;
    const method = initialized.readObjectArray(Resources.acpAuthMethodsField).find(t => t.readOptionalString(Resources.typeField) === Resources.acpTerminalAuthType);
    const program = this.program();
    if (Object.isUndefined(method) || Object.isNull(program))
      return null;
    const words = [basename(program), ...AcpRegistryPackage.argumentsOf(method)];
    if (!words.every(t => Resources.acpTerminalWordPattern.test(t)))
      return null;
    const folder = dirname(program);
    const name = Object.keys(this.baseEnvironment).find(t => t.toUpperCase() === Resources.acpPathVariable) ?? Resources.acpPathVariable;
    return new ProviderSignInCommand(words.join(Resources.acpTerminalWordSeparator), { ...AcpRegistryPackage.environmentOf(method),
      ...folder === Resources.acpRegistryCurrentFolder ? {} : { [name]: [folder, this.baseEnvironment[name] ?? String.empty].join(delimiter) } });
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

  public formatSignIn(_provider: Provider | null): string {
    return Resources.formatGeneralAcpSignIn(this.descriptor.displayName);
  }

  public formatStopped(reason: string): string {
    return Resources.formatGeneralAcpStopped(this.descriptor.displayName, reason);
  }

  private learn(modes: readonly ProviderMode[], current: string | null): void {
    if (modes.length === 0)
      return;
    this.learnedModes = modes;
    if (Object.isNull(this.learnedDefault) || !modes.some(t => t.id === this.learnedDefault))
      this.learnedDefault = !Object.isNull(current) && modes.some(t => t.id === current) ? current : modes[0]!.id;
  }

  private static modesOf(session: JsonReader): { readonly modes: readonly ProviderMode[]; readonly current: string | null } | null {
    const option = AcpConfigOption.readAll(session)?.find(t => t.category === Resources.acpModeCategory);
    if (!Object.isUndefined(option))
      return { modes: option.values.map((t, index) => new ProviderMode(t, option.names[index]!.trim().length === 0 ? t : option.names[index]!)), current: option.currentValue };
    const modes = session.hasField(Resources.acpModesField) ? session.readNullableObject(Resources.acpModesField) : null;
    if (Object.isNull(modes))
      return null;
    return { modes: modes.readObjectArray(Resources.acpAvailableModesField).map(t => new ProviderMode(t.readNonBlankString(Resources.idField),
      GeneralAcpAgent.textOf(t, Resources.nameField) ?? t.readNonBlankString(Resources.idField), GeneralAcpAgent.textOf(t, Resources.descriptionField))),
    current: modes.readOptionalString(Resources.acpCurrentModeField) ?? null };
  }

  private static textOf(reader: JsonReader, field: string): string | null {
    const text = reader.readOptionalString(field)?.trim() ?? String.empty;
    return text.length === 0 ? null : text;
  }

  private static isGemini(initialized: JsonReader): boolean {
    const info = initialized.toJson()[Resources.acpAgentInfoField];
    return GeneralAcpAgent.isJsonObject(info) && info[Resources.nameField] === Resources.geminiCliAgentName;
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }
}
