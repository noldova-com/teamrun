/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface INativeUpdater {
  checkForUpdates(): void;
  on(event: string, listener: (...values: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...values: unknown[]) => void): unknown;
}
