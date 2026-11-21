/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessTree } from "@noldova/teamrun.providers";

export class SettledProcessTree implements IProcessTree {
  public endTree(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public endOwnTree(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public endDescendants(): Promise<void> {
    return Promise.resolve();
  }

  public endLeftovers(): Promise<void> {
    return Promise.resolve();
  }
}
