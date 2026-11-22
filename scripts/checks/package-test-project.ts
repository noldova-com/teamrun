/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PackageTestProject {
  public readonly name: string;
  public readonly folder: string;

  public constructor(name: string, folder: string) {
    this.name = name;
    this.folder = folder;
  }
}
