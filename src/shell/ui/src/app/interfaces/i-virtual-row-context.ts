/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IVirtualRowContext<T> {
  readonly $implicit: T;
  readonly index: number;
  readonly height: number;
  readonly labelId: string;
  readonly descriptionId: string;
}
