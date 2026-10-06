/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TestPart from "../test-part.ts";
import type BuildTarget from "./build-target.ts";
import type ITestJob from "./interfaces/test-job.ts";

export default class TestJobPlan {
  private static readonly WHOLE: ITestJob = { part: "", name: "Build and test", prebuilt: false, build: true, angular: true };
  private static readonly PART_NAMES: readonly (readonly [string, string])[] = [
    [TestPart.PACKAGES, "Package tests"],
    [TestPart.SCRIPTS, "Script tests"],
    [TestPart.ANGULAR_AND_CHECKS, "Angular tests and checks"]
  ];

  public static plan(target: BuildTarget): readonly ITestJob[] {
    if (!target.splitsTests)
      return [TestJobPlan.WHOLE];
    return TestJobPlan.PART_NAMES.map(t => {
      const isAngular = t[0] === TestPart.ANGULAR_AND_CHECKS;
      return { part: t[0], name: t[1], prebuilt: true, build: isAngular, angular: isAngular };
    });
  }
}
