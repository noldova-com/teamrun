/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateBarrier } from "@noldova/teamrun-shell-runtime";

export interface IUpdateHost {
  readonly processId: number;

  readBarrierAsync(): Promise<UpdateBarrier | null>;
  saveAsync(): Promise<readonly string[]>;
  quit(): void;
}
