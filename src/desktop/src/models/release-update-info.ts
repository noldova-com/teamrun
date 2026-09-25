/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class ReleaseUpdateInfo {
  public readonly version: string;
  public readonly url: string;
  public readonly sha512: string;
  public readonly size: number;
  public readonly releaseDate: string;

  private constructor(version: string, url: string, sha512: string, size: number, releaseDate: string) {
    this.version = version;
    this.url = url;
    this.sha512 = sha512;
    this.size = size;
    this.releaseDate = releaseDate;
  }

  public static parse(text: string): ReleaseUpdateInfo {
    const reader = JsonReader.parse(text);
    const files = reader.readObjectArray(Resources.updateFilesField);
    const file = files[0];
    if (files.length !== 1 || Object.isUndefined(file))
      throw new Error(Resources.updateInfoInvalid);
    const size = file.readInteger(Resources.updateSizeField);
    if (size <= 0)
      throw new Error(Resources.updateInfoInvalid);
    return new ReleaseUpdateInfo(reader.readNonBlankString(Resources.updateVersionField), file.readNonBlankString(Resources.updateUrlField),
      file.readNonBlankString(Resources.updateSha512Field), size, reader.readNonBlankString(Resources.updateReleaseDateField));
  }
}
