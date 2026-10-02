/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataDirectoryState } from "../enums/data-directory-state.js";

export class DataDirectoryInspection {
  public readonly state: DataDirectoryState;
  public readonly entries: readonly string[];

  public constructor(state: DataDirectoryState, entries: readonly string[]) {
    this.state = state;
    this.entries = [...entries];
  }
}
