/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILog } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class RecordingLog implements ILog {
  public readonly lines: string[] = [];

  public write(message: string): void {
    this.lines.push(message);
    ChangeSignal.notify();
  }
}
