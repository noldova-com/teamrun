/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { TestOutcome } from "../../enums/test-outcome.js";
import { Resources } from "../../resources.js";
import type { TestDataRow } from "../discovery/test-data-row.js";
import { TestMethodResultOptions } from "./test-method-result-options.js";

export class TestMethodResult {
  public readonly packageName: string;
  public readonly className: string;
  public readonly methodName: string;
  public readonly outcome: TestOutcome;
  public readonly durationMilliseconds: number;
  public readonly testDataRow?: TestDataRow;
  public readonly failure?: unknown;
  public readonly skipReason?: string;
  public readonly displayName: string;

  public constructor(
    packageName: string,
    className: string,
    methodName: string,
    outcome: TestOutcome,
    durationMilliseconds: number,
    options: TestMethodResultOptions = new TestMethodResultOptions()) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<TestMethodResult>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(className, nameof<TestMethodResult>(t => t.className));
    ArgumentException.throwIfNullOrWhitespace(methodName, nameof<TestMethodResult>(t => t.methodName));
    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0)
      throw new ArgumentOutOfRangeException(
        nameof<TestMethodResult>(t => t.durationMilliseconds),
        durationMilliseconds,
        Resources.durationInvalid);

    if (outcome !== TestOutcome.Failed && !Object.isUndefined(options.failure))
      throw new ArgumentException(Resources.formatOutcomeCannotCarryFailure(outcome), nameof<TestMethodResult>(t => t.failure));

    if (outcome === TestOutcome.Skipped)
      ArgumentException.throwIfNullOrWhitespace(options.skipReason, nameof<TestMethodResult>(t => t.skipReason));
    else if (!Object.isUndefined(options.skipReason))
      throw new ArgumentException(Resources.formatOutcomeCannotCarrySkipReason(outcome), nameof<TestMethodResult>(t => t.skipReason));

    this.packageName = packageName;
    this.className = className;
    this.methodName = methodName;
    this.outcome = outcome;
    this.durationMilliseconds = durationMilliseconds;
    if (!Object.isUndefined(options.testDataRow))
      this.testDataRow = options.testDataRow;
    if (!Object.isUndefined(options.failure))
      this.failure = options.failure;
    if (!Object.isUndefined(options.skipReason))
      this.skipReason = options.skipReason;
    this.displayName = Object.isUndefined(options.testDataRow)
      ? `${className}.${methodName}`
      : `${className}.${methodName}[${options.testDataRow.index}]`;
  }
}
