/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class UnsupportedServerRequestException extends Exception {
  public readonly method: string;

  public constructor(method: string) {
    super(Resources.formatUnsupportedServerRequest(method));

    this.method = method;
  }
}
