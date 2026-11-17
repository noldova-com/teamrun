/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { CoreException } from "./core.exception.js";

export class GuidFormatException extends CoreException {
  public override readonly name: string = "GuidFormatException";

  public constructor() {
    super(Resources.guidTextInvalid);
  }
}
