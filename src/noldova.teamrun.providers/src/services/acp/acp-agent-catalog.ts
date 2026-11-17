/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { AcpAgentOffer, AcpStoredAgent, type IAcpAgentCatalog, type IProviderAdapter, type IProviderKindInstallation, type ISharedMcpSecrets } from "@noldova/teamrun.core";
import { AcpAgentEntry, AcpAgentListing, type AcpLocalCommandAddParams } from "@noldova/teamrun.protocol";

import { AgentLaunchException } from "../../exceptions/agent-launch.exception.js";
import type { AcpInstallTools } from "../../models/acp-install-tools.js";
import { AcpRegistryAgent } from "../../models/acp-registry-agent.js";
import { LocalAcpCommand } from "../../models/local-acp-command.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import type { CommandRunner } from "../process/command-runner.js";
import { AcpAgentInstaller } from "./acp-agent-installer.js";
import type { AcpRegistryIcons } from "./acp-registry-icons.js";
import type { AcpRegistrySource } from "./acp-registry-source.js";
import { GeneralAcpAgent } from "./general-acp-agent.js";

export class AcpAgentCatalog implements IAcpAgentCatalog {
  private readonly source: AcpRegistrySource;
  private readonly icons: AcpRegistryIcons;
  private readonly directory: string;
  private readonly target: string | null;
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly homeDirectory: string;
  private readonly tools: AcpInstallTools;
  private readonly runner: CommandRunner;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;
  private readonly secrets: ISharedMcpSecrets;
  private readonly adapterOf: (agent: GeneralAcpAgent, installation: IProviderKindInstallation | null) => IProviderAdapter;

  public constructor(source: AcpRegistrySource, icons: AcpRegistryIcons, directory: string, target: string | null, platform: string, environment: NodeJS.ProcessEnv,
    homeDirectory: string, tools: AcpInstallTools, runner: CommandRunner, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>,
    secrets: ISharedMcpSecrets, adapterOf: (agent: GeneralAcpAgent, installation: IProviderKindInstallation | null) => IProviderAdapter) {
    this.source = source;
    this.icons = icons;
    this.directory = directory;
    this.target = target;
    this.platform = platform;
    this.environment = environment;
    this.homeDirectory = homeDirectory;
    this.tools = tools;
    this.runner = runner;
    this.rename = rename;
    this.settle = settle;
    this.secrets = secrets;
    this.adapterOf = adapterOf;
  }

  public async listAsync(stored: readonly AcpStoredAgent[]): Promise<AcpAgentListing> {
    const local = stored.filter(t => AcpAgentCatalog.isLocal(t)).map(t => AcpAgentCatalog.addedEntry(t));
    const fromRegistry = stored.filter(t => !AcpAgentCatalog.isLocal(t));
    try {
      const listing = await this.source.readAsync();
      const listed = listing.registry.agents.filter(t => t.isListedFor(this.target));
      const gone = fromRegistry.filter(t => !listed.some(u => u.id === t.kind)).map(t => AcpAgentCatalog.addedEntry(t));
      return new AcpAgentListing([...listed.map(t => this.entryOf(t, fromRegistry.some(u => u.kind === t.id))), ...gone], local, listing.failure, listing.fetchedAt.toISOString());
    }
    catch (error) {
      return new AcpAgentListing(fromRegistry.map(t => AcpAgentCatalog.addedEntry(t)), local, FailureDescriber.describe(error), null);
    }
  }

  public async readIconAsync(id: string): Promise<string | null> {
    const agent = await this.latestOf(id).catch(() => null);
    return Object.isNull(agent) ? null : this.icons.readAsync(agent);
  }

  public async readOfferAsync(id: string): Promise<AcpAgentOffer | null> {
    const agent = await this.latestOf(id);
    if (Object.isNull(agent) || !agent.isListedFor(this.target))
      return null;
    return new AcpAgentOffer(new AcpStoredAgent(agent.id, agent.name, agent.toJson()), AcpAgentInstaller.refusalOf(agent, this.target, this.tools));
  }

