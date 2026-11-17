/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { CliException } from "./cli.exception.js";

export class CliPartException extends CliException {
  public override readonly name: string = "CliPartException";
  public readonly method: string;

  public constructor(method: string) {
    super(Resources.formatNotAList(method));
    this.method = method;
  }
}
