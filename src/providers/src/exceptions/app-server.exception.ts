/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import type { JsonRpcError } from "../models/json-rpc-error.js";
import { Resources } from "../resources.js";

export class AppServerException extends Exception {
  public readonly method: string;
  public readonly error: JsonRpcError;

  public constructor(method: string, error: JsonRpcError) {
    super(Resources.formatAppServerError(method, error.message, error.code));

    this.method = method;
    this.error = error;
  }
}
