/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateBarrier, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";

export interface IUpdateHost {
  readonly processId: number;

  readBarrierAsync(): Promise<UpdateBarrier | null>;
  hasUpdateEndedAsync(): Promise<boolean>;
  saveAsync(): Promise<readonly string[]>;
  passBarrierAsync(status: UpdateBarrierStatus): Promise<boolean>;
  quit(): void;
}
