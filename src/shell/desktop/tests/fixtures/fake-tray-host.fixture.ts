/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITrayHost } from "@noldova/teamrun-shell-desktop";

import { FakeTray } from "./fake-tray.fixture.js";

export class FakeTrayHost implements ITrayHost {
  public readonly trays: FakeTray[] = [];
  public failure: Error | null = null;

  public get shown(): FakeTray | undefined {
    return this.trays.filter(t => !t.isDestroyed).at(-1);
  }

  public create(image: string): FakeTray {
    if (this.failure !== null)
      throw this.failure;
    const tray = new FakeTray(image);
    this.trays.push(tray);
    return tray;
  }
}
