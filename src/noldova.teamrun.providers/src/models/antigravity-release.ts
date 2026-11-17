/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";

export class AntigravityRelease {
  public readonly version: string;
  public readonly url: string;
  public readonly sha256: string;
  public readonly archiveBytes: number;
  public readonly executableName: string;
  public readonly executableBytes: number;
  public readonly harnessName: string;
  public readonly harnessBytes: number;

  public constructor(version: string, url: string, sha256: string, archiveBytes: number, executableName: string, executableBytes: number, harnessName: string,
    harnessBytes: number) {
    this.version = version;
    this.url = url;
    this.sha256 = sha256;
    this.archiveBytes = archiveBytes;
    this.executableName = executableName;
    this.executableBytes = executableBytes;
    this.harnessName = harnessName;
    this.harnessBytes = harnessBytes;
  }

  public static find(platform: string, architecture: string): AntigravityRelease | null {
    const pin = Resources.antigravityReleases.find(t => t.target === `${platform}${Resources.platformArchitectureSeparator}${architecture}`);
    if (Object.isUndefined(pin))
      return null;
    const isWindows = platform === Resources.windowsPlatform;
    return new AntigravityRelease(Resources.antigravityVersion, `${Resources.antigravityDownloadBase}${pin.file}`, pin.sha256, pin.archiveBytes,
      isWindows ? Resources.antigravityWindowsExecutableName : Resources.antigravityExecutableName, pin.executableBytes,
      isWindows ? Resources.antigravityWindowsHarnessName : Resources.antigravityHarnessName, pin.harnessBytes);
  }
}
