/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";

import { Resources } from "../../resources.js";

export class TokenGenerator {
  public generate(): string {
    return randomBytes(Resources.tokenByteLength).toString(Resources.hexEncoding);
  }
}
