/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";
import { type OwnMcpServer, type Provider, ProviderKind, ProviderProfile, type RequestedSettings, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { AcpLaunch } from "../../models/acp-launch.js";
import { CommandSource } from "../../models/command-source.js";
import { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";
import { GeneralAcpAgent } from "../acp/general-acp-agent.js";
import { OwnMcpServersFile } from "../own-mcp-servers-file.js";
import { UsualFolder } from "../usual-folder.js";

export class MuseAgent extends GeneralAcpAgent {
  public override readonly descriptor: ProviderKind;
  public override readonly logsOut: boolean = false;
  public override readonly compacts: boolean = true;
  public override readonly backgroundSubAgentsNote: string | null = null;
  public override readonly sharedServerTransports: readonly SharedMcpTransport[] = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];

  private readonly ownFolders: readonly string[];
  private readonly ownFolder: string;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, homeDirectory: string, locate: () => ProcessCommand | null = CommandSource.none,
    platform: string = process.platform) {
    super(Resources.museKindId, Resources.museDisplayName, command, { [Resources.museAcpGateVariable]: Resources.museAcpGateOn }, environment, homeDirectory, locate);
    this.descriptor = new ProviderKind(Resources.museKindId, Resources.museDisplayName, true, false, null,
      new ProviderProfile(Resources.xdgConfigVariable, Resources.museSignInCommand, UsualFolder.of(environment, Resources.xdgConfigVariable, Resources.museConfigFolderName)),
      false, Resources.museSignOutCommand, true, platform === Resources.museMacPlatform ? Resources.museOneAccountPerMac : null,
      false, null, ProviderAbilityTable.muse);
    this.ownFolders = UsualFolder.places(environment, Resources.xdgConfigVariable, Resources.museConfigFolderName, homeDirectory);
    this.ownFolder = UsualFolder.place(environment, Resources.xdgConfigVariable, Resources.museConfigFolderName, homeDirectory);
  }

  public override launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null = null,
    approvedTools: readonly string[] | null = null, environment: NodeJS.ProcessEnv = this.baseEnvironment): AcpLaunch {
    const launched = super.launch(provider, requested, workingDirectory, approvedTools, environment);
    const logged = Object.isNull(requested) ? [Resources.museNoSessionLogArgument] : [];
    return new AcpLaunch(new ProcessCommand(launched.command.executable, [...launched.command.arguments, Resources.museAcpArgument, ...logged], launched.command.origin,
      launched.command.isVerbatim, launched.command.ownsGroup),
      { ...AcpEnvironment.copy(launched.environment, Resources.museExcludedEnvironment),
        ...Object.isNull(provider) || this.ownFolders.includes(provider.profileDir) ? {} : { [Resources.xdgConfigVariable]: provider.profileDir } },
      launched.directory);
  }

  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    const folder = Object.isNull(provider) || this.ownFolders.includes(provider.profileDir) ? this.ownFolder : provider.profileDir;
    const file = join(folder, Resources.museSettingsFolder, Resources.museSettingsFile);
    return OwnMcpServersFile.listInAsync(file, t => t.toJson()[Resources.museSchemaVersionField] === Resources.museSchemaVersion ? null
      : Resources.formatMuseSettingsUnsupported(file));
  }

  public override formatSignIn(_provider: Provider | null): string {
    return Resources.museSignIn;
  }

  public isSignedOutRefusal(_code: number | null, message: string): boolean {
    return message.toLowerCase().includes(Resources.museSignedOutRefusal);
  }
}
