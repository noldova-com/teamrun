/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { IModuleLog } from "../../interfaces/module-log.js";
import { Resources } from "../../resources.js";
import type { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";

export class ModuleLog implements IModuleLog {
  private readonly moduleId: string;
  private readonly output: Writable;
  private readonly redactor: DiagnosticRedactor;

  public constructor(moduleId: string, output: Writable, redactor: DiagnosticRedactor) {
    this.moduleId = moduleId;
    this.output = output;
    this.redactor = redactor;
  }

  public write(message: string): void {
    const lines = this.redactor.redact(message).trimEnd().split(Resources.lineBreakPattern);
    this.output.write(lines.map(t => Resources.formatModuleLogLine(this.moduleId, t)).join(""));
  }
}
