/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class CommandOutputDecoder {
  public static decode(text: string): string {
    return text.replace(Resources.utf16RunPattern, (run: string, mark: string, pairs: string) =>
      mark.length > 0 || pairs.length >= Resources.minimumUtf16Run * 2 ? pairs.replace(Resources.utf16PairPattern, "$1$2") : run);
  }
}
