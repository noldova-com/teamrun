/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IParentPort {
  postMessage(message: unknown): void;
  once(event: "message", listener: () => void): unknown;
}
