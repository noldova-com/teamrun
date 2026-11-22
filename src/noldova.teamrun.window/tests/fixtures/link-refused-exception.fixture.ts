/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "@noldova/desktop.window";

export class LinkRefusedException extends WindowException {
  public override readonly name: string = "LinkRefusedException";

  public constructor(message: string) {
    super(message);
  }
}
