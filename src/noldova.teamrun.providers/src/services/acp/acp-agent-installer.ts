/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { InstallHeldException } from "../../exceptions/install-held.exception.js";
import type { AcpInstallTools } from "../../models/acp-install-tools.js";
import type { AcpRegistryAgent } from "../../models/acp-registry-agent.js";
import type { AcpRegistryBinary } from "../../models/acp-registry-binary.js";
import type { AcpRegistryPackage } from "../../models/acp-registry-package.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import { ZipDirectory } from "../archives/zip-directory.js";
import { ArchiveUnpacker } from "../installs/archive-unpacker.js";
import { DownloadAddress } from "../installs/download-address.js";
import { InstallRename } from "../installs/install-rename.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";
import { AcpCommandLine } from "./acp-command-line.js";

export class AcpAgentInstaller implements IProviderKindInstallation {
  private current: AcpRegistryAgent;
  private readonly directory: string;
  private readonly target: string | null;
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly tools: AcpInstallTools;
  private readonly runner: CommandRunner;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;
  private readonly latest: () => Promise<AcpRegistryAgent | null>;
  private readonly saved: (agent: AcpRegistryAgent) => Promise<void>;

  public constructor(agent: AcpRegistryAgent, directory: string, target: string | null, platform: string, environment: NodeJS.ProcessEnv, tools: AcpInstallTools,
    runner: CommandRunner, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>,
    latest: () => Promise<AcpRegistryAgent | null>, saved: (agent: AcpRegistryAgent) => Promise<void>) {
    this.current = agent;
    this.directory = directory;
    this.target = target;
    this.platform = platform;
    this.environment = environment;
    this.tools = tools;
    this.runner = runner;
    this.rename = rename;
    this.settle = settle;
    this.latest = latest;
    this.saved = saved;
  }

  public get unavailable(): string | null {
    return this.isInstalled ? null : AcpAgentInstaller.refusalOf(this.current, this.target, this.tools);
  }

  public get missingTool(): string | null {
    return this.isInstalled ? null : AcpAgentInstaller.missingToolOf(this.current, this.target, this.tools);
  }

  public get isInstalled(): boolean {
    return existsSync(join(this.directory, this.current.version));
  }

  public get variables(): Readonly<Record<string, string>> {
    return this.current.binaryFor(this.target)?.environment ?? this.current.npx?.environment ?? {};
  }

  public get program(): string | null {
    const folder = join(this.directory, this.current.version);
    if (!existsSync(folder))
      return null;
    const binary = this.current.binaryFor(this.target);
    if (!Object.isNull(binary))
      return binary.commandIn(folder).executable;
    return Object.isNull(this.current.npx) ? null : this.programOf(this.current, folder, this.current.npx);
  }

  public static refusalOf(agent: AcpRegistryAgent, target: string | null, tools: AcpInstallTools): string | null {
    const plan = AcpAgentInstaller.planOf(agent, target, tools);
    return Object.isString(plan) ? plan : null;
  }

  public commandOf(): ProcessCommand | null {
    const folder = join(this.directory, this.current.version);
    if (!existsSync(folder))
      return null;
    const binary = this.current.binaryFor(this.target);
    if (!Object.isNull(binary)) {
      const command = binary.commandIn(folder);
      return AcpCommandLine.of(this.platform, this.environment, binary.environment, command.executable, command.arguments);
    }
    const npx = this.current.npx;
    if (Object.isNull(npx))
      return null;
    return AcpCommandLine.of(this.platform, this.environment, npx.environment, this.programOf(this.current, folder, npx), npx.arguments);
  }

