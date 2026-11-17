/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rmSync } from "node:fs";
import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { type ILog, ProfileSearch, SharedMcpRefusal } from "@noldova/teamrun.core";
import { type Provider, ProviderKind, ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings, type SharedMcpTransport } from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { AcpLaunch } from "../../models/acp-launch.js";
import { AcpMcpTool } from "../../models/acp-mcp-tool.js";
import { AcpModelMember } from "../../models/acp-model-member.js";
import type { AcpPermissionSwitch } from "../../models/acp-permission-switch.js";
import type { AntigravityServer } from "../../models/antigravity-server.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { AntigravityEnvironment } from "./antigravity-environment.js";
import { AntigravityInstructions } from "./antigravity-instructions.js";
import { AntigravityModelStore } from "./antigravity-model-store.js";
import { AntigravityProfile } from "./antigravity-profile.js";
import { AntigravityQuestionReader } from "./antigravity-question.reader.js";

export class AntigravityAgent implements IAcpAgent {
  private readonly locate: (chosen: string | null) => AntigravityServer | null;
  private readonly platform: string;
  private readonly defaultProfileDirectory: string;
  private readonly tempRoot: string;
  private readonly log: ILog | null;
  private cleared: boolean = false;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch = new ProfileSearch([], [Resources.profileMarker]);
  public readonly toolTitle: string = Resources.antigravityToolTitle;
  public readonly authMethod: string = Resources.antigravityAuthMethod;
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [Resources.acpRefusal];
  public readonly prefersResume: boolean = true;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean = false;
  public readonly signInUnavailable: string = Resources.antigravitySignInUnavailable;
  public readonly signOut: IAcpSignOutReader | null = null;
  public readonly logsOut: boolean = true;
  public readonly authenticates: boolean = true;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public readonly fallbackModels: readonly string[] = [];
  public readonly compacts: boolean = false;
  public readonly sharedServerTransports: readonly SharedMcpTransport[] = [];
  public readonly sharedServerRefusal: SharedMcpRefusal | null = new SharedMcpRefusal(Resources.antigravitySharedServersKept,
    Resources.antigravitySharedServersKeptShort);
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.acpBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public readonly awaitsTeamRunTools: boolean = false;
  public readonly usage: IAcpUsageReader | null = null;
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader = new AntigravityQuestionReader();
  public readonly interactiveSignIn: boolean = true;
  public readonly turnModels: IAcpModelStore;
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.antigravityDefaultMode, Resources.antigravityDefaultModeName, Resources.antigravityDefaultModeDescription),
    new ProviderMode(Resources.antigravityAutoEditMode, Resources.antigravityAutoEditModeName, Resources.antigravityAutoEditModeDescription),
    new ProviderMode(Resources.antigravityYoloMode, Resources.antigravityYoloModeName, Resources.antigravityYoloModeDescription, true)];
  public readonly defaultMode: string | null = Resources.antigravityDefaultMode;
  public readonly isolatedMode: string = Resources.antigravityDefaultMode;
  public readonly permissionSwitch: AcpPermissionSwitch | null = null;
  public readonly launchMode: string | null = null;

  public constructor(locate: (chosen: string | null) => AntigravityServer | null, platform: string, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string,
    tempRoot: string, log: ILog | null = null) {
    this.descriptor = new ProviderKind(Resources.antigravityKindId, Resources.antigravityDisplayName, true, true, null,
      new ProviderProfile(Resources.antigravityHomeVariable, null, defaultProfileDirectory),
      true, null, false, null, false, null, ProviderAbilityTable.antigravity, false, false,
      { resume: false, fork: false, ownMcpServersUnavailable: null }, null, true);
    this.locate = locate;
    this.platform = platform;
    this.baseEnvironment = environment;
    this.defaultProfileDirectory = defaultProfileDirectory;
    this.tempRoot = tempRoot;
    this.log = log;
    this.turnModels = new AntigravityModelStore(defaultProfileDirectory, tempRoot);
  }

  public launch(provider: Provider | null, _requested: RequestedSettings | null = null, _workingDirectory: string | null = null,
    _approvedTools: readonly string[] | null = null, environment: NodeJS.ProcessEnv = this.baseEnvironment, chatTurn: boolean = false): AcpLaunch {
    const chosen = provider?.binaryPath ?? null;
    const server = this.locate(chosen);
    if (Object.isNull(server))
      throw new ExecutableNotFoundException(Object.isNull(chosen) ? Resources.antigravityNotFound : Resources.formatAntigravityChosenNotFound(chosen));
    if (!this.cleared) {
      this.cleared = true;
      rmSync(this.tempRoot, { recursive: true, force: true, maxRetries: Resources.removeRetries });
    }
    const profile = new AntigravityProfile(provider?.profileDir ?? this.defaultProfileDirectory, this.tempRoot);
    profile.prepare();
    if (chatTurn)
      for (const failure of profile.linkPersonFiles(AntigravityInstructions.home(environment, this.platform)))
        this.log?.write(failure);
    const home = chatTurn ? profile.directory : profile.prepareHiddenHome();
    const command = this.platform === Resources.linuxPlatform ? server.command.withArguments(...Resources.antigravityLinuxArguments) : server.command;
    return new AcpLaunch(command, AntigravityEnvironment.build(this.platform, environment, profile, home, server.harnessPath), profile.directory);
  }

  public isSignedIn(provider: Provider | null): boolean {
    return new AntigravityProfile(provider?.profileDir ?? this.defaultProfileDirectory, this.tempRoot).hasToken();
  }

  public forgetSignIn(provider: Provider): void {
    new AntigravityProfile(provider.profileDir, this.tempRoot).forgetToken();
  }

  public readModels(_initialized: JsonReader): readonly ProviderModel[] | null {
    return null;
  }

  public readVersion(initialized: JsonReader): string | null {
    const info = initialized.hasField(Resources.acpAgentInfoField) ? initialized.readNullableObject(Resources.acpAgentInfoField) : null;
    return info?.readOptionalString(Resources.acpVersionField) ?? null;
  }

  public readSignInMethod(_initialized: JsonReader): string | null {
    return this.authMethod;
  }

  public readEffort(_session: JsonReader): string | null {
    return null;
  }

  public mcpToolOf(tool: JsonReader): AcpMcpTool | null {
    return AcpMcpTool.read(tool, [Resources.acpMetaField, Resources.antigravityMcpField], Resources.antigravityMcpServerField, Resources.antigravityMcpToolField);
  }

  public memberOf(value: string, name: string): AcpModelMember | null {
    const id = Resources.antigravityLevelIdPattern.exec(value);
    const label = Resources.antigravityLevelNamePattern.exec(name);
    if (Object.isNull(id) || Object.isNull(label) || id[2] !== label[2]!.toLowerCase())
      return null;
    return new AcpModelMember(id[1]!, label[1]!, label[2]!);
  }

  public sessionMeta(): JsonObject | null {
    return null;
  }

  public formatUnsupported(version: string | null): string | null {
    return !Object.isNull(version) && Resources.antigravityAcceptedVersionPattern.test(version) ? null : Resources.formatAntigravityUnsupported(version);
  }

  public formatSignIn(provider: Provider | null): string {
    return Resources.formatAntigravitySignIn(provider?.profileDir ?? this.defaultProfileDirectory);
  }

  public formatStopped(reason: string): string {
    return Resources.formatAntigravityStopped(reason);
  }

  public readHomeInstructions(environment: NodeJS.ProcessEnv, workingDirectory: string | null = null): string | null {
    return AntigravityInstructions.read(environment, this.platform, workingDirectory);
  }
}
