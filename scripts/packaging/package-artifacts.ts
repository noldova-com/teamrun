/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";
import type PackageOptions from "./package-options.ts";

export default class PackageArtifacts {
  private static readonly WINDOWS_PLATFORM: string = "windows";
  private static readonly WINDOWS_ARTIFACT_SUFFIXES: readonly string[] = [".exe"];
  private static readonly MAC_PLATFORM: string = "mac";
  private static readonly MAC_ARTIFACT_SUFFIXES: readonly string[] = [".dmg", ".zip"];
  private static readonly LINUX_ARTIFACT_SUFFIXES: readonly string[] = [".AppImage"];
  private static readonly BLOCKMAP_EXTENSION: string = ".blockmap";
  private static readonly UPDATE_METADATA_EXTENSION: string = ".yml";
  private static readonly BUILDER_OUTPUT_PREFIX: string = "builder-";
  private static readonly ARTIFACT_PRODUCT_PREFIX: string = "TeamRun-";
  private static readonly ARTIFACT_HASH_ALGORITHM: string = "sha256";
  private static readonly HASH_ENCODING: "hex" = "hex";
  private static readonly JSON_INDENTATION: number = 2;
  private static readonly NEWLINE: string = "\n";

  private readonly options: PackageOptions;
  private readonly version: string;
  private readonly directory: string;

  public constructor(options: PackageOptions, version: string, directory: string = options.outputDirectory) {
    this.options = options;
    this.version = version;
    this.directory = directory;
  }

  public async writeReport(sourceRevision: string | null = null): Promise<void> {
    const prefix = PackageArtifacts.ARTIFACT_PRODUCT_PREFIX + this.options.targetName;
    const suffixes = this.options.platform === PackageArtifacts.WINDOWS_PLATFORM ? PackageArtifacts.WINDOWS_ARTIFACT_SUFFIXES :
      this.options.platform === PackageArtifacts.MAC_PLATFORM ? PackageArtifacts.MAC_ARTIFACT_SUFFIXES : PackageArtifacts.LINUX_ARTIFACT_SUFFIXES;
    const required = suffixes.map(t => prefix + t);
    const names = new Set(required);
    for (const name of await readdir(this.directory)) {
      if (required.some(t => name === t + PackageArtifacts.BLOCKMAP_EXTENSION) ||
          (name.endsWith(PackageArtifacts.UPDATE_METADATA_EXTENSION) && !name.startsWith(PackageArtifacts.BUILDER_OUTPUT_PREFIX)))
        names.add(name);
      else if (name.startsWith(PackageArtifacts.ARTIFACT_PRODUCT_PREFIX) && !names.has(name))
        throw new PackageException(PackageArtifacts.formatUnexpectedArtifact(name));
    }

    const files = [];
    for (const name of [...names].sort()) {
      const filename = path.join(this.directory, name);
      const info = await lstat(filename);
      if (!info.isFile() || info.size === 0)
        throw new PackageException(PackageArtifacts.formatInvalidArtifact(name));
      const hash = createHash(PackageArtifacts.ARTIFACT_HASH_ALGORITHM);
      for await (const chunk of createReadStream(filename))
        hash.update(chunk);
      files.push({ name, size: info.size, sha256: hash.digest(PackageArtifacts.HASH_ENCODING) });
    }

    const report = {
      version: this.version,
      targetPlatform: this.options.platform,
      targetArchitecture: this.options.architecture,
      signingRequested: this.options.signed,
      sourceRevision,
      nodeVersion: process.version,
      hostPlatform: process.platform,
      hostArchitecture: process.arch,
      files
    };
    await writeFile(
      path.join(this.directory, PackageArtifacts.formatPackageReportFilename(this.options.targetName)),
      JSON.stringify(report, null, PackageArtifacts.JSON_INDENTATION) + PackageArtifacts.NEWLINE);
  }

  private static formatUnexpectedArtifact(filename: string): string {
    return `Unexpected installer artifact: ${filename}. Check the target and configured formats.`;
  }

  private static formatInvalidArtifact(filename: string): string {
    return `Package artifact must be a non-empty regular file: ${filename}.`;
  }

  private static formatPackageReportFilename(target: string): string {
    return `package-report-${target}.json`;
  }
}
