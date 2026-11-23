/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import type { ILog } from "@noldova/teamrun.core";

import { ReleaseSourceException } from "../../exceptions/release-source.exception.js";
import { GitHubRelease } from "../../models/github-release.js";
import type { LocatedExecutable } from "../../models/located-executable.js";
import { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { InstallStaging } from "../installs/install-staging.js";
import { ReleaseDownload } from "../installs/release-download.js";
import type { CommandRunner } from "../process/command-runner.js";

export class CodexAppServerDownload {
  private readonly root: string;
  private readonly releaseAddress: string;
  private readonly target: string | null;
  private readonly platform: string;
  private readonly extractor: LocatedExecutable | null;
  private readonly runner: CommandRunner;
  private readonly unpackTimeout: number;
  private readonly log: ILog | null;
  private readonly remove: (path: string) => void;
  private readonly fetching: Map<string, Promise<string | null>> = new Map();
  private swept: boolean = false;

  public constructor(root: string, releaseAddress: string, target: string | null, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner,
    unpackTimeout: number, log: ILog | null = null, remove: (path: string) => void = CodexAppServerDownload.removeFolder) {
    this.root = root;
    this.releaseAddress = releaseAddress;
    this.target = target;
    this.platform = platform;
    this.extractor = extractor;
    this.runner = runner;
    this.unpackTimeout = unpackTimeout;
    this.log = log;
    this.remove = remove;
  }

  public programOf(version: string): string | null {
    if (Object.isNull(this.target))
      return null;
    const program = join(this.directoryOf(version, this.target), this.programPath);
    return existsSync(program) ? program : null;
  }

  public fetch(version: string, signal: AbortSignal): Promise<string | null> {
    const existing = this.fetching.get(version);
    if (!Object.isUndefined(existing))
      return existing;
    const fetching = this.download(version, signal).catch((error: unknown) => {
      this.log?.write(Resources.formatCodexAppServerNotDownloaded(version, FailureDescriber.describe(error)));
      return null;
    });
    this.fetching.set(version, fetching);
    return fetching;
  }

  private get programPath(): string {
    return this.platform === Resources.windowsPlatform ? `${Resources.codexAppServerProgram}${Resources.windowsExecutableExtension}` : Resources.codexAppServerProgram;
  }

  private directoryOf(version: string, target: string): string {
    return join(this.root, `${version}${Resources.platformArchitectureSeparator}${target}`);
  }

  private async download(version: string, signal: AbortSignal): Promise<string | null> {
    const ready = this.programOf(version);
    if (!Object.isNull(ready) || Object.isNull(this.target) || Object.isNull(this.extractor))
      return ready;
    const target = this.target;
    const extractor = this.extractor;
    if (!this.swept) {
      this.swept = true;
      InstallStaging.tidy(this.root);
    }
    const file = await this.readPackage(version, target, signal);
    const staging = InstallStaging.create(this.root);
    try {
      const archive = join(staging, Resources.codexArchiveName);
      await ReleaseDownload.save(file, archive, Resources.codexAppServerDisplayName, () => undefined, signal);
      const unpacked = join(staging, Resources.codexAppServerUnpackedName);
      mkdirSync(unpacked);
      const result = await this.runner.run(extractor.toCommand().withArguments(...Resources.tarExtractArguments, archive, Resources.tarDirectoryArgument, unpacked),
        {}, this.unpackTimeout, signal);
      if (!result.succeeded)
        throw new ReleaseSourceException(Resources.formatCodexAppServerUnpackFailed(result.timedOut ? null : result.exitCode));
      if (!existsSync(join(unpacked, this.programPath)))
        throw new ReleaseSourceException(Resources.formatCodexAppServerIncomplete(version));
      if (this.platform !== Resources.windowsPlatform)
        for (const member of Resources.codexAppServerExecutableMembers)
          if (existsSync(join(unpacked, member)))
            chmodSync(join(unpacked, member), Resources.executableMode);
      const directory = this.directoryOf(version, target);
      if (Object.isNull(this.programOf(version))) {
        this.remove(directory);
        renameSync(unpacked, directory);
      }
      this.removeOthers(directory);
      return this.programOf(version);
    }
    finally {
      InstallStaging.close(staging);
    }
  }

  private async readPackage(version: string, target: string, signal: AbortSignal): Promise<ReleaseFile> {
    const text = await ReleaseDownload.reachable(Resources.codexAppServerDisplayName, signal, async () => {
      const response = await fetch(`${this.releaseAddress}${Resources.codexTagPrefix}${version}`, { headers: { [Resources.acceptHeader]: Resources.jsonContentType }, signal });
      if (!response.ok)
        throw new ReleaseSourceException(Resources.formatCodexAppServerReleaseFailed(version, response.status));
      return response.text();
    });
    const asset = GitHubRelease.parse(text).assetNamed(`${Resources.codexAppServerPackagePrefix}${target}${Resources.codexPackageSuffix}`);
    const url = asset?.url ?? null;
    if (Object.isNull(asset) || !Resources.sha256Pattern.test(asset.sha256) || Object.isNull(url))
      throw new ReleaseSourceException(Resources.formatCodexAppServerPackageMissing(version));
    return new ReleaseFile(url, asset.sha256, asset.knownSize);
  }

  private static removeFolder(path: string): void {
    rmSync(path, { recursive: true, force: true, maxRetries: Resources.removeRetries });
  }

  private removeOthers(kept: string): void {
    for (const name of readdirSync(this.root).filter(t => !t.startsWith(Resources.stagingPrefix) && join(this.root, t) !== kept))
      try {
        this.remove(join(this.root, name));
      }
      catch (error) {
        this.log?.write(Resources.formatCodexAppServerNotRemoved(join(this.root, name), FailureDescriber.describe(error)));
      }
  }
}