  public localOf(params: AcpLocalCommandAddParams, isTaken: (kind: string) => boolean): AcpStoredAgent {
    const slug = params.name.toLowerCase().replace(Resources.acpLocalSlugPattern, Resources.acpLocalSlugSeparator).replace(Resources.acpLocalSlugEdges, String.empty)
      .slice(0, Resources.acpLocalSlugMaxLength);
    const base = AcpRegistryAgent.isUsableId(slug) ? slug : Resources.acpLocalDefaultId;
    let id = base;
    for (let number = 2; isTaken(`${Resources.localAcpKindPrefix}${id}`); number++)
      id = `${base}${Resources.acpLocalSlugSeparator}${number}`;
    const command = new LocalAcpCommand(id, params.name, params.command, params.arguments, params.secrets);
    return new AcpStoredAgent(command.kindId, command.name, command.toJson());
  }

  public async openAsync(stored: AcpStoredAgent, save: (json: JsonObject) => Promise<void>): Promise<IProviderAdapter> {
    const reader = JsonReader.fromValue(stored.json);
    if (AcpAgentCatalog.isLocal(stored)) {
      const command = LocalAcpCommand.fromJson(reader);
      return this.adapterOf(command.toAgent(await this.readValuesAsync(command), this.environment, this.homeDirectory, this.platform), null);
    }
    const agent = AcpRegistryAgent.fromJson(reader);
    const installer = new AcpAgentInstaller(agent, join(this.directory, agent.id), this.target, this.platform, this.environment, this.tools, this.runner, this.rename, this.settle,
      () => this.latestOf(agent.id).catch(() => null), next => save(next.toJson()));
    return this.adapterOf(new GeneralAcpAgent(agent.id, agent.name, null, () => installer.variables, this.environment, this.homeDirectory, () => installer.commandOf(), () => installer.program), installer);
  }

  public referencesOf(stored: AcpStoredAgent): readonly string[] {
    return AcpAgentCatalog.isLocal(stored) ? LocalAcpCommand.fromJson(JsonReader.fromValue(stored.json)).secrets.map(t => t.reference) : [];
  }

  public async removeFilesAsync(stored: AcpStoredAgent): Promise<void> {
    if (!AcpAgentCatalog.isLocal(stored))
      await Promise.allSettled([rm(join(this.directory, stored.kind), { recursive: true, force: true, maxRetries: Resources.removeRetries })]);
  }

  private async latestOf(id: string): Promise<AcpRegistryAgent | null> {
    return (await this.source.readAsync()).registry.find(id);
  }

  private entryOf(agent: AcpRegistryAgent, added: boolean): AcpAgentEntry {
    const binary = agent.binaryFor(this.target);
    return new AcpAgentEntry(agent.id, agent.name, agent.version, agent.description, agent.about, AcpAgentInstaller.refusalOf(agent, this.target, this.tools),
      !Object.isNull(binary) && Object.isNull(binary.sha256), added);
  }

  private async readValuesAsync(command: LocalAcpCommand): Promise<Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>)> {
    const values: Record<string, string> = {};
    for (const secret of command.secrets) {
      let value: string | null;
      try {
        value = await this.secrets.readAsync(secret.reference);
      }
      catch (error) {
        return AcpAgentCatalog.refused(Resources.formatLocalAcpSecretUnreadable(command.name, secret.variable, FailureDescriber.describe(error)));
      }
      if (Object.isNull(value))
        return AcpAgentCatalog.refused(Resources.formatLocalAcpSecretMissing(command.name, secret.variable));
      values[secret.variable] = value;
    }
    return values;
  }

  private static isLocal(stored: AcpStoredAgent): boolean {
    return stored.kind.startsWith(Resources.localAcpKindPrefix);
  }

  private static refused(reason: string): () => Readonly<Record<string, string>> {
    return () => {
      throw new AgentLaunchException(reason);
    };
  }

  private static addedEntry(stored: AcpStoredAgent): AcpAgentEntry {
    return new AcpAgentEntry(stored.kind, stored.name, String.empty, String.empty, null, null, false, true);
  }
}
