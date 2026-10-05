/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class InstalledPackage {
  public readonly desktop: string;
  public readonly program: string;
  public readonly resources: string;

  public constructor(desktop: string, program: string, resources: string) {
    this.desktop = desktop;
    this.program = program;
    this.resources = resources;
  }
}
