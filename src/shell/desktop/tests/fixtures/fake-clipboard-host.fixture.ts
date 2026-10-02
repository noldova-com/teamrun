/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IClipboardHost } from "@noldova/teamrun-shell-desktop";

export class FakeClipboardHost implements IClipboardHost {
  public readonly texts: string[] = [];

  public writeText(text: string): void {
    this.texts.push(text);
  }
}
