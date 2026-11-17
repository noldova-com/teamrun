/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import type { CursorRelease } from "../../models/cursor-release.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ProcessCommand } from "../../models/process-command.js";
import { InstallHeldException } from "../../exceptions/install-held.exception.js";
import { Resources } from "../../resources.js";
import { ZipDirectory } from "../archives/zip-directory.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { InstallRename } from "../installs/install-rename.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class CursorInstaller implements IProviderKindInstallation {
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly release: CursorRelease | null;
  private readonly directory: string;
  private readonly platform: string;
  private readonly extractor: LocatedExecutable | null;
  private readonly runner: CommandRunner;
  private readonly program: (path: string) => ProcessCommand;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;
  private readonly unpackTimeout: number;

  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, release: CursorRelease | null,
    directory: string, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner, program: (path: string) => ProcessCommand,
    rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>, unpackTimeout: number) {
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.release = release;
    this.directory = directory;
    this.platform = platform;
    this.extractor = extractor;
    this.runner = runner;
    this.program = program;
    this.rename = rename;
    this.settle = settle;
    this.unpackTimeout = unpackTimeout;
  }

  public get unavailable(): string | null {
    if (Object.isNull(this.release))
      return Resources.cursorNoBuild;
    return Object.isNull(this.extractor) ? Resources.cursorNoExtractor : null;
  }

  public get missingTool(): string | null {
    return !Object.isNull(this.release) && Object.isNull(this.extractor) ? Resources.tarCommandName : null;
  }

  public get isInstalled(): boolean {
    return !Object.isNull(this.locate());
  }

  public get foundPath(): string | null {
    const located = this.locate();
    return Object.isNull(located) || located.source === ExecutableSource.Managed ? null : located.path;
  }

  public async readVersions(): Promise<ProviderKindVersions> {
    const located = this.locate();
    const installed = Object.isNull(located) ? null : await this.versionReader.read(located.toCommand(), this.environment);
    return new ProviderKindVersions(installed, Object.isNull(this.release) || located?.source !== ExecutableSource.Managed ? null : this.release.version);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void = () => undefined): Promise<string> {
    const release = this.release;
    const extractor = this.extractor;
    if (Object.isNull(release))
      throw new InstallFailedException(Resources.cursorNoBuild);
    if (Object.isNull(extractor))
      throw new InstallFailedException(Resources.cursorNoExtractor);
    InstallStaging.sweepKeeping(this.directory, Resources.cursorPreviousName);
    const staging = InstallStaging.writing(Resources.formatCursorFolderNotWritable(this.directory), () => InstallStaging.create(this.directory));
    const folder = join(this.directory, release.version);
    const aside = join(staging, Resources.cursorPreviousName);
    let committed = false;
    try {
      const archive = join(staging, release.archiveName);
      await ReleaseDownload.save(release.archive, archive, Resources.cursorDisplayName, progress, signal);
      signal.throwIfAborted();
      if (release.isZip && !ZipDirectory.isSafe(archive))
        throw new InstallFailedException(Resources.cursorArchiveUnsafe);
      const unpacked = join(staging, Resources.cursorUnpackedName);
      mkdirSync(unpacked);
      const result = await this.runner.run(extractor.toCommand().withArguments(...Resources.tarExtractArguments, archive, Resources.tarDirectoryArgument, unpacked),
        {}, this.unpackTimeout, signal);
      if (!result.succeeded)
        throw new InstallFailedException(Resources.formatCursorUnpackFailed(result.timedOut ? null : result.exitCode));
      const launcher = join(unpacked, release.launcherName);
      const node = join(unpacked, release.nodeName);
      const members: readonly (readonly [string, number])[] = [[node, release.nodeBytes], [join(unpacked, release.scriptName), release.scriptBytes]];
      if (!existsSync(launcher) || members.some(([path, bytes]) => !existsSync(path) || statSync(path).size !== bytes))
        throw new InstallFailedException(Resources.formatCursorIncomplete(release.version));
      if (this.platform !== Resources.windowsPlatform)
        for (const path of [launcher, node])
          chmodSync(path, Resources.executableMode);
      if (await this.versionReader.read(this.program(launcher), this.environment) !== release.version)
        throw new InstallFailedException(Resources.formatCursorIncomplete(release.version));
      signal.throwIfAborted();
      committed = true;
      commit();
      const ready = join(staging, Resources.installReadyName);
      try {
        await this.settle(unpacked, ready);
      }
      catch (error) {
        throw new InstallFailedException(Resources.formatCursorNotReady(release.version, folder, InstallRename.codeOf(error), error instanceof InstallHeldException), error);
      }
      if (existsSync(folder))
        await this.replace(ready, folder, aside, release.version);
      else
        this.place(ready, folder, release.version);
      const installed = this.locate();
      if (Object.isNull(installed))
        throw new InstallFailedException(Resources.formatCursorNotFoundAfterInstall(this.directory));
      const now = await this.versionReader.read(installed.toCommand(), this.environment);
      if (now !== release.version)
        throw new InstallFailedException(Resources.formatCursorShadowed(release.version, this.directory, installed.path, now));
      this.sweepOthers(release.version, basename(staging));
      return installed.path;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.cursorDisplayName), error);
      throw error;
    }
    finally {
      if (!existsSync(aside) || existsSync(folder))
        InstallStaging.close(staging);
    }
  }

  public static programOf(path: string): ProcessCommand {
    return extname(path).toLowerCase() === Resources.cursorWindowsScriptExtension
      ? new ProcessCommand(join(dirname(path), Resources.cursorWindowsNodeName), [join(dirname(path), Resources.cursorScriptName)]) : new ProcessCommand(path, []);
  }

  private place(ready: string, folder: string, version: string): void {
    try {
      this.rename(ready, folder);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatCursorNotPlaced(version, folder, InstallRename.codeOf(error)), error);
    }
  }

  private sweepOthers(version: string, staging: string): void {
    for (const name of readdirSync(this.directory).filter(t => t !== version && t !== staging)) {
      try {
        rmSync(join(this.directory, name), { recursive: true, force: true, maxRetries: Resources.removeRetries });
      }
      catch {
        continue;
      }
    }
  }

  private async replace(unpacked: string, folder: string, aside: string, version: string): Promise<void> {
    try {
      this.rename(folder, aside);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatCursorReleaseKept(version, folder, InstallRename.codeOf(error)), error);
    }
    try {
      this.rename(unpacked, folder);
    }
    catch (error) {
      try {
        await this.settle(aside, folder);
      }
      catch (back) {
        throw new InstallFailedException(Resources.formatCursorReleaseSetAside(version, folder, aside, InstallRename.codeOf(error), InstallRename.codeOf(back)), back);
      }
      throw new InstallFailedException(Resources.formatCursorReleaseNotReplaced(version, folder, InstallRename.codeOf(error)), error);
    }
  }
}
