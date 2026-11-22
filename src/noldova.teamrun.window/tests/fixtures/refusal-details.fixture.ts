/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { ErrorCode } from "@noldova/teamrun.protocol";

export class RefusalDetails {
  public readonly error: ErrorCode;
  public readonly arguments: readonly string[];

  public constructor(error: ErrorCode, values: readonly string[]) {
    this.error = error;
    this.arguments = values;
  }

  public toJson(): JsonObject {
    return { error: this.error, arguments: [...this.arguments] };
  }
}
