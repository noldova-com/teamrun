/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { ReleaseSourceException } from "../../exceptions/release-source.exception.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ProcessCommand } from "../../models/process-command.js";
import { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class ClaudeInstaller implements IProviderKindInstallation {
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly channel: string;
  private readonly stagingDirectory: string;
  private readonly target: string | null;
  private readonly runner: CommandRunner;
  private readonly program: (path: string) => ProcessCommand;
  private readonly channelTimeout: number;

  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channel: string,
    stagingDirectory: string, target: string | null, runner: CommandRunner, program: (path: string) => ProcessCommand, channelTimeout: number) {
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.channel = channel;
    this.stagingDirectory = stagingDirectory;
    this.target = target;
    this.runner = runner;
    this.program = program;
    this.channelTimeout = channelTimeout;
  }

  public get unavailable(): string | null {
    return Object.isNull(this.target) ? Resources.claudeNoBuild : null;
  }

  public get missingTool(): string | null {
    return null;
  }

  public get isInstalled(): boolean {
    return !Object.isNull(this.locate());
  }

  public get foundPath(): string | null {
    const located = this.locate();
    return Object.isNull(located) || located.source === ExecutableSource.LocalBin ? null : located.path;
  }

  public async readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    const located = this.locate();
    const [installed, latest] = await Promise.all([
      Object.isNull(located) ? null : this.versionReader.read(located.toCommand(), this.environment),
      !checksLatest || Object.isNull(this.target) || located?.source !== ExecutableSource.LocalBin ? null
        : this.readLatest(AbortSignal.timeout(this.channelTimeout)).catch(() => null)
    ]);
    return new ProviderKindVersions(installed, latest);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void = () => undefined): Promise<string> {
    const target = this.target;
    if (Object.isNull(target))
      throw new InstallFailedException(Resources.claudeNoBuild);
    const staging = InstallStaging.open(this.stagingDirectory);
    let committed = false;
    try {
      const version = await this.readLatest(signal);
      const build = await this.readBuild(version, target, signal);
      const program = join(staging, this.programName(target));
      await ReleaseDownload.save(build, program, Resources.claudeDisplayName, progress, signal);
      if (!target.startsWith(Resources.windowsPlatform))
        chmodSync(program, Resources.executableMode);
      signal.throwIfAborted();
      committed = true;
      commit();
      const result = await this.runner.run(this.program(program).withArguments(Resources.claudeSetupArgument, version, Resources.claudeForceArgument), this.environment,
        null, null);
      if (!result.succeeded)
        throw new InstallFailedException(Resources.formatClaudeSetupFailed(version, result.exitCode));
      const installed = this.locate();
      if (Object.isNull(installed))
        throw new InstallFailedException(Resources.claudeNotFoundAfterSetup);
      let now = await this.versionReader.read(installed.toCommand(), this.environment);
      if (now !== version) {
        await this.runner.run(installed.toCommand().withArguments(Resources.claudeSetupArgument, version, Resources.claudeForceArgument), this.environment, null, null);
        now = await this.versionReader.read(installed.toCommand(), this.environment);
      }
      if (now !== version)
        throw new InstallFailedException(Resources.formatClaudeSetupKept(version, now));
      return installed.path;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.claudeDisplayName), error);
      throw error;
    }
    finally {
      InstallStaging.close(staging);
    }
  }

  public static programOf(path: string): ProcessCommand {
    return new ProcessCommand(path, []);
  }

  public static targetOf(platform: string, architecture: string, isMusl: boolean): string | null {
    const target = `${platform}${Resources.platformArchitectureSeparator}${architecture}`;
    if (!Resources.claudeTargets.includes(target))
      return null;
    return platform === Resources.linuxPlatform && isMusl ? `${target}${Resources.claudeMuslSuffix}` : target;
  }

  private programName(target: string): string {
    return target.startsWith(Resources.windowsPlatform) ? Resources.claudeWindowsProgramName : Resources.claudeProgramName;
  }

  private async readLatest(signal: AbortSignal): Promise<string> {
    const version = (await this.read(`${this.channel}/${Resources.claudeLatestName}`, signal)).trim();
    if (!Resources.releaseVersionPattern.test(version))
      throw new ReleaseSourceException(Resources.formatReleaseChannelUnreadable(Resources.claudeDisplayName));
    return version;
  }

  private async readBuild(version: string, target: string, signal: AbortSignal): Promise<ReleaseFile> {
    const text = await this.read(`${this.channel}/${version}/${Resources.claudeManifestName}`, signal);
    const build = ClaudeInstaller.buildOf(text, target);
    const checksum = build?.[Resources.claudeChecksumField];
    const size = build?.[Resources.claudeSizeField];
    if (!Object.isString(checksum) || !Resources.sha256Pattern.test(checksum) || !Object.isNumber(size) || !Number.isSafeInteger(size) || size <= 0)
      throw new InstallFailedException(Resources.formatClaudeBuildMissing(version));
    return new ReleaseFile(`${this.channel}/${version}/${target}/${this.programName(target)}`, checksum, size);
  }

  private static buildOf(text: string, target: string): JsonObject | null {
    try {
      return JsonReader.parse(text).readObject(Resources.claudePlatformsField).readObject(target).toJson();
    }
    catch {
      return null;
    }
  }

  private read(url: string, signal: AbortSignal): Promise<string> {
    return ReleaseDownload.reachable(Resources.claudeDisplayName, signal, async () => {
      const response = await fetch(url, { signal });
      if (!response.ok)
        throw new ReleaseSourceException(Resources.formatReleaseChannelFailed(Resources.claudeDisplayName, response.status));
      return response.text();
    });
  }
}
