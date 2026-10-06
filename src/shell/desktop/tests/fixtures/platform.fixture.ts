/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Skip } from "@noldova/teamrun-foundation-testing";

export class PlatformFixture {
  public static windowsOnly(): (value: Function) => void {
    return process.platform === "win32" ? () => undefined : Skip("Windows only");
  }

  public static posixOnly(): (value: Function) => void {
    return process.platform === "win32" ? Skip("POSIX only") : () => undefined;
  }
}
