/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { InstallCancelledException } from "../../exceptions/install-cancelled.exception.js";
import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import type { AntigravityRelease } from "../../models/antigravity-release.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import { ZipDirectory } from "../archives/zip-directory.js";
import { ArchiveUnpacker } from "../installs/archive-unpacker.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class AntigravityInstaller implements IProviderKindInstallation {
  private readonly release: AntigravityRelease | null;
  private readonly installDirectory: string;
  private readonly extractor: LocatedExecutable | null;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly codesign: ProcessCommand;
  private readonly runner: CommandRunner;
  private readonly unpackTimeout: number;
  private readonly signTimeout: number;

  public constructor(release: AntigravityRelease | null, installDirectory: string, extractor: LocatedExecutable | null, platform: string, architecture: string,
    codesign: ProcessCommand, runner: CommandRunner, unpackTimeout: number, signTimeout: number) {
    this.release = release;
    this.installDirectory = installDirectory;
    this.extractor = extractor;
    this.platform = platform;
    this.architecture = architecture;
    this.codesign = codesign;
    this.runner = runner;
    this.unpackTimeout = unpackTimeout;
    this.signTimeout = signTimeout;
  }

  public get unavailable(): string | null {
    if (Object.isNull(this.release))
      return Resources.antigravityNoRelease;
    return Object.isNull(this.extractor) ? Resources.antigravityNoUnzip : null;
  }

  public get missingTool(): string | null {
    return !Object.isNull(this.release) && Object.isNull(this.extractor) ? Resources.unzipExecutableName : null;
  }

  public get isInstalled(): boolean {
    if (Object.isNull(this.release))
      return false;
    const target = join(this.installDirectory, this.release.version);
    return existsSync(join(target, this.release.executableName)) && existsSync(join(target, this.release.harnessName));
  }

  public readVersions(): Promise<ProviderKindVersions> {
    const version = this.release?.version ?? null;
    return Promise.resolve(new ProviderKindVersions(this.isInstalled ? version : null, version));
  }

  public async install(progress: (received: number, total: number) => void, signal: AbortSignal): Promise<string> {
    const unavailable = this.unavailable;
    if (!Object.isNull(unavailable))
      throw new InstallFailedException(unavailable);
    const release = this.release!;
    const target = join(this.installDirectory, release.version);
    const server = join(target, release.executableName);
    if (existsSync(server) && existsSync(join(target, release.harnessName)))
      return server;
    if (existsSync(target))
      throw new InstallFailedException(Resources.formatAntigravityIncomplete(target));
    const staging = InstallStaging.open(this.installDirectory);
    try {
      const archive = join(staging, Resources.antigravityArchiveName);
      await ReleaseDownload.save(new ReleaseFile(release.url, release.sha256, release.archiveBytes), archive, Resources.antigravityDisplayName, progress, signal);
      signal.throwIfAborted();
      if (!ZipDirectory.isSafe(archive))
        throw new InstallFailedException(Resources.antigravityArchiveUnsafe);
      const unpacked = join(staging, release.version);
      mkdirSync(unpacked);
      const result = await this.runner.run(ArchiveUnpacker.command(this.extractor!, archive, unpacked), {}, this.unpackTimeout, signal);
      if (!result.succeeded)
        throw new InstallFailedException(Resources.formatAntigravityUnpackFailed(result.timedOut ? null : result.exitCode));
      for (const [name, bytes] of [[release.executableName, release.executableBytes], [release.harnessName, release.harnessBytes]] as const) {
        const member = join(unpacked, name);
        if (!existsSync(member) || statSync(member).size !== bytes)
          throw new InstallFailedException(Resources.antigravityMemberMismatch);
        if (this.platform !== Resources.windowsPlatform)
          chmodSync(member, Resources.executableMode);
      }
      if (this.platform === Resources.macPlatform && this.architecture === Resources.x64Architecture) {
        signal.throwIfAborted();
        await this.reSign(staging, join(unpacked, release.executableName), signal);
      }
      signal.throwIfAborted();
      renameSync(unpacked, target);
      return server;
    }
    catch (error) {
      if (signal.aborted)
        throw new InstallCancelledException(Resources.formatInstallCancelled(Resources.antigravityDisplayName), error);
      throw error;
    }
    finally {
      InstallStaging.close(staging);
    }
  }

  private async reSign(staging: string, server: string, signal: AbortSignal): Promise<void> {
    const entitlements = join(staging, Resources.antigravityEntitlementsName);
    writeFileSync(entitlements, Resources.antigravityEntitlements);
    const result = await this.runner.run(this.codesign.withArguments(...Resources.codesignArguments, entitlements, server), {}, this.signTimeout, signal)
      .catch(() => null);
    if (Object.isNull(result) || !result.succeeded)
      throw new InstallFailedException(Resources.formatAntigravitySignFailed(Object.isNull(result) || result.timedOut ? null : result.exitCode));
  }
}
