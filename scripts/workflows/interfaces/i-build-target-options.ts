/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IBuildTargetOptions {
  readonly runsOnPullRequests: boolean;
  readonly runsSmokeOnPullRequests: boolean;
  readonly runsUiOnPushes: boolean;
  readonly uiShardCount: number;
  readonly splitsTests: boolean;
}
