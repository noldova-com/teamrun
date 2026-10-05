/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

export class RuntimeRequestException extends Exception {
  public readonly code: string;
  public readonly details?: JsonObject;

  public constructor(code: string, message: string, details?: JsonObject) {
    super(message);
    this.code = code;
    if (!Object.isUndefined(details))
      this.details = details;
  }
}
