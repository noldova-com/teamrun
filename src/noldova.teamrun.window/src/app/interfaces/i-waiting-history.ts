/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DestroyRef, EnvironmentInjector, Injector } from "@angular/core";

export interface IWaitingHistory {
  readonly environment: EnvironmentInjector;
  readonly injector: Injector;
  readonly destroyRef: DestroyRef;
}
