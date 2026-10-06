/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class CliCommandException extends Exception {
  public override readonly name: string = "CliCommandException";
  public readonly code: string;
  public readonly details: JsonObject | null;

  public constructor(code: string, message: string, details: JsonObject | null = null) {
    super(message);
    ArgumentException.throwIfNullOrWhitespace(code, Resources.codeParameterName);
    this.code = code;
    this.details = details;
  }
}
