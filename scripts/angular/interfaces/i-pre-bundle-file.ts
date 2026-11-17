/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPreBundleFile {
  readonly file: string;
  readonly size: number;
  readonly sha256: string;
}
