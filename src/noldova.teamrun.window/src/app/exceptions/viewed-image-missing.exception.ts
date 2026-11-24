/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class ViewedImageMissingException extends WindowException {
  public override readonly name: string = "ViewedImageMissingException";
  public readonly key: string;

  public constructor(key: string) {
    super(Resources.formatViewedImageMissing(key));
    this.key = key;
  }
}
