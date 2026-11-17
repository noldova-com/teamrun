/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LocatedExecutable } from "./located-executable.js";

export class AcpInstallTools {
  public readonly tar: LocatedExecutable | null;
  public readonly unzip: LocatedExecutable | null;
  public readonly npm: LocatedExecutable | null;

  public constructor(tar: LocatedExecutable | null, unzip: LocatedExecutable | null, npm: LocatedExecutable | null) {
    this.tar = tar;
    this.unzip = unzip;
    this.npm = npm;
  }
}
