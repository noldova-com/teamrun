/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { QuitResult } from "../enums/quit-result.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class QuitReport {
  private static readonly FIELDS: readonly string[] = [Resources.outcomeField];
  private static readonly RESULTS: readonly QuitResult[] = Object.values(QuitResult);

  public readonly outcome: QuitResult;

  public constructor(outcome: QuitResult) {
    this.outcome = outcome;
  }

  public static fromJson(value: unknown, path?: string): QuitReport {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, QuitReport.FIELDS);
    return new QuitReport(reader.readOneOf(Resources.outcomeField, QuitReport.RESULTS));
  }

  public toJson(): JsonObject {
    return { [Resources.outcomeField]: this.outcome };
  }
}
