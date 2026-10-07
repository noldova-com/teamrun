/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IVirtualListObserver {
  onInserted(at: number, count: number): void;
  onRemoved(at: number, count: number): void;
  onUpdated(at: number, count: number): void;
}
