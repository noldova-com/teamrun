/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, renameSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { type ILog, type ISharedMcpSecrets, ProviderKindRegistry } from "@noldova/teamrun.core";
import {
  AcpAgentCatalog,
  AcpInstallTools,
  AcpRegistryAgent,
  AcpRegistryIcons,
  AcpRegistrySource,
  AgentSdkQueryFactory,
  AntigravityAdapter,
  AntigravityInstaller,
  AntigravityRelease,
  AppServerClientInfo,
  ClaudeAdapter,
  ClaudeInstaller,
  CodexAdapter,
  CodexAppServerDownload,
  CodexAppServerProgram,
  CodexInstaller,
  CommandLineTool,
  CommandRunner,
  CopilotAdapter,
  CopilotInstaller,
  CursorAdapter,
  CursorInstaller,
  CursorRelease,
  ExecutableLocator,
  ExecutableVersionReader,
  FxAdapter,
  GeneralAcpAdapter,
  GrokAdapter,
  MuseAdapter,
  GrokInstaller,
  GrokRelease,
  InstallRename,
  type IProcessStarter,
  type LocatedExecutable,
  OpencodeAdapter,
  PiAdapter,
  ProcessCommand,
  ProviderTimings,
  Resources as ProviderResources,
  UsualFolder
} from "@noldova/teamrun.providers";

import type { IProviderKindRegistryFactory } from "../interfaces/i-provider-kind-registry-factory.js";
import { Resources } from "../resources.js";

export class ProviderKindRegistryFactory implements IProviderKindRegistryFactory {
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly locator: ExecutableLocator;

  public constructor(baseEnvironment: NodeJS.ProcessEnv, locator: ExecutableLocator) {
    this.baseEnvironment = baseEnvironment;
    this.locator = locator;
  }

  public static fromProcess(): ProviderKindRegistryFactory {
    return new ProviderKindRegistryFactory(process.env, ExecutableLocator.fromProcess());
  }

