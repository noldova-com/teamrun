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
  private static readonly MACOS_PLATFORM: string = "macos";
  private static readonly MACOS_UPDATE_EXTENSION: string = "zip";
  private static readonly CHECKSUM_EXTENSION: string = "sha256";
  private static readonly CHECKSUM_SEPARATOR: string = "  ";

  private readonly productName: string;

  public constructor(productName: string) {
    this.productName = productName;
  }

  private static checksumOf(packageName: string): string {
    return `${packageName}.${ReleaseFileSet.CHECKSUM_EXTENSION}`;
  }

  private static formatChecksum(file: ReleaseFile): string {
    return `${file.digest.sha256}${ReleaseFileSet.CHECKSUM_SEPARATOR}${file.name}\n`;
  }

  private static async readFilesAsync(folder: string, names: readonly string[]): Promise<readonly ReleaseFile[]> {
    const files: ReleaseFile[] = [];
    for (const name of names) {
      const file = path.join(folder, name);
      if (!existsSync(file))
        throw new ReleaseException(`${file} is missing; npm run package makes it.`);
      files.push(new ReleaseFile(name, await PackageDigest.readAsync(file)));
    }
    return files;
  }

  public listAll(): readonly string[] {
    return PackageTarget.listAll().flatMap(t => this.listTarget(t));
  }

  public async writeAsync(folder: string, target: PackageTarget, version: string, releaseDate: string): Promise<readonly string[]> {
    const files = await ReleaseFileSet.readFilesAsync(folder, this.listPackages(target));
    for (const file of files)
      await writeFile(path.join(folder, ReleaseFileSet.checksumOf(file.name)), ReleaseFileSet.formatChecksum(file));
    await writeFile(path.join(folder, UpdateMetadata.fileNameOf(target)), new UpdateMetadata(version, files, releaseDate).format());
    return this.listTarget(target);
  }

  public async verifyAsync(folder: string, version: string): Promise<void> {
    const expected = this.listAll();
    const present = await readdir(folder);
    const missing = expected.filter(t => !present.includes(t));
    const unexpected = present.filter(t => !expected.includes(t));
    if (missing.length > 0 || unexpected.length > 0)
      throw new ReleaseException(`The release's files in ${folder} differ from the files a release has. Missing: ${missing.join(", ") || "none"}. Not part of a release: ${unexpected.join(", ") || "none"}.`);

    for (const target of PackageTarget.listAll()) {
      const files = await ReleaseFileSet.readFilesAsync(folder, this.listPackages(target));
      for (const file of files) {
        const checksum = ReleaseFileSet.checksumOf(file.name);
        if (await readFile(path.join(folder, checksum), "utf8") !== ReleaseFileSet.formatChecksum(file))
          throw new ReleaseException(`${checksum} does not match ${file.name}.`);
      }
      const metadata = UpdateMetadata.fileNameOf(target);
      const text = await readFile(path.join(folder, metadata), "utf8");
      if (text !== new UpdateMetadata(version, files, UpdateMetadata.readReleaseDate(text, metadata)).format())
        throw new ReleaseException(`${metadata} does not describe version ${version} with ${files.map(t => t.name).join(" and ")} as they are.`);
    }
  }

  private listTarget(target: PackageTarget): readonly string[] {
    const packages = this.listPackages(target);
    return [...packages, ...packages.map(t => ReleaseFileSet.checksumOf(t)), UpdateMetadata.fileNameOf(target)];
  }

  private listPackages(target: PackageTarget): readonly string[] {
    const isUpdate = (extension: string): boolean => target.platform !== ReleaseFileSet.MACOS_PLATFORM || extension === ReleaseFileSet.MACOS_UPDATE_EXTENSION;
    return [...target.extensions.filter(t => isUpdate(t)), ...target.extensions.filter(t => !isUpdate(t))].map(t => target.formatFileName(this.productName, t));
  }
}
