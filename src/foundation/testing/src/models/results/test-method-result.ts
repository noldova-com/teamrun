/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { TestOutcome } from "../../enums/test-outcome.js";
import { Resources } from "../../resources.js";

export class TestMethodResult {
  public readonly packageName: string;
  public readonly className: string;
  public readonly methodName: string;
  public readonly testDataIndex: number | undefined;
  public readonly testData: readonly unknown[];
  public readonly outcome: TestOutcome;
  public readonly durationMilliseconds: number;
  public readonly failure: unknown;
  public readonly skipReason: string | undefined;
  public readonly displayName: string;

  public constructor(
    packageName: string,
    className: string,
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    outcome: TestOutcome,
    durationMilliseconds: number,
    failure: unknown,
    skipReason: string | undefined) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<TestMethodResult>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(className, nameof<TestMethodResult>(t => t.className));
    ArgumentException.throwIfNullOrWhitespace(methodName, nameof<TestMethodResult>(t => t.methodName));
    if (Object.isUndefined(testDataIndex)) {
      if (testData.length > 0)
        throw new ArgumentException(Resources.testDataIdentityInvalid, nameof<TestMethodResult>(t => t.testData));
    }
    else {
      if (!Number.isInteger(testDataIndex) || testDataIndex < 0)
        throw new ArgumentOutOfRangeException(nameof<TestMethodResult>(t => t.testDataIndex), testDataIndex, Resources.testDataIndexInvalid);

      if (testData.length === 0)
        throw new ArgumentException(Resources.testDataIdentityInvalid, nameof<TestMethodResult>(t => t.testData));
    }

    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0)
      throw new ArgumentOutOfRangeException(
        nameof<TestMethodResult>(t => t.durationMilliseconds),
        durationMilliseconds,
        Resources.durationInvalid);

    if (outcome !== TestOutcome.Failed && !Object.isUndefined(failure))
      throw new ArgumentException(Resources.outcomeCannotCarryFailure(outcome), nameof<TestMethodResult>(t => t.failure));

    if (outcome === TestOutcome.Skipped)
      ArgumentException.throwIfNullOrWhitespace(skipReason, nameof<TestMethodResult>(t => t.skipReason));
    else if (!Object.isUndefined(skipReason))
      throw new ArgumentException(Resources.outcomeCannotCarrySkipReason(outcome), nameof<TestMethodResult>(t => t.skipReason));

    this.packageName = packageName;
    this.className = className;
    this.methodName = methodName;
    this.testDataIndex = testDataIndex;
    this.testData = [...testData];
    this.outcome = outcome;
    this.durationMilliseconds = durationMilliseconds;
    this.failure = failure;
    this.skipReason = skipReason;
    this.displayName = Object.isUndefined(this.testDataIndex)
      ? `${this.className}.${this.methodName}`
      : `${this.className}.${this.methodName}[${this.testDataIndex}]`;
  }
}