  public create(productVersion: string, dataDirectory: string, starter: IProcessStarter, log: ILog | null = null): ProviderKindRegistry {
    const registry = new ProviderKindRegistry();
    const timings = ProviderTimings.createDefault();
    const runner = new CommandRunner(starter);
    const clientInfo = new AppServerClientInfo(Resources.clientName, Resources.clientTitle, productVersion);
    const versionReader = new ExecutableVersionReader(runner, timings.versionTimeout);
    const renames = new InstallRename(process.platform, renameSync);
    const settle = renames.moveAsync.bind(renames);
    const tool = (kind: string, locate: () => LocatedExecutable | null, posixCommand: string, windowsCommand: string | null, subscribeUrl: string | null,
      environment: NodeJS.ProcessEnv = this.baseEnvironment): CommandLineTool =>
      new CommandLineTool(kind, locate, versionReader, environment, CommandLineTool.installCommandFor(process.platform, posixCommand, windowsCommand), subscribeUrl);
    const codexCommand = ProviderKindRegistryFactory.toCommand(this.locator.locateCodex(null));
    const codexInstaller = new CodexInstaller(() => this.locator.locateCodex(null), versionReader, this.baseEnvironment, ProviderResources.codexReleaseChannels,
      UsualFolder.of(this.baseEnvironment, ProviderResources.codexHomeVariable, ProviderResources.codexHomeFolderName), this.locator.codexInstallDirectory(),
      CodexInstaller.targetOf(process.platform, process.arch), process.platform, this.locator.locateTar(), runner, CodexInstaller.programOf, symlinkSync,
      renameSync, settle, Resources.codexUnpackTimeout, Resources.releaseChannelTimeout);
    const codexServerProgram = new CodexAppServerProgram(runner, versionReader, new CodexAppServerDownload(join(dataDirectory, ...Resources.codexAppServerSegments),
      ProviderResources.codexAppServerReleaseAddress, CodexInstaller.targetOf(process.platform, process.arch), process.platform, this.locator.locateTar(), runner,
      Resources.codexUnpackTimeout, log), timings.versionTimeout, log);
    registry.register(new CodexAdapter(codexCommand, this.baseEnvironment, clientInfo, starter, timings, versionReader, undefined,
      () => ProviderKindRegistryFactory.toCommand(this.locator.locateCodex(null)), codexInstaller, log, undefined, undefined, undefined, codexServerProgram),
      tool(ProviderResources.codexKindId, () => this.locator.locateCodex(null), ProviderResources.codexPosixInstallCommand, ProviderResources.codexWindowsInstallCommand,
        ProviderResources.codexSubscribeUrl));
    registry.register(new ClaudeAdapter(
      ProviderKindRegistryFactory.toCommand(this.locator.locateClaude(null)),
      this.baseEnvironment,
      productVersion,
      new AgentSdkQueryFactory(starter),
      runner,
      versionReader,
      timings,
      undefined,
      () => ProviderKindRegistryFactory.toCommand(this.locator.locateClaude(null)),
      new ClaudeInstaller(() => this.locator.locateClaude(null), versionReader, this.baseEnvironment, ProviderResources.claudeReleaseChannel,
        join(dataDirectory, ...Resources.claudeInstallSegments),
        ClaudeInstaller.targetOf(process.platform, process.arch, ProviderResources.muslLoaderPaths.some(t => existsSync(t))), runner, ClaudeInstaller.programOf,
        Resources.releaseChannelTimeout), undefined, log),
      tool(ProviderResources.claudeKindId, () => this.locator.locateClaude(null), ProviderResources.claudePosixInstallCommand, ProviderResources.claudeWindowsInstallCommand,
        ProviderResources.claudeSubscribeUrl));
    registry.register(new GrokAdapter(ProviderKindRegistryFactory.toCommand(this.locator.locateGrok(null)), this.baseEnvironment,
      join(dataDirectory, ...Resources.grokProfileSegments), clientInfo, starter, timings, undefined, undefined,
      () => ProviderKindRegistryFactory.toCommand(this.locator.locateGrok(null)), log,
      new GrokInstaller(() => this.locator.locateGrok(null), versionReader, this.baseEnvironment, GrokRelease.find(process.platform, process.arch),
        this.locator.grokInstallDirectory(), process.platform, GrokInstaller.programOf, symlinkSync, renameSync, settle)),
      tool(ProviderResources.grokKindId, () => this.locator.locateGrok(null), ProviderResources.grokPosixInstallCommand, ProviderResources.grokWindowsInstallCommand,
        ProviderResources.grokSubscribeUrl));
    const copilotDirectory = this.locator.copilotInstallDirectory(join(dataDirectory, ...Resources.copilotInstallSegments));
    const locateCopilot = (): LocatedExecutable | null => this.locator.locateCopilot(null, copilotDirectory);
    const copilotInstaller = new CopilotInstaller(locateCopilot, versionReader, this.baseEnvironment, ProviderResources.copilotReleaseChannel, copilotDirectory,
      CopilotInstaller.targetOf(process.platform, process.arch, ProviderResources.muslLoaderPaths.some(t => existsSync(t))), process.platform,
      this.locator.locateTar(), runner, CopilotInstaller.programOf, renameSync, settle,
      Resources.copilotUnpackTimeout, Resources.releaseChannelTimeout);
    registry.register(new CopilotAdapter(ProviderKindRegistryFactory.toCommand(locateCopilot()), this.baseEnvironment,
      join(dataDirectory, ...Resources.copilotWorkSegments), clientInfo, starter, timings, undefined, log,
      () => ProviderKindRegistryFactory.toCommand(locateCopilot()), copilotInstaller),
      tool(ProviderResources.copilotKindId, locateCopilot, ProviderResources.copilotPosixInstallCommand,
        ProviderResources.copilotWindowsInstallCommand, ProviderResources.copilotSubscribeUrl));
    const locateOpencode = (): LocatedExecutable | null => this.locator.locateOpencode(null);
    registry.register(new OpencodeAdapter(ProviderKindRegistryFactory.toCommand(locateOpencode()), this.baseEnvironment,
      join(dataDirectory, ...Resources.opencodeProfileSegments), clientInfo, starter, timings, undefined, undefined,
      () => ProviderKindRegistryFactory.toCommand(locateOpencode()), log),
      tool(ProviderResources.opencodeKindId, locateOpencode, ProviderResources.opencodePosixInstallCommand, ProviderResources.opencodeWindowsInstallCommand,
        ProviderResources.opencodeSubscribeUrl));
    const cursorDirectory = join(dataDirectory, ...Resources.cursorInstallSegments);
    const locateCursor = (): LocatedExecutable | null => this.locator.locateCursor(null, cursorDirectory);
    const cursorInstaller = new CursorInstaller(locateCursor, versionReader, this.baseEnvironment, CursorRelease.find(process.platform, process.arch), cursorDirectory,
      process.platform, this.locator.locateTar(), runner, CursorInstaller.programOf, renameSync, settle, Resources.cursorUnpackTimeout);
    registry.register(new CursorAdapter(ProviderKindRegistryFactory.toCommand(locateCursor()), this.baseEnvironment,
      join(dataDirectory, ...Resources.cursorProfileSegments), clientInfo, starter, timings, undefined, undefined,
      () => ProviderKindRegistryFactory.toCommand(locateCursor()), log, undefined, cursorInstaller),
      tool(ProviderResources.cursorKindId, locateCursor, ProviderResources.cursorPosixInstallCommand, ProviderResources.cursorWindowsInstallCommand,
        ProviderResources.cursorSubscribeUrl));
    const locateFx = (): LocatedExecutable | null => this.locator.locateFx(null, this.baseEnvironment[ProviderResources.fxInstallDirectoryVariable] ?? null);
    registry.register(new FxAdapter(ProviderKindRegistryFactory.toCommand(locateFx()), this.baseEnvironment, clientInfo, starter, timings,
      undefined, undefined, () => ProviderKindRegistryFactory.toCommand(locateFx()), log),
      tool(ProviderResources.fxKindId, locateFx, ProviderResources.fxInstallCommand, null, ProviderResources.fxSubscribeUrl));
    const antigravityDirectory = join(dataDirectory, ...Resources.antigravityInstallSegments);
    const antigravityInstaller = new AntigravityInstaller(AntigravityRelease.find(process.platform, process.arch), antigravityDirectory, this.locator.locateUnzip(),
      process.platform, process.arch, new ProcessCommand(Resources.codesignPath, []), runner, Resources.antigravityUnpackTimeout, Resources.antigravitySignTimeout);
    registry.register(new AntigravityAdapter(this.locator.locateAntigravityServer.bind(this.locator, antigravityDirectory), antigravityInstaller, process.platform,
      this.baseEnvironment, join(dataDirectory, ...Resources.antigravityProfileSegments), join(dataDirectory, ...Resources.antigravityTempSegments), clientInfo,
      starter, timings, undefined, log));
    registry.register(new PiAdapter(ProviderKindRegistryFactory.toCommand(this.locator.locatePi(null)), this.baseEnvironment,
      join(dataDirectory, ...Resources.piExtensionSegments), starter, runner, timings, versionReader,
      () => ProviderKindRegistryFactory.toCommand(this.locator.locatePi(null))),
      tool(ProviderResources.piKindId, () => this.locator.locatePi(null), ProviderResources.piPosixInstallCommand, ProviderResources.piWindowsInstallCommand, null));
    const locateMuse = (): LocatedExecutable | null => this.locator.locateMuse(null, this.baseEnvironment[ProviderResources.museInstallDirectoryVariable] ?? null);
    registry.register(new MuseAdapter(null, this.baseEnvironment, UsualFolder.home(this.baseEnvironment), clientInfo, starter,
      timings, () => ProviderKindRegistryFactory.toCommand(locateMuse()), undefined, log),
      tool(ProviderResources.museKindId, locateMuse, ProviderResources.musePosixInstallCommand, ProviderResources.museWindowsInstallCommand, ProviderResources.museSubscribeUrl));

    return registry;
  }

