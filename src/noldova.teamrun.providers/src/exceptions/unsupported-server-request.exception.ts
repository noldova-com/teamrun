/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ProvidersException } from "./providers.exception.js";

export class UnsupportedServerRequestException extends ProvidersException {
  public override readonly name: string = "UnsupportedServerRequestException";

  public readonly method: string;

  public constructor(method: string) {
    super(Resources.formatUnsupportedServerRequest(method));

    this.method = method;
  }
}
