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

import { FailureCode } from "../enums/failure-code.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class Failure {
  private static readonly CODES: readonly FailureCode[] = Object.values(FailureCode);

  public readonly code: FailureCode;
  public readonly message: string;
  public readonly details?: JsonObject;

  public constructor(code: FailureCode, message: string, details?: JsonObject) {
    ArgumentException.throwIfNullOrWhitespace(message, Resources.messageField);

    this.code = code;
    this.message = message;
    if (!Object.isUndefined(details))
      this.details = details;
  }

  public static fromJson(value: unknown, path?: string): Failure {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Failure(
      reader.readOneOf(Resources.codeField, Failure.CODES),
      reader.readString(Resources.messageField),
      reader.hasField(Resources.detailsField) ? reader.readObject(Resources.detailsField).toJson() : undefined));
  }

  public toJson(): JsonObject {
    const fields = { [Resources.codeField]: this.code, [Resources.messageField]: this.message };
    return Object.isUndefined(this.details) ? fields : { ...fields, [Resources.detailsField]: this.details };
  }
}
