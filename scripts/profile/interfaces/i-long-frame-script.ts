/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ILongFrameScript {
  invoker: string;
  fn: string;
  url: string;
  pos: number;
  duration: number;
}
