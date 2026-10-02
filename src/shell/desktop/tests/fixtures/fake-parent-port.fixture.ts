/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IParentPort } from "@noldova/teamrun-shell-desktop";

export class FakeParentPort implements IParentPort {
  public readonly messages: unknown[] = [];

  public postMessage(message: unknown): void {
    this.messages.push(message);
  }
}
