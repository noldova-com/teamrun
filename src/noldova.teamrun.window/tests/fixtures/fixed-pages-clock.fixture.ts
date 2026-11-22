/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PagesClock } from "../../src/app/services/pages/pages-clock";

export class FixedPagesClock extends PagesClock {
  private readonly at: number;

  public constructor(at: number) {
    super();
    this.at = at;
  }

  public override now(): number {
    return this.at;
  }

  public override every(): () => void {
    return () => undefined;
  }
}
