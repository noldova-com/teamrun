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

  public static linuxOnly(): (value: Function) => void {
    return process.platform === "linux" ? () => undefined : Skip("Linux only");
  }

  public static macOnly(): (value: Function) => void {
    return process.platform === "darwin" ? () => undefined : Skip("macOS only");
  }

  public static posixOnly(): (value: Function) => void {
    return process.platform === "win32" ? Skip("POSIX only") : () => undefined;
  }
}
