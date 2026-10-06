/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class UpdateProcess {
  private static readonly FIELDS: readonly string[] = [Resources.processIdField, Resources.earliestField, Resources.latestField, Resources.roleField];

  public readonly processId: number;
  public readonly earliest: number;
  public readonly latest: number;
  public readonly role: string;

  public constructor(processId: number, earliest: number, latest: number, role: string) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdField);
    if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest > latest)
      throw new ArgumentOutOfRangeException(Resources.latestField, latest, Resources.processStartInvalid);
    ArgumentException.throwIfNullOrWhitespace(role, Resources.roleField);

    this.processId = processId;
    this.earliest = earliest;
    this.latest = latest;
    this.role = role;
  }

  public static fromJson(value: unknown, path?: string): UpdateProcess {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateProcess.FIELDS);
    return WireContract.create(reader, () => new UpdateProcess(
      reader.readInteger(Resources.processIdField),
      reader.readNumber(Resources.earliestField),
      reader.readNumber(Resources.latestField),
      reader.readString(Resources.roleField)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.processIdField]: this.processId,
      [Resources.earliestField]: this.earliest,
      [Resources.latestField]: this.latest,
      [Resources.roleField]: this.role
    };
  }
}
