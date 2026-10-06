/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart } from "../interfaces/i-runtime-part.js";
import type { ModuleDatabase } from "../services/database/module-database.js";
import type { ModuleContext } from "../services/modules/module-context.js";
import type { ProcessSupervisor } from "../services/process/process-supervisor.js";
import type { ModuleDeclaration } from "./module-declaration.js";

export class ModuleActivation {
  public readonly declaration: ModuleDeclaration;
  public readonly context: ModuleContext;
  public readonly part: IRuntimePart;
  public readonly processes: ProcessSupervisor;
  public readonly database?: ModuleDatabase;

  public constructor(declaration: ModuleDeclaration, context: ModuleContext, part: IRuntimePart, processes: ProcessSupervisor, database?: ModuleDatabase) {
    this.declaration = declaration;
    this.context = context;
    this.part = part;
    this.processes = processes;
    if (!Object.isUndefined(database))
      this.database = database;
  }
}