  public async readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    const installed = this.isInstalled ? this.current.version : null;
    if (!checksLatest)
      return new ProviderKindVersions(installed, null);
    const latest = await this.latest();
    return new ProviderKindVersions(installed, latest?.version ?? this.current.version);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string> {
    const next = await this.latest() ?? this.current;
    const plan = AcpAgentInstaller.planOf(next, this.target, this.tools);
    if (Object.isString(plan))
      throw new InstallFailedException(plan);
    const staging = InstallStaging.writing(Resources.formatAcpAgentFolderNotWritable(this.directory), () => {
      mkdirSync(this.directory, { recursive: true });
      return InstallStaging.open(this.directory);
    });
    const folder = join(this.directory, next.version);
    const previous = this.current.version;
    let committed = false;
    try {
      const unpacked = join(staging, Resources.acpAgentUnpackedName);
      mkdirSync(unpacked);
      await plan(this, staging, unpacked, progress, signal);
      signal.throwIfAborted();
      committed = true;
      commit();
      if (!existsSync(folder))
        await this.place(next, unpacked, staging, folder);
      this.current = next;
      await this.saved(next);
      await this.sweepOthers([next.version, previous]);
      return folder;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(next.name), error);
      throw error;
    }
    finally {
      InstallStaging.close(staging);
    }
  }

  private async installBinary(agent: AcpRegistryAgent, binary: AcpRegistryBinary, extractor: LocatedExecutable | null, staging: string, unpacked: string,
    progress: (received: number, total: number) => void, signal: AbortSignal): Promise<void> {
    if (!DownloadAddress.isSafe(binary.archive))
      throw new InstallFailedException(Resources.formatAcpAgentArchiveInsecure(agent.name));
    const download = join(staging, Resources.acpAgentDownloadName);
    await ReleaseDownload.save(new ReleaseFile(binary.archive, binary.sha256, null), download, agent.name, progress, signal);
    signal.throwIfAborted();
    const program = binary.commandIn(unpacked).executable;
    if (Object.isNull(extractor)) {
      mkdirSync(dirname(program), { recursive: true });
      this.rename(download, program);
    }
    else {
      if (binary.isZip && !ZipDirectory.isSafe(download))
        throw new InstallFailedException(Resources.formatAcpAgentArchiveUnsafe(agent.name));
      const command = binary.isZip ? ArchiveUnpacker.command(extractor, download, unpacked)
        : extractor.toCommand().withArguments(...Resources.tarExtractArguments, download, Resources.tarDirectoryArgument, unpacked);
      const result = await this.runner.run(command, {}, Resources.acpAgentUnpackTimeout, signal);
      if (!result.succeeded)
        throw new InstallFailedException(Resources.formatAcpAgentUnpackFailed(agent.name, result.timedOut ? null : result.exitCode));
    }
    AcpAgentInstaller.requireProgram(agent, unpacked, program);
    if (this.platform !== Resources.windowsPlatform)
      chmodSync(program, Resources.executableMode);
  }

  private async installPackage(agent: AcpRegistryAgent, npx: AcpRegistryPackage, npm: LocatedExecutable, unpacked: string, signal: AbortSignal): Promise<void> {
    const args = [...Resources.acpNpmInstallArguments, Resources.acpNpmPrefixArgument, unpacked, npx.name];
    const result = await this.runner.run(AcpCommandLine.of(this.platform, this.environment, {}, npm.path, args), this.environment, Resources.acpAgentNpmTimeout, signal);
    if (!result.succeeded)
      throw new InstallFailedException(Resources.formatAcpAgentNpmFailed(agent.name, result.timedOut ? null : result.exitCode, result.stderr.trim()));
    const installed = AcpAgentInstaller.manifestOf(agent, unpacked, npx);
    if (installed.readOptionalString(Resources.acpRegistryVersionField) !== npx.npmVersion)
      throw new InstallFailedException(Resources.formatAcpAgentPackageIncomplete(agent.name, npx.name));
    AcpAgentInstaller.requireProgram(agent, unpacked, this.programOf(agent, unpacked, npx));
  }

  private programOf(agent: AcpRegistryAgent, folder: string, npx: AcpRegistryPackage): string {
    const name = AcpAgentInstaller.binNameOf(AcpAgentInstaller.manifestOf(agent, folder, npx), npx);
    return join(folder, ...Resources.acpNpmBinSegments, this.platform === Resources.windowsPlatform ? `${name}${Resources.acpNpmWindowsShimExtension}` : name);
  }

  private async place(agent: AcpRegistryAgent, unpacked: string, staging: string, folder: string): Promise<void> {
    const ready = join(staging, Resources.installReadyName);
    try {
      await this.settle(unpacked, ready);
      this.rename(ready, folder);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatAcpAgentNotPlaced(agent.name, folder, InstallRename.codeOf(error), error instanceof InstallHeldException), error);
    }
  }

  private async sweepOthers(kept: readonly string[]): Promise<void> {
    await Promise.allSettled(readdirSync(this.directory).filter(t => !kept.includes(t) && !t.startsWith(Resources.stagingPrefix))
      .map(t => rm(join(this.directory, t), { recursive: true, force: true, maxRetries: Resources.removeRetries })));
  }

  private static missingToolOf(agent: AcpRegistryAgent, target: string | null, tools: AcpInstallTools): string | null {
    const binary = agent.binaryFor(target);
    if (Object.isNull(binary))
      return agent.npx?.isExactNpmPackage === true && Object.isNull(tools.npm) ? Resources.npmExecutableName : null;
    if (binary.isRaw)
      return null;
    if (binary.isZip)
      return Object.isNull(tools.unzip) ? Resources.unzipExecutableName : null;
    return Object.isNull(tools.tar) ? Resources.tarCommandName : null;
  }

  private static planOf(agent: AcpRegistryAgent, target: string | null, tools: AcpInstallTools): string | ((installer: AcpAgentInstaller, staging: string, unpacked: string,
    progress: (received: number, total: number) => void, signal: AbortSignal) => Promise<void>) {
    const binary = agent.binaryFor(target);
    if (!Object.isNull(binary)) {
      const extractor = binary.isZip ? tools.unzip : tools.tar;
      if (!binary.isRaw && Object.isNull(extractor))
        return Resources.formatAcpAgentNoExtractor(agent.name);
      const unpacker = binary.isRaw ? null : extractor;
      return (installer, staging, unpacked, progress, signal) => installer.installBinary(agent, binary, unpacker, staging, unpacked, progress, signal);
    }
    const npx = agent.npx;
    if (!Object.isNull(npx)) {
      const npm = tools.npm;
      if (!npx.isExactNpmPackage)
        return Resources.formatAcpAgentPackageRefused(agent.name, npx.name);
      if (Object.isNull(npm))
        return Resources.formatAcpAgentNoNpm(agent.name);
      return (installer, _staging, unpacked, _progress, signal) => installer.installPackage(agent, npx, npm, unpacked, signal);
    }
    return Object.isNull(agent.uvx) ? Resources.formatAcpAgentNoBuild(agent.name) : Resources.formatAcpAgentUvx(agent.name);
  }

  private static manifestOf(agent: AcpRegistryAgent, folder: string, npx: AcpRegistryPackage): JsonReader {
    try {
      return JsonReader.parse(readFileSync(join(folder, Resources.acpNpmModulesFolder, npx.npmPackageName, Resources.acpNpmManifestName), Resources.utf8Encoding));
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatAcpAgentPackageIncomplete(agent.name, npx.name), error);
    }
  }

  private static binNameOf(manifest: JsonReader, npx: AcpRegistryPackage): string {
    const bin = manifest.toJson()[Resources.acpNpmBinField];
    const unscoped = npx.npmPackageName.slice(npx.npmPackageName.lastIndexOf(Resources.acpNpmScopeSeparator) + 1);
    const names = Object.isString(bin) ? [unscoped]
      : Object.keys(Object.isObject(bin) ? bin : {}).map(t => t.slice(t.lastIndexOf(Resources.acpNpmScopeSeparator) + 1));
    const name = names.length === 1 ? names[0] : names.find(t => t === unscoped);
    if (Object.isUndefined(name) || !Resources.acpNpmBinPattern.test(name))
      throw new InstallFailedException(Resources.formatAcpAgentNoProgram(npx.name));
    return name;
  }

  private static requireProgram(agent: AcpRegistryAgent, unpacked: string, program: string): void {
    if (!existsSync(program) || !statSync(program).isFile())
      throw new InstallFailedException(Resources.formatAcpAgentProgramMissing(agent.name, relative(unpacked, program)));
    const within = relative(realpathSync(unpacked), realpathSync(program));
    if (within.startsWith(Resources.acpRegistryParentFolder) || isAbsolute(within))
      throw new InstallFailedException(Resources.formatAcpAgentArchiveUnsafe(agent.name));
  }
}
