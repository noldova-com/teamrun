/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPagePerformance {
  loaf: { duration: number; blocking: number; scripts: { invoker: string; fn: string; url: string; pos: number; duration: number }[] }[];
  events: { duration: number }[];
  keys: number[];
  frames: number[];
  sampling: boolean;
}
