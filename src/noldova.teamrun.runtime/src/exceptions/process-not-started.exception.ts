/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class ProcessNotStartedException extends RuntimeException {
  public override readonly name: string = "ProcessNotStartedException";
  public readonly program: string;

  public constructor(program: string, cause: unknown) {
    super(Resources.formatProgramRefused(program), cause);
    this.program = program;
  }
}
