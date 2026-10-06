/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ISystemNotification {
  show(): void;
  close(): void;
  on(event: "show", listener: () => void): unknown;
  on(event: "click", listener: () => void): unknown;
  on(event: "close", listener: () => void): unknown;
  on(event: "failed", listener: (event: unknown, error: string) => void): unknown;
}
