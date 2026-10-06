/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

export class LinkNotOpenedException extends Exception {
  public override readonly name: string = "LinkNotOpenedException";

  public constructor(message: string) {
    super(message);
  }
}
