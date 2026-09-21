/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { UpdateCheckpointPhase } from "../enums/update-checkpoint-phase.js";
import { Resources } from "../resources.js";

export class UpdateCheckpoint {
  public readonly id: string;
  public readonly phase: UpdateCheckpointPhase;

  public constructor(id: string, phase: UpdateCheckpointPhase) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
    this.phase = phase;
  }

  public static fromJson(value: unknown): UpdateCheckpoint {
    const reader = JsonReader.fromValue(value);
    return new UpdateCheckpoint(reader.readNonBlankString(Resources.idField),
      reader.readOneOf(Resources.checkpointPhaseField, Object.values(UpdateCheckpointPhase)));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.checkpointPhaseField]: this.phase };
  }
}
