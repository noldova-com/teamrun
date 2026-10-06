/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import { UpdateProcess, WireContract } from "@noldova/teamrun-shell-protocol";

import { UpdateBarrierState } from "../enums/update-barrier-state.js";
import { Resources } from "../resources.js";

export class UpdateBarrier {
  private static readonly FIELDS: readonly string[] = [Resources.holderField, Resources.versionField, Resources.stateField];
  private static readonly STATES: readonly UpdateBarrierState[] = Object.values(UpdateBarrierState);

  public readonly holder: UpdateProcess;
  public readonly version: string;
  public readonly state: UpdateBarrierState;

  public constructor(holder: UpdateProcess, version: string, state: UpdateBarrierState) {
    ArgumentException.throwIfNullOrWhitespace(version, Resources.versionField);

    this.holder = holder;
    this.version = version;
    this.state = state;
  }

  public static fromJson(value: unknown, path?: string): UpdateBarrier {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateBarrier.FIELDS);
    const holder = reader.readObject(Resources.holderField);
    return WireContract.create(reader, () => new UpdateBarrier(
      UpdateProcess.fromJson(holder.toJson(), holder.path),
      reader.readString(Resources.versionField),
      reader.readOneOf(Resources.stateField, UpdateBarrier.STATES)));
  }

  public toJson(): JsonObject {
    return { [Resources.holderField]: this.holder.toJson(), [Resources.versionField]: this.version, [Resources.stateField]: this.state };
  }
}