  public createAcpCatalog(productVersion: string, dataDirectory: string, starter: IProcessStarter, secrets: ISharedMcpSecrets, log: ILog | null = null): AcpAgentCatalog {
    const folder = join(dataDirectory, Resources.acpAgentsFolderName);
    const timings = ProviderTimings.createDefault();
    const clientInfo = new AppServerClientInfo(Resources.clientName, Resources.clientTitle, productVersion);
    const renames = new InstallRename(process.platform, renameSync);
    return new AcpAgentCatalog(
      new AcpRegistrySource(ProviderResources.acpRegistryUrl, join(folder, Resources.acpRegistryFileName), ProviderResources.acpRegistryMaxAge, Resources.acpRegistryTimeout),
      new AcpRegistryIcons(join(folder, Resources.acpIconsFolderName), Resources.acpRegistryTimeout), join(folder, Resources.acpInstallsFolderName),
      AcpRegistryAgent.targetOf(process.platform, process.arch), process.platform, this.baseEnvironment, homedir(),
      new AcpInstallTools(this.locator.locateTar(), this.locator.locateUnzip(), this.locator.locateNpm()), new CommandRunner(starter), renameSync, renames.moveAsync.bind(renames), secrets,
      (agent, installation) => new GeneralAcpAdapter(agent, installation, clientInfo, starter, timings, log));
  }

  private static toCommand(executable: LocatedExecutable | null): ProcessCommand | null {
    return Object.isNull(executable) ? null : executable.toCommand();
  }
}
