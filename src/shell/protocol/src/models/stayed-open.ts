/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { StayCause } from "../enums/stay-cause.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class StayedOpen {
  private static readonly FIELDS: readonly string[] = [Resources.causeField];
  private static readonly CAUSES: readonly StayCause[] = Object.values(StayCause);

  public readonly cause: StayCause;

  public constructor(cause: StayCause) {
    this.cause = cause;
  }

  public static fromJson(value: unknown, path?: string): StayedOpen {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, StayedOpen.FIELDS);
    return new StayedOpen(reader.readOneOf(Resources.causeField, StayedOpen.CAUSES));
  }

  public toJson(): JsonObject {
    return { [Resources.causeField]: this.cause };
  }
}
