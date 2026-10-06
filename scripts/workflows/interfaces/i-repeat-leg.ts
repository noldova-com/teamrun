/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IRepeatLeg {
  readonly name: string;
  readonly key: string;
  readonly runner: string;
  readonly architecture: string;
  readonly repeats: number;
  readonly shard: string;
  readonly hasTests: boolean;
}
