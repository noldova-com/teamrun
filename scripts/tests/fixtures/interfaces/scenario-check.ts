/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IScenarioCheck {
  readonly name: string;
  readonly conclusion: string | null;
  readonly startedMinutesAgo: number | null;
  readonly finishedMinutesAgo: number | null;
}
