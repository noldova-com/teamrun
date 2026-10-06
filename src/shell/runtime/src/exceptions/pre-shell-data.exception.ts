/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class PreShellDataException extends Exception {
  public override readonly name: string = "PreShellDataException";
  public readonly root: string;
  public readonly entries: readonly string[];

  public constructor(root: string, entries: readonly string[]) {
    super(Resources.formatPreShellData(root, entries));

    this.root = root;
    this.entries = [...entries];
  }
}
