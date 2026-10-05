/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";
import type ReleaseFile from "./release-file.ts";

export default class UpdateMetadata {
  private static readonly PREFIX: string = "latest";
  private static readonly EXTENSION: string = "yml";
  private static readonly RELEASE_DATE: RegExp = /^releaseDate: '([^'\n]+)'$/mu;

  private readonly version: string;
  private readonly update: ReleaseFile;
  private readonly others: readonly ReleaseFile[];
  private readonly releaseDate: string;

  public constructor(version: string, updateName: string, files: readonly ReleaseFile[], releaseDate: string) {
    const update = files.find(t => t.name === updateName);
    if (update === undefined)
      throw new ReleaseException(`The update metadata of ${version} needs its update file ${updateName} among its files.`);

    this.version = version;
    this.update = update;
    this.others = files.filter(t => t !== update);
    this.releaseDate = releaseDate;
  }

  public static formatFileName(target: PackageTarget): string {
    return `${UpdateMetadata.PREFIX}-${target.platform}-${target.architecture}.${UpdateMetadata.EXTENSION}`;
  }

  public static readReleaseDate(text: string, file: string): string {
    const match = UpdateMetadata.RELEASE_DATE.exec(text);
    if (match?.[1] === undefined)
      throw new ReleaseException(`${file} names no release date.`);
    return match[1];
  }

  private static quote(text: string): string {
    return `'${text.replaceAll("'", "''")}'`;
  }

  public format(): string {
    return [
      `version: ${this.version}`,
      "files:",
      ...[this.update, ...this.others].flatMap(t => [`  - url: ${UpdateMetadata.quote(t.name)}`, `    sha512: ${t.digest.sha512}`, `    size: ${t.digest.size}`]),
      `path: ${UpdateMetadata.quote(this.update.name)}`,
      `sha512: ${this.update.digest.sha512}`,
      `releaseDate: ${UpdateMetadata.quote(this.releaseDate)}`,
      ""
    ].join("\n");
  }
}
