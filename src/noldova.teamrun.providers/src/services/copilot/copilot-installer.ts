/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { InstallHeldException } from "../../exceptions/install-held.exception.js";
import { ReleaseSourceException } from "../../exceptions/release-source.exception.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ProcessCommand } from "../../models/process-command.js";
import { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { InstallRename } from "../installs/install-rename.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class CopilotInstaller implements IProviderKindInstallation {
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly channel: string;
  private readonly directory: string;
  private readonly target: string | null;
  private readonly platform: string;
  private readonly extractor: LocatedExecutable | null;
  private readonly runner: CommandRunner;
  private readonly program: (path: string) => ProcessCommand;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;
  private readonly unpackTimeout: number;
  private readonly channelTimeout: number;

  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channel: string,
    directory: string, target: string | null, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner,
    program: (path: string) => ProcessCommand, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>, unpackTimeout: number,
    channelTimeout: number) {
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.channel = channel;
    this.directory = directory;
    this.target = target;
    this.platform = platform;
    this.extractor = extractor;
    this.runner = runner;
    this.program = program;
    this.rename = rename;
    this.settle = settle;
    this.unpackTimeout = unpackTimeout;
    this.channelTimeout = channelTimeout;
  }

  public get unavailable(): string | null {
    if (Object.isNull(this.target))
      return Resources.copilotNoBuild;
    return Object.isNull(this.extractor) ? Resources.copilotNoExtractor : null;
  }

  public get missingTool(): string | null {
    return !Object.isNull(this.target) && Object.isNull(this.extractor) ? Resources.tarCommandName : null;
  }

  public get isInstalled(): boolean {
    return !Object.isNull(this.locate());
  }

  public get foundPath(): string | null {
    const located = this.locate();
    return Object.isNull(located) || this.isOwn(located) ? null : located.path;
  }

  private get isWindows(): boolean {
    return this.platform === Resources.windowsPlatform;
  }

  private get executableName(): string {
    return this.isWindows ? Resources.copilotWindowsExecutableName : Resources.copilotExecutableName;
  }

  public async readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    const located = this.locate();
    const [installed, latest] = await Promise.all([
      Object.isNull(located) ? null : this.versionReader.read(located.toCommand(), this.environment),
      !checksLatest || Object.isNull(this.target) || Object.isNull(located) || !this.isOwn(located) ? null
        : this.readRelease(this.target, AbortSignal.timeout(this.channelTimeout)).then(t => t.version, () => null)
    ]);
    return new ProviderKindVersions(installed, latest);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void = () => undefined): Promise<string> {
    const unavailable = this.unavailable;
    if (!Object.isNull(unavailable))
      throw new InstallFailedException(unavailable);
    InstallStaging.sweepKeeping(this.directory, Resources.copilotPreviousName);
    const staging = InstallStaging.writing(Resources.formatCopilotFolderNotWritable(this.directory), () => InstallStaging.create(this.directory));
    const aside = join(staging, Resources.copilotPreviousName);
    let replaced: string | null = null;
    let committed = false;
    try {
      const release = await this.readRelease(this.target!, signal);
      const archive = join(staging, release.name);
      await ReleaseDownload.save(release.archive, archive, Resources.copilotDisplayName, progress, signal);
      signal.throwIfAborted();
      const unpacked = join(staging, Resources.copilotUnpackedName);
      mkdirSync(unpacked);
      const result = await this.runner.run(this.extractor!.toCommand().withArguments(...Resources.tarExtractArguments, archive, Resources.tarDirectoryArgument, unpacked),
        {}, this.unpackTimeout, signal);
      if (!result.succeeded)
        throw new InstallFailedException(Resources.formatCopilotUnpackFailed(result.timedOut ? null : result.exitCode));
      const program = join(unpacked, this.executableName);
      if (!this.isWindows && existsSync(program))
        chmodSync(program, Resources.executableMode);
      if (!existsSync(program) || await this.versionReader.read(this.program(program), this.environment) !== release.version)
        throw new InstallFailedException(Resources.formatCopilotIncomplete(release.version));
      signal.throwIfAborted();
      committed = true;
      commit();
      if (this.isWindows) {
        const folder = join(this.directory, release.version);
        const ready = join(staging, Resources.installReadyName);
        try {
          await this.settle(unpacked, ready);
        }
        catch (error) {
          throw new InstallFailedException(Resources.formatCopilotNotReady(release.version, folder, InstallRename.codeOf(error), error instanceof InstallHeldException), error);
        }
        if (existsSync(folder)) {
          replaced = folder;
          await this.replace(ready, folder, aside, release.version);
        }
        else
          this.rename(ready, folder);
      }
      else
        this.rename(program, join(this.directory, this.executableName));
      const installed = this.locate();
      if (Object.isNull(installed))
        throw new InstallFailedException(Resources.formatCopilotNotFoundAfterInstall(this.directory));
      const now = await this.versionReader.read(installed.toCommand(), this.environment);
      if (now !== release.version)
        throw new InstallFailedException(Resources.formatCopilotShadowed(release.version, this.directory, installed.path, now));
      InstallStaging.tidy(this.directory);
      return installed.path;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.copilotDisplayName), error);
      throw error;
    }
    finally {
      if (Object.isNull(replaced) || !existsSync(aside) || existsSync(replaced))
        InstallStaging.close(staging);
    }
  }

  public static programOf(path: string): ProcessCommand {
    return new ProcessCommand(path, []);
  }

  public static targetOf(platform: string, architecture: string, isMusl: boolean): string | null {
    const target = `${platform}${Resources.platformArchitectureSeparator}${architecture}`;
    if (!Resources.copilotTargets.includes(target))
      return null;
    return isMusl && platform === Resources.linuxPlatform ? `${Resources.copilotMuslPlatform}${Resources.platformArchitectureSeparator}${architecture}` : target;
  }

  private async replace(unpacked: string, folder: string, aside: string, version: string): Promise<void> {
    try {
      this.rename(folder, aside);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatCopilotReleaseKept(version, folder, InstallRename.codeOf(error)), error);
    }
    try {
      this.rename(unpacked, folder);
    }
    catch (error) {
      try {
        await this.settle(aside, folder);
      }
      catch (back) {
        throw new InstallFailedException(Resources.formatCopilotReleaseSetAside(version, folder, aside, InstallRename.codeOf(error), InstallRename.codeOf(back)), back);
      }
      throw new InstallFailedException(Resources.formatCopilotReleaseNotReplaced(version, folder, InstallRename.codeOf(error)), error);
    }
  }

  private isOwn(located: LocatedExecutable): boolean {
    return located.source === (this.isWindows ? ExecutableSource.Managed : ExecutableSource.LocalBin);
  }

  private async readRelease(target: string, signal: AbortSignal): Promise<{ readonly version: string; readonly name: string; readonly archive: ReleaseFile }> {
    const text = await ReleaseDownload.reachable(Resources.copilotDisplayName, signal, async () => {
      const response = await fetch(this.channel, { headers: { [Resources.acceptHeader]: Resources.jsonContentType }, signal });
      if (!response.ok)
        throw new ReleaseSourceException(Resources.formatReleaseChannelFailed(Resources.copilotDisplayName, response.status));
      return response.text();
    });
    let release: { tag_name?: unknown; assets?: unknown } | null = null;
    try {
      release = JSON.parse(text) as { tag_name?: unknown; assets?: unknown } | null;
    }
    catch {
      release = null;
    }
    const tag = release?.tag_name;
    const version = typeof tag === "string" && tag.startsWith(Resources.copilotTagPrefix) ? tag.slice(Resources.copilotTagPrefix.length) : String.empty;
    if (!Resources.releaseVersionPattern.test(version))
      throw new ReleaseSourceException(Resources.formatReleaseChannelUnreadable(Resources.copilotDisplayName));
    const name = `${Resources.copilotArchivePrefix}${target}${this.isWindows ? Resources.copilotWindowsArchiveSuffix : Resources.copilotPosixArchiveSuffix}`;
    const assets = Array.isArray(release!.assets) ? release!.assets as ({ name?: unknown; digest?: unknown; size?: unknown; browser_download_url?: unknown } | null)[] : [];
    const asset = assets.find(t => t?.name === name);
    const digest = typeof asset?.digest === "string" && asset.digest.startsWith(Resources.sha256DigestPrefix) ? asset.digest.slice(Resources.sha256DigestPrefix.length) : String.empty;
    if (!Resources.sha256Pattern.test(digest) || typeof asset?.browser_download_url !== "string")
      throw new InstallFailedException(Resources.formatCopilotArchiveMissing(version));
    const size = asset.size;
    return { version, name, archive: new ReleaseFile(asset.browser_download_url, digest, typeof size === "number" && Number.isSafeInteger(size) && size > 0 ? size : null) };
  }
}
