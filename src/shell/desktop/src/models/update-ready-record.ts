/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class UpdateReadyRecord {
  public readonly version: string;
  public readonly file: string;
  public readonly sha512: string;
  public readonly isNotified: boolean;

  public constructor(version: string, file: string, sha512: string, isNotified: boolean) {
    this.version = version;
    this.file = file;
    this.sha512 = sha512;
    this.isNotified = isNotified;
  }

  public static fromJson(value: unknown): UpdateReadyRecord {
    const reader = JsonReader.fromValue(value);
    return new UpdateReadyRecord(
      reader.readNonBlankString(Resources.updateVersionField),
      reader.readNonBlankString(Resources.updateFileField),
      reader.readNonBlankString(Resources.updateSha512Field),
      reader.readBoolean(Resources.updateNotifiedField));
  }

  public notified(): UpdateReadyRecord {
    return new UpdateReadyRecord(this.version, this.file, this.sha512, true);
  }

  public toJson(): JsonObject {
    return {
      [Resources.updateVersionField]: this.version,
      [Resources.updateFileField]: this.file,
      [Resources.updateSha512Field]: this.sha512,
      [Resources.updateNotifiedField]: this.isNotified
    };
  }
}
