/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class LogText {
  public static lines(text: string): readonly string[] {
    return text.trimEnd().split(Resources.logLineBreakPattern).map(t => t.replace(Resources.logControlPattern, String.empty));
  }
}
