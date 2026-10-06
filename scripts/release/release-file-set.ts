/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import PackageTarget from "../packaging/package-target.ts";
import PackageDigest from "./package-digest.ts";
import ReleaseException from "./release.exception.ts";
import ReleaseFile from "./release-file.ts";
import UpdateMetadata from "./update-metadata.ts";

export default class ReleaseFileSet {
  private static readonly CHECKSUM_EXTENSION: string = "sha256";
  private static readonly CHECKSUM_SEPARATOR: string = "  ";

  private readonly productName: string;

  public constructor(productName: string) {
    this.productName = productName;
  }

  private static formatChecksumName(packageName: string): string {
    return `${packageName}.${ReleaseFileSet.CHECKSUM_EXTENSION}`;
  }

  private static formatChecksum(file: ReleaseFile): string {
    return `${file.digest.sha256}${ReleaseFileSet.CHECKSUM_SEPARATOR}${file.name}\n`;
  }

  private static async readAsync(folder: string, name: string): Promise<ReleaseFile> {
    const file = path.join(folder, name);
    if (!existsSync(file))
      throw new ReleaseException(`${file} is missing; npm run package makes it.`);
    return new ReleaseFile(name, await PackageDigest.readAsync(file));
  }

  public listAll(): readonly string[] {
    return PackageTarget.listAll().flatMap(t => this.listTarget(t));
  }

  public async writeAsync(folder: string, target: PackageTarget, version: string, releaseDate: string): Promise<readonly string[]> {
    const packages = await this.readPackagesAsync(folder, target);
    for (const file of packages)
      await writeFile(path.join(folder, ReleaseFileSet.formatChecksumName(file.name)), ReleaseFileSet.formatChecksum(file));
    await writeFile(path.join(folder, UpdateMetadata.formatFileName(target)), this.describe(target, version, packages, releaseDate).format());
    return this.listTarget(target);
  }

  public async verifyAsync(folder: string, version: string): Promise<readonly ReleaseFile[]> {
    if (!existsSync(folder))
      throw new ReleaseException(`The release's folder ${folder} does not exist.`);
    const expected = this.listAll();
    const present = await readdir(folder);
    const missing = expected.filter(t => !present.includes(t));
    const unexpected = present.filter(t => !expected.includes(t));
    if (missing.length > 0 || unexpected.length > 0)
      throw new ReleaseException(`The release's files in ${folder} differ from the files a release has. Missing: ${missing.join(", ") || "none"}. Not part of a release: ${unexpected.join(", ") || "none"}.`);

    const files: ReleaseFile[] = [];
    for (const target of PackageTarget.listAll()) {
      const packages = await this.readPackagesAsync(folder, target);
      const checksums: ReleaseFile[] = [];
      for (const file of packages) {
        const checksum = ReleaseFileSet.formatChecksumName(file.name);
        const bytes = await readFile(path.join(folder, checksum));
        if (bytes.toString("utf8") !== ReleaseFileSet.formatChecksum(file))
          throw new ReleaseException(`${checksum} does not match ${file.name}.`);
        checksums.push(new ReleaseFile(checksum, PackageDigest.of(bytes)));
      }
      const metadata = UpdateMetadata.formatFileName(target);
      const bytes = await readFile(path.join(folder, metadata));
      const text = bytes.toString("utf8");
      if (text !== this.describe(target, version, packages, UpdateMetadata.readReleaseDate(text, metadata)).format())
        throw new ReleaseException(`${metadata} does not describe version ${version} with ${packages.map(t => t.name).join(" and ")} as they are.`);
      files.push(...packages, ...checksums, new ReleaseFile(metadata, PackageDigest.of(bytes)));
    }
    return files;
  }

  private listTarget(target: PackageTarget): readonly string[] {
    const packages = target.listFileNames(this.productName);
    return [...packages, ...packages.map(t => ReleaseFileSet.formatChecksumName(t)), UpdateMetadata.formatFileName(target)];
  }

  private async readPackagesAsync(folder: string, target: PackageTarget): Promise<readonly ReleaseFile[]> {
    const files: ReleaseFile[] = [];
    for (const name of target.listFileNames(this.productName))
      files.push(await ReleaseFileSet.readAsync(folder, name));
    return files;
  }

  private describe(target: PackageTarget, version: string, packages: readonly ReleaseFile[], releaseDate: string): UpdateMetadata {
    return new UpdateMetadata(version, target.formatFileName(this.productName, target.updateExtension), packages, releaseDate);
  }
}
