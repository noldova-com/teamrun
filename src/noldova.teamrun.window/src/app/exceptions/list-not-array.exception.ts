/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class ListNotArrayException extends WindowException {
  public override readonly name: string = "ListNotArrayException";
  public readonly kind: string;

  public constructor(kind: string) {
    super(Resources.formatListNotArray(kind));
    this.kind = kind;
  }
}
