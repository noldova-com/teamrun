/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ErrorCode } from "@noldova/teamrun.protocol";

import { AcpRequestException } from "../exceptions/acp-request.exception.js";
import { Resources } from "../resources.js";

export class FailureDescriber {
  public static describe(error: unknown): string {
    if (!(error instanceof Error))
      return String(error);
    const data = error instanceof AcpRequestException ? error.data : null;
    const detail = FailureDescriber.isJsonObject(data) ? data[Resources.messageField] : null;
    return Object.isString(detail) && !String.isNullOrWhitespace(detail) && !error.message.includes(detail) ? `${error.message}: ${detail}` : error.message;
  }

  public static isClosedRun(error: unknown): boolean {
    return error instanceof Error && (error as Error & { readonly info?: { readonly name?: unknown } }).info?.name === ErrorCode.Conflict;
  }

  private static isJsonObject(value: JsonValue | null): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
