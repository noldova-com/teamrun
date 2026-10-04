/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModuleStatus } from "@noldova/teamrun-shell-protocol";

export class ModuleReference {
  public readonly id: string;
  public readonly module: ModuleStatus | null;

  public constructor(id: string, module: ModuleStatus | null) {
    this.id = id;
    this.module = module;
  }
}
