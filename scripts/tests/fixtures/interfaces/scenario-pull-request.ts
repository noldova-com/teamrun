/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IScenarioCheck from "./scenario-check.ts";
import type IScenarioComment from "./scenario-comment.ts";
import type IScenarioReview from "./scenario-review.ts";

export default interface IScenarioPullRequest {
  readonly number: number;
  readonly isDraft?: boolean;
  readonly base?: string;
  readonly mergeState?: string;
  readonly hasAutoMerge?: boolean;
  readonly commitMinutesAgo?: number;
  readonly buildRuns?: number;
  readonly checks?: readonly IScenarioCheck[];
  readonly reviews?: readonly IScenarioReview[];
  readonly events?: readonly string[];
  readonly comments?: readonly IScenarioComment[];
}
