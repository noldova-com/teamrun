/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PackageInfo {
  public readonly name: string;
  public readonly packageName: string;
  public readonly directory: string;
  public readonly gated: boolean;

  public constructor(name: string, packageName: string, directory: string, gated: boolean = true) {
    this.name = name;
    this.packageName = packageName;
    this.directory = directory;
    this.gated = gated;
  }

  public formatTarballFileName(version: string): string {
    return `${this.packageName.replace("@", "").replace("/", "-")}-${version}.tgz`;
  }
}
