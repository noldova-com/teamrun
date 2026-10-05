/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "../interfaces/i-window-part";
import type { WindowPartContext } from "./window-part-context";
import type { WindowPartSource } from "./window-part-source";

export class WindowPartActivation {
  public readonly source: WindowPartSource;
  public readonly context: WindowPartContext;
  public readonly part: IWindowPart;

  public constructor(source: WindowPartSource, context: WindowPartContext, part: IWindowPart) {
    this.source = source;
    this.context = context;
    this.part = part;
  }
}
