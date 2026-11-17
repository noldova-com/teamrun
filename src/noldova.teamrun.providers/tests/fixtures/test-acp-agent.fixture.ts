/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import { type ProfileSearch, SharedMcpRefusal } from "@noldova/teamrun.core";
import { type Provider, ProviderKind, type ProviderMode, type ProviderModel, ProviderProfile, type RequestedSettings, type SharedMcpTransport } from "@noldova/teamrun.protocol";
import {
  AcpLaunch,
  type AcpMcpTool,
  type AcpModelMember,
  type AcpPermissionSwitch,
  GrokModelReader,
  GrokSignOutReader,
  type IAcpAccountReader,
  type IAcpAgent,
  type IAcpModelStore,
  type IAcpPlanReader,
  type IAcpQuestionReader,
  type IAcpSignOutReader,
  type IAcpToDoReader,
  type IAcpUsageReader,
  type ProcessCommand,
  Resources
} from "@noldova/teamrun.providers";

export class TestAcpAgent implements IAcpAgent {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly directory: string;
  private readonly signedIn: boolean | null;

  public readonly descriptor: ProviderKind;
  public baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch | null = null;
  public readonly toolTitle: string = "Fake ACP tool";
  public readonly authMethod: string = "cached_token";
  public readonly authMeta: JsonObject | null = null;
  public readonly initializeMeta: JsonObject | null = null;
  public readonly stopReasons: readonly string[] = [];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[] = [];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string = "Fake ACP offers no sign-in.";
  public prepareProfile?: (provider: Provider) => void;
  public signOut: IAcpSignOutReader | null = new GrokSignOutReader();
  public logsOut: boolean = false;
  public authenticates: boolean = true;
  public readonly effortAtLaunch: boolean = false;
  public readonly modelAtLaunch: boolean = false;
  public fallbackModels: readonly string[] = [];
  public readsModels: boolean = false;
  public readonly compacts: boolean = true;
  public sharedServerTransports: readonly SharedMcpTransport[] = [];
  public sharedServerRefusal: SharedMcpRefusal | null = null;
  public ownServerNames: readonly string[] = [];
  public readonly followsTasks: boolean = false;
  public readonly backgroundSubAgentsNote: string | null = Resources.acpBackgroundSubAgentsNote;
  public readonly routedMcpTool: string | null = null;
  public awaitsTeamRunTools: boolean = false;
  public usage: IAcpUsageReader | null = null;
  public readonly account: IAcpAccountReader | null = null;
  public readonly toDos: IAcpToDoReader | null = null;
  public readonly questions: IAcpQuestionReader | null = null;
  public readonly interactiveSignIn: boolean = false;
  public turnModels: IAcpModelStore | null = null;
  public modes: readonly ProviderMode[] = [];
  public readonly isolatedMode: string = "ask";
  public defaultMode: string | null = null;
  public planMode: string | null = null;
  public takesUnlistedModes: boolean = false;
  public plans: IAcpPlanReader | null = null;
  public permissionSwitch: AcpPermissionSwitch | null = null;
  public launchMode: string | null = null;
  public members: ReadonlyMap<string, AcpModelMember> = new Map();
  public launches: number = 0;
  public readonly launchFolders: (string | null)[] = [];
  public readonly launchApprovals: (readonly string[] | null)[] = [];
  public readonly launchChatTurns: boolean[] = [];
  public readonly launchTitleSessions: boolean[] = [];
  public mcpToolOf?: (tool: JsonReader) => AcpMcpTool | null;
  public listsToolsBeforeSession?: (initialized: JsonReader) => boolean;
  public readUntrustedFolder?: (initialized: JsonReader, environment: NodeJS.ProcessEnv, workingDirectory: string | null) => string | null;
  public readMissingTools?: (initialized: JsonReader) => string | null;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string, prefersResume: boolean = true,
    sendsResourceLinks: boolean = true, signedIn: boolean | null = null, signInCommand: string | null = null) {
    this.descriptor = new ProviderKind("fake-acp", "Fake ACP", true, false, null, Object.isNull(signInCommand) ? null : new ProviderProfile("FAKE_ACP_HOME", signInCommand));
    this.command = command;
    this.environment = environment;
    this.baseEnvironment = environment;
    this.directory = directory;
    this.prefersResume = prefersResume;
    this.sendsResourceLinks = sendsResourceLinks;
    this.signedIn = signedIn;
  }

  public launch(_provider: Provider | null, _requested: RequestedSettings | null, workingDirectory: string | null, approvedTools: readonly string[] | null,
    environment: NodeJS.ProcessEnv = this.environment, chatTurn: boolean = false, titleSession: boolean = false): AcpLaunch {
    this.launches++;
    this.launchFolders.push(workingDirectory);
    this.launchApprovals.push(approvedTools);
    this.launchChatTurns.push(chatTurn);
    this.launchTitleSessions.push(titleSession);
    return new AcpLaunch(this.command, { ...environment, ...this.environment }, this.directory);
  }

  public isSignedIn(): boolean | null {
    return this.signedIn;
  }

  public readModels(initialized: JsonReader): readonly ProviderModel[] | null {
    return this.readsModels ? GrokModelReader.read(initialized) : null;
  }

  public readVersion(initialized: JsonReader): string | null {
    return initialized.hasField("agentInfo") ? initialized.readObject("agentInfo").readOptionalString("version") ?? null : null;
  }

  public readSignInMethod(_initialized: JsonReader): string | null {
    return Object.isNull(this.signedIn) ? null : this.authMethod;
  }

  public readEffort(_session: JsonReader): string | null {
    return null;
  }

  public memberOf(value: string, _name: string): AcpModelMember | null {
    return this.members.get(value) ?? null;
  }

  public sessionMeta(): JsonObject | null {
    return null;
  }

  public formatUnsupported(version: string | null): string | null {
    return version === "0.0.0" ? "Fake ACP 0.0.0 isn't supported." : null;
  }

  public formatSignIn(provider: Provider | null): string {
    return `Sign in to Fake ACP at ${provider?.profileDir ?? this.directory}.`;
  }

  public formatStopped(reason: string): string {
    return `Fake ACP stopped: ${reason}.`;
  }

  public sharedServerNameRefusal(name: string, provider: Provider | null, workingDirectory: string | null): SharedMcpRefusal | null {
    return this.ownServerNames.includes(name)
      ? new SharedMcpRefusal(`Fake ACP has its own ${name} for ${provider?.id ?? "no provider"} in ${workingDirectory ?? "no folder"}.`, "has its own")
      : null;
  }
}
