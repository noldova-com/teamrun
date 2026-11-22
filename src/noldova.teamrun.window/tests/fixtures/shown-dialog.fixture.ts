/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IViewDialogOptions } from "@noldova/desktop.window";

export class ShownDialog {
  public readonly name: string;
  public readonly options: IViewDialogOptions | undefined;

  public constructor(name: string, options: IViewDialogOptions | undefined) {
    this.name = name;
    this.options = options;
  }
}
