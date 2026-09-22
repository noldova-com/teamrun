/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class LineBuffer {
  private pending: string = String.empty;

  public append(chunk: string): readonly string[] {
    const lines: string[] = [];
    this.pending += chunk;
    let index = this.pending.indexOf(Resources.lineSeparator);
    while (index >= 0) {
      const line = this.pending.slice(0, index).trim();
      this.pending = this.pending.slice(index + 1);
      if (!String.isNullOrWhitespace(line))
        lines.push(line);
      index = this.pending.indexOf(Resources.lineSeparator);
    }

    return lines;
  }
}
