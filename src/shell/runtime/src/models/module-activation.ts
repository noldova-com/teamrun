/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart } from "../interfaces/runtime-part.js";
import type { ModuleDatabase } from "../services/database/module-database.js";
import type { ModuleContext } from "../services/modules/module-context.js";

export class ModuleActivation {
  public readonly context: ModuleContext;
  public readonly part: IRuntimePart;
  public readonly database?: ModuleDatabase;

  public constructor(context: ModuleContext, part: IRuntimePart, database?: ModuleDatabase) {
    this.context = context;
    this.part = part;
    if (!Object.isUndefined(database))
      this.database = database;
  }
}
