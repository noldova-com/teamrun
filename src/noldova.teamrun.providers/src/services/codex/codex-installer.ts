/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { ReleaseSourceException } from "../../exceptions/release-source.exception.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ProcessCommand } from "../../models/process-command.js";
import { GitHubRelease } from "../../models/github-release.js";
import { ReleaseFile } from "../../models/release-file.js";
import { ToolRelease } from "../../models/tool-release.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { InstallRename } from "../installs/install-rename.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class CodexInstaller implements IProviderKindInstallation {
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly channels: readonly string[];
  private readonly home: string;
  private readonly binDirectory: string;
  private readonly target: string | null;
  private readonly platform: string;
  private readonly extractor: LocatedExecutable | null;
  private readonly runner: CommandRunner;
  private readonly program: (path: string) => ProcessCommand;
  private readonly symlink: (target: string, path: string) => void;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;
  private readonly unpackTimeout: number;
  private readonly channelTimeout: number;

  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channels: readonly string[],
    home: string, binDirectory: string, target: string | null, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner,
    program: (path: string) => ProcessCommand, symlink: (target: string, path: string) => void, rename: (from: string, to: string) => void,
    settle: (from: string, to: string) => Promise<void>, unpackTimeout: number, channelTimeout: number) {
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.channels = channels;
    this.home = home;
    this.binDirectory = binDirectory;
    this.target = target;
    this.platform = platform;
    this.extractor = extractor;
    this.runner = runner;
    this.program = program;
    this.symlink = symlink;
    this.rename = rename;
    this.settle = settle;
    this.unpackTimeout = unpackTimeout;
    this.channelTimeout = channelTimeout;
  }

  public get unavailable(): string | null {
    if (Object.isNull(this.target))
      return Resources.codexNoBuild;
    return Object.isNull(this.extractor) ? Resources.codexNoTar : null;
  }

  public get missingTool(): string | null {
    return !Object.isNull(this.target) && Object.isNull(this.extractor) ? Resources.tarCommandName : null;
  }

  public get isInstalled(): boolean {
    return !Object.isNull(this.locate());
  }

  public get foundPath(): string | null {
    const located = this.locate();
    return Object.isNull(located) || this.isStandalone ? null : located.path;
  }

  private get isStandalone(): boolean {
    return existsSync(join(this.home, ...Resources.codexStandaloneSegments, Resources.codexCurrentName));
  }

  private get isWindows(): boolean {
    return this.platform === Resources.windowsPlatform;
  }

  public async readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    const located = this.locate();
    const standalone = !Object.isNull(located) && this.isStandalone;
    const [installed, latest] = await Promise.all([
      Object.isNull(located) ? null : this.versionReader.read(located.toCommand(), this.environment),
      !checksLatest || Object.isNull(this.target) || !standalone ? null
        : this.readRelease(this.target, AbortSignal.timeout(this.channelTimeout)).then(t => t.version, () => null)
    ]);
    return new ProviderKindVersions(installed, latest);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void = () => undefined): Promise<string> {
    const target = this.target;
    const extractor = this.extractor;
    if (Object.isNull(target))
      throw new InstallFailedException(Resources.codexNoBuild);
    if (Object.isNull(extractor))
      throw new InstallFailedException(Resources.codexNoTar);
    const root = join(this.home, ...Resources.codexStandaloneSegments);
    const releases = join(root, Resources.codexReleasesDirectoryName);
    InstallStaging.sweepKeeping(releases, Resources.codexPreviousReleaseName);
    const staging = InstallStaging.writing(Resources.formatCodexFolderNotWritable(root), () => InstallStaging.create(releases));
    const aside = join(staging, Resources.codexPreviousReleaseName);
    let replaced: string | null = null;
    let committed = false;
    try {
      const release = await this.readRelease(target, signal);
      const name = `${release.version}${Resources.platformArchitectureSeparator}${target}`;
      const directory = join(releases, name);
      let unpacked: string | null = null;
      if (!await this.isComplete(directory, release.version)) {
        const archive = join(staging, Resources.codexArchiveName);
        await ReleaseDownload.save(release.archive, archive, Resources.codexDisplayName, progress, signal);
        signal.throwIfAborted();
        unpacked = join(staging, name);
        mkdirSync(unpacked);
        const result = await this.runner.run(extractor.toCommand().withArguments(...Resources.tarExtractArguments, archive, Resources.tarDirectoryArgument, unpacked),
          {}, this.unpackTimeout, signal);
        if (!result.succeeded)
          throw new InstallFailedException(Resources.formatCodexUnpackFailed(result.timedOut ? null : result.exitCode));
        if (!this.isWindows) {
          for (const member of Resources.codexExecutableMembers)
            if (existsSync(join(unpacked, member)))
              chmodSync(join(unpacked, member), Resources.executableMode);
          this.symlink(Resources.codexPackageProgram, join(unpacked, Resources.codexExecutableName));
        }
      }
      signal.throwIfAborted();
      committed = true;
      commit();
      if (!Object.isNull(unpacked)) {
        if (existsSync(directory)) {
          replaced = directory;
          await this.replace(unpacked, directory, aside, release.version);
        }
        else
          this.rename(unpacked, directory);
      }
      if (!await this.isComplete(directory, release.version))
        throw new InstallFailedException(Resources.formatCodexIncomplete(release.version));
      const current = join(root, Resources.codexCurrentName);
      if (this.isWindows)
        CodexInstaller.junction(current, directory);
      else
        this.link(current, directory, join(root, `${Resources.codexCurrentTemporaryPrefix}${process.pid}`));
      const marker = join(root, `${Resources.codexAutoUpdateName}${Resources.codexTemporaryInfix}${process.pid}`);
      writeFileSync(marker, name);
      renameSync(marker, join(root, Resources.codexAutoUpdateName));
      InstallStaging.writing(Resources.formatCodexCommandNotWritable(release.version, root, this.binDirectory), () => this.show(current));
      const installed = this.locate();
      if (Object.isNull(installed))
        throw new InstallFailedException(Resources.formatCodexNotFoundAfterInstall(this.binDirectory));
      const now = await this.versionReader.read(installed.toCommand(), this.environment);
      if (now !== release.version)
        throw new InstallFailedException(Resources.formatCodexShadowed(release.version, this.binDirectory, installed.path, now));
      InstallStaging.tidy(releases);
      return installed.path;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.codexDisplayName), error);
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

  public static targetOf(platform: string, architecture: string): string | null {
    return Resources.codexTargetTriples.get(`${platform}${Resources.platformArchitectureSeparator}${architecture}`) ?? null;
  }

  private async isComplete(directory: string, version: string): Promise<boolean> {
    const members = this.isWindows ? Resources.codexWindowsMembers
      : this.platform === Resources.linuxPlatform ? [...Resources.codexPosixMembers, ...Resources.codexLinuxMembers] : Resources.codexPosixMembers;
    if (!members.every(t => existsSync(join(directory, t))))
      return false;
    const program = join(directory, this.isWindows ? Resources.codexWindowsPackageProgram : Resources.codexPackageProgram);
    return await this.versionReader.read(this.program(program), this.environment) === version;
  }

  private async replace(unpacked: string, directory: string, aside: string, version: string): Promise<void> {
    try {
      this.rename(directory, aside);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatCodexReleaseKept(version, directory, InstallRename.codeOf(error)), error);
    }
    try {
      this.rename(unpacked, directory);
    }
    catch (error) {
      try {
        await this.settle(aside, directory);
      }
      catch (back) {
        throw new InstallFailedException(Resources.formatCodexReleaseSetAside(version, directory, aside, InstallRename.codeOf(error), InstallRename.codeOf(back)), back);
      }
      throw new InstallFailedException(Resources.formatCodexReleaseNotReplaced(version, directory, InstallRename.codeOf(error)), error);
    }
  }

  private show(current: string): void {
    if (this.isWindows) {
      CodexInstaller.junction(this.binDirectory, join(current, Resources.binDirectoryName));
      return;
    }
    const temporary = join(this.binDirectory, `${Resources.codexVisibleTemporaryPrefix}${process.pid}`);
    mkdirSync(this.binDirectory, { recursive: true });
    this.link(join(this.binDirectory, Resources.codexExecutableName), join(current, Resources.codexPackageProgram), temporary);
    if (this.platform === Resources.macPlatform)
      this.link(join(this.binDirectory, Resources.codexCodeModeHostName), join(current, Resources.codexCodeModeHostProgram), temporary);
  }

  private link(path: string, target: string, temporary: string): void {
    rmSync(temporary, { force: true });
    this.symlink(target, temporary);
    renameSync(temporary, path);
  }

  private static junction(path: string, target: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const existing = lstatSync(path, { throwIfNoEntry: false });
    if (existing?.isSymbolicLink() === true)
      unlinkSync(path);
    else if (existing?.isDirectory() === true && readdirSync(path).length === 0)
      rmSync(path, { recursive: true });
    else if (!Object.isUndefined(existing))
      throw new InstallFailedException(Resources.formatCodexNotReplaced(path));
    symlinkSync(target, path, Resources.junctionLinkType);
  }

  private async readRelease(target: string, signal: AbortSignal): Promise<ToolRelease> {
    let failure: unknown = null;
    for (const channel of this.channels) {
      try {
        return CodexInstaller.releaseOf(await this.read(channel, signal), target);
      }
      catch (error) {
        signal.throwIfAborted();
        failure ??= error;
      }
    }
    throw failure;
  }

  private read(url: string, signal: AbortSignal): Promise<string> {
    return ReleaseDownload.reachable(Resources.codexDisplayName, signal, async () => {
      const response = await fetch(url, { headers: { [Resources.acceptHeader]: Resources.jsonContentType }, signal });
      if (!response.ok)
        throw new ReleaseSourceException(Resources.formatReleaseChannelFailed(Resources.codexDisplayName, response.status));
      return response.text();
    });
  }

  private static releaseOf(text: string, target: string): ToolRelease {
    const release = GitHubRelease.parse(text);
    const version = release.versionAfter(Resources.codexTagPrefix);
    if (!Resources.releaseVersionPattern.test(version))
      throw new ReleaseSourceException(Resources.formatReleaseChannelUnreadable(Resources.codexDisplayName));
    const name = `${Resources.codexPackagePrefix}${target}${Resources.codexPackageSuffix}`;
    const asset = release.assetNamed(name);
    const url = asset?.url ?? null;
    if (Object.isNull(asset) || !Resources.sha256Pattern.test(asset.sha256) || Object.isNull(url))
      throw new InstallFailedException(Resources.formatCodexPackageMissing(version));
    return new ToolRelease(version, name, new ReleaseFile(url, asset.sha256, asset.knownSize));
  }
}
