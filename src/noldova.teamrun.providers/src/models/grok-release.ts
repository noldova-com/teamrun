/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";
import { ReleaseFile } from "./release-file.js";

export class GrokRelease {
  public readonly version: string;
  public readonly archive: ReleaseFile;
  public readonly programName: string;
  public readonly programBytes: number;

  public constructor(version: string, archive: ReleaseFile, programName: string, programBytes: number) {
    this.version = version;
    this.archive = archive;
    this.programName = programName;
    this.programBytes = programBytes;
  }

  public static find(platform: string, architecture: string): GrokRelease | null {
    const pin = Resources.grokReleases.find(t => t.target === `${platform}${Resources.platformArchitectureSeparator}${architecture}`);
    if (Object.isUndefined(pin))
      return null;
    return new GrokRelease(Resources.grokVersion, new ReleaseFile(`${Resources.grokDownloadBase}${pin.file}`, pin.sha256, pin.archiveBytes), pin.program,
      pin.programBytes);
  }
}
