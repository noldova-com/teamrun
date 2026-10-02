/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { ModuleState } from "../enums/module-state.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class ModuleStatus {
  private static readonly STATES: readonly ModuleState[] = Object.values(ModuleState);

  public readonly id: string;
  public readonly state: ModuleState;
  public readonly cause: string | null;

  public constructor(id: string, state: ModuleState, cause: string | null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if ((state === ModuleState.Active) !== Object.isNull(cause) || (!Object.isNull(cause) && String.isNullOrWhitespace(cause)))
      throw new ArgumentException(Resources.moduleCauseInvalid, Resources.causeField);

    this.id = id;
    this.state = state;
    this.cause = cause;
  }

  public static fromJson(value: unknown, path?: string): ModuleStatus {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new ModuleStatus(
      reader.readString(Resources.idField),
      reader.readOneOf(Resources.stateField, ModuleStatus.STATES),
      reader.hasField(Resources.causeField) ? reader.readString(Resources.causeField) : null));
  }

  public toJson(): JsonObject {
    const fields = { [Resources.idField]: this.id, [Resources.stateField]: this.state };
    return Object.isNull(this.cause) ? fields : { ...fields, [Resources.causeField]: this.cause };
  }
}
