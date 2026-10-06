/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface ITestJob {
  readonly part: string;
  readonly name: string;
  readonly prebuilt: boolean;
  readonly build: boolean;
  readonly angular: boolean;
}
