/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import { ProvidersException } from "./providers.exception.js";

export class AcpRequestException extends ProvidersException {
  public override readonly name: string = "AcpRequestException";

  public readonly code: number | null;
  public readonly data: JsonValue | null;

  public constructor(message: string, code: number | null, data: JsonValue | null = null) {
    super(message);

    this.code = code;
    this.data = data;
  }
}
