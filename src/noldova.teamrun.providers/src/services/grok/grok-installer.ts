/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, createReadStream, createWriteStream, lstatSync, mkdirSync, rmSync } from "node:fs";
import { join, posix } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { InstallHeldException } from "../../exceptions/install-held.exception.js";
import type { GrokRelease } from "../../models/grok-release.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { InstallRename } from "../installs/install-rename.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";

export class GrokInstaller implements IProviderKindInstallation {
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly release: GrokRelease | null;
  private readonly home: string;
  private readonly platform: string;
  private readonly program: (path: string) => ProcessCommand;
  private readonly symlink: (target: string, path: string) => void;
  private readonly rename: (from: string, to: string) => void;
  private readonly settle: (from: string, to: string) => Promise<void>;

  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, release: GrokRelease | null,
    home: string, platform: string, program: (path: string) => ProcessCommand, symlink: (target: string, path: string) => void, rename: (from: string, to: string) => void,
    settle: (from: string, to: string) => Promise<void>) {
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.release = release;
    this.home = home;
    this.platform = platform;
    this.program = program;
    this.symlink = symlink;
    this.rename = rename;
    this.settle = settle;
  }

  public get unavailable(): string | null {
    return Object.isNull(this.release) ? Resources.grokNoBuild : null;
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

  private get isWindows(): boolean {
    return this.platform === Resources.windowsPlatform;
  }

  public async readVersions(): Promise<ProviderKindVersions> {
    const located = this.locate();
    const installed = Object.isNull(located) ? null : await this.versionReader.read(located.toCommand(), this.environment);
    return new ProviderKindVersions(installed, Object.isNull(this.release) || located?.source !== ExecutableSource.LocalBin ? null : this.release.version);
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void = () => undefined): Promise<string> {
    const unavailable = this.unavailable;
    if (!Object.isNull(unavailable))
      throw new InstallFailedException(unavailable);
    const release = this.release!;
    const downloads = join(this.home, Resources.grokDownloadsDirectoryName);
    const bin = join(this.home, Resources.binDirectoryName);
    InstallStaging.sweep(downloads);
    const staging = InstallStaging.writing(Resources.formatGrokFolderNotWritable(this.home), () => InstallStaging.create(downloads));
    let committed = false;
    try {
      const archive = join(staging, Resources.grokArchiveName);
      await ReleaseDownload.save(release.archive, archive, Resources.grokDisplayName, progress, signal);
      const unpacked = join(staging, release.programName);
      await GrokInstaller.unpack(archive, unpacked, release, signal);
      if (!this.isWindows)
        chmodSync(unpacked, Resources.executableMode);
      if (await this.versionReader.read(this.program(unpacked), this.environment) !== release.version)
        throw new InstallFailedException(Resources.formatGrokIncomplete(release.version));
      signal.throwIfAborted();
      committed = true;
      commit();
      const program = join(downloads, release.programName);
      const ready = join(staging, Resources.installReadyName);
      await this.ready(unpacked, ready, program);
      const commands: { readonly settled: string; readonly path: string }[] = [];
      for (const name of this.isWindows ? Resources.grokWindowsProgramNames : Resources.grokProgramNames) {
        const staged = join(staging, name);
        if (this.isWindows)
          copyFileSync(ready, staged);
        else
          this.symlink(posix.join(Resources.parentSegment, Resources.grokDownloadsDirectoryName, release.programName), staged);
        const settled = `${staged}${Resources.installReadySuffix}`;
        await this.ready(staged, settled, join(bin, name));
        commands.push({ settled, path: join(bin, name) });
      }
      const replaced: { readonly path: string; readonly aside: string | null }[] = [];
      try {
        this.replace(ready, program, replaced);
        InstallStaging.writing(Resources.formatGrokFolderNotWritable(this.home), () => mkdirSync(bin, { recursive: true }));
        for (const { settled, path } of commands)
          this.replace(settled, path, replaced);
      }
      catch (error) {
        this.restore(replaced, error);
      }
      for (const { aside } of replaced)
        if (!Object.isNull(aside))
          GrokInstaller.removed(aside);
      const installed = this.locate();
      if (Object.isNull(installed))
        throw new InstallFailedException(Resources.formatGrokNotFoundAfterInstall(bin));
      const now = await this.versionReader.read(installed.toCommand(), this.environment);
      if (now !== release.version)
        throw new InstallFailedException(Resources.formatGrokShadowed(release.version, bin, installed.path, now));
      return installed.path;
    }
    catch (error) {
      if (signal.aborted && !committed)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.grokDisplayName), error);
      throw error;
    }
    finally {
      InstallStaging.close(staging);
    }
  }

  public static programOf(path: string): ProcessCommand {
    return new ProcessCommand(path, []);
  }

  private static async unpack(archive: string, path: string, release: GrokRelease, signal: AbortSignal): Promise<void> {
    let written = 0;
    try {
      await pipeline(createReadStream(archive), createGunzip(), async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          written += chunk.byteLength;
          if (written > release.programBytes)
            throw new InstallFailedException(Resources.formatGrokIncomplete(release.version));
          yield chunk;
        }
      }, createWriteStream(path, { flags: "wx" }), { signal });
    }
    catch (error) {
      signal.throwIfAborted();
      throw new InstallFailedException(Resources.formatGrokIncomplete(release.version), error);
    }
    if (written !== release.programBytes)
      throw new InstallFailedException(Resources.formatGrokIncomplete(release.version));
  }

  private async ready(next: string, ready: string, path: string): Promise<void> {
    try {
      await this.settle(next, ready);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatGrokNotReady(path, InstallRename.codeOf(error), error instanceof InstallHeldException), error);
    }
  }

  private replace(next: string, path: string, replaced: { readonly path: string; readonly aside: string | null }[]): void {
    const aside = Object.isNull(lstatSync(path, { throwIfNoEntry: false }) ?? null) ? null : GrokInstaller.asideOf(path);
    if (!Object.isNull(aside))
      try {
        this.rename(path, aside);
      }
      catch (error) {
        throw new InstallFailedException(Resources.formatGrokKept(path, String((error as NodeJS.ErrnoException).code)), error);
      }
    replaced.push({ path, aside });
    try {
      this.rename(next, path);
    }
    catch (error) {
      throw new InstallFailedException(Resources.formatGrokNotReplaced(path, String((error as NodeJS.ErrnoException).code)), error);
    }
  }

  private restore(replaced: readonly { readonly path: string; readonly aside: string | null }[], error: unknown): never {
    const failures: unknown[] = [];
    for (const { path, aside } of [...replaced].reverse())
      try {
        if (Object.isNull(aside))
          rmSync(path, { force: true });
        else
          this.rename(aside, path);
      }
      catch (failure) {
        failures.push(failure);
      }
    if (failures.length === 0)
      throw error;
    throw new InstallFailedException(Resources.formatGrokNotRestored(this.home), new AggregateError([error, ...failures]));
  }

  private static asideOf(path: string): string {
    const aside = `${path}${Resources.grokAsideSuffix}`;
    return GrokInstaller.removed(aside) ? aside : `${aside}${Resources.grokAsideSeparator}${randomUUID()}`;
  }

  private static removed(path: string): boolean {
    try {
      rmSync(path, { force: true });
      return true;
    }
    catch {
      return false;
    }
  }
}
