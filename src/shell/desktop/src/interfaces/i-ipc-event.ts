/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISenderFrame } from "./i-sender-frame.js";

export interface IIpcEvent {
  readonly sender: { readonly id: number };
  readonly senderFrame: ISenderFrame | null;
}
