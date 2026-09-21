/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class UpdateCheckpointResult {
  public readonly id: string;
  public readonly ready: boolean;

  public constructor(id: string, ready: boolean) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
    this.ready = ready;
  }

  public static fromJson(value: unknown): UpdateCheckpointResult {
    const reader = JsonReader.fromValue(value);
    return new UpdateCheckpointResult(reader.readNonBlankString(Resources.idField), reader.readBoolean(Resources.checkpointReadyField));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.checkpointReadyField]: this.ready };
  }
}
