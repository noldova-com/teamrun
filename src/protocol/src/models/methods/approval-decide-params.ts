/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ApprovalDecideParams {
  public readonly approvalId: string;
  public readonly optionId: string;

  public constructor(approvalId: string, optionId: string) {
    ArgumentException.throwIfNullOrWhitespace(approvalId, Resources.approvalIdField);
    ArgumentException.throwIfNullOrWhitespace(optionId, Resources.optionIdField);

    this.approvalId = approvalId;
    this.optionId = optionId;
  }

  public static fromJson(value: unknown, path?: string): ApprovalDecideParams {
    const reader = JsonReader.fromValue(value, path);
    return new ApprovalDecideParams(reader.readNonBlankString(Resources.approvalIdField), reader.readNonBlankString(Resources.optionIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.approvalIdField]: this.approvalId,
      [Resources.optionIdField]: this.optionId
    };
  }
}
