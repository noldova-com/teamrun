/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolFailureCode } from "@noldova/desktop.runtime";

import { PagesResources } from "../../services/pages/pages-resources.js";
import { RuntimeException } from "../runtime.exception.js";

export class PageException extends RuntimeException {
  public override readonly name: string = PagesResources.exceptionName;
  public readonly code: ToolFailureCode;

  public constructor(code: ToolFailureCode, message: string) {
    super(message);

    this.code = code;
  }
}
