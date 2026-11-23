/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReleaseFile } from "./release-file.js";

export class ToolRelease {
  public readonly version: string;
  public readonly name: string;
  public readonly archive: ReleaseFile;

  public constructor(version: string, name: string, archive: ReleaseFile) {
    this.version = version;
    this.name = name;
    this.archive = archive;
  }
}
