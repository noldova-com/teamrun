/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class DraftStaleException extends WindowException {
  public override readonly name: string = "DraftStaleException";

  public constructor() {
    super(Resources.draftStale);
  }
}
