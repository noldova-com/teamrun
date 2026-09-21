/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class DiscoveredTestMethod {
  public readonly methodName: string;
  public readonly testDataIndex: number | undefined;
  public readonly testData: readonly unknown[];
  public readonly skipReason: string | undefined;
  public readonly categories: readonly string[];
  public readonly displayName: string;

  public constructor(
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    skipReason: string | undefined,
    categories: readonly string[] = []) {
    ArgumentException.throwIfNullOrWhitespace(methodName, nameof<DiscoveredTestMethod>(t => t.methodName));
    if (Object.isUndefined(testDataIndex)) {
      if (testData.length > 0)
        throw new ArgumentException(Resources.testDataIdentityInvalid, nameof<DiscoveredTestMethod>(t => t.testData));
    }
    else {
      if (!Number.isInteger(testDataIndex) || testDataIndex < 0)
        throw new ArgumentOutOfRangeException(nameof<DiscoveredTestMethod>(t => t.testDataIndex), testDataIndex, Resources.testDataIndexInvalid);

      if (testData.length === 0)
        throw new ArgumentException(Resources.testDataIdentityInvalid, nameof<DiscoveredTestMethod>(t => t.testData));
    }

    if (!Object.isUndefined(skipReason))
      ArgumentException.throwIfNullOrWhitespace(skipReason, nameof<DiscoveredTestMethod>(t => t.skipReason));
    for (const category of categories)
      ArgumentException.throwIfNullOrWhitespace(category, nameof<DiscoveredTestMethod>(t => t.categories));

    this.methodName = methodName;
    this.testDataIndex = testDataIndex;
    this.testData = [...testData];
    this.skipReason = skipReason;
    this.categories = [...new Set(categories)];
    this.displayName = Object.isUndefined(this.testDataIndex) ? this.methodName : `${this.methodName}[${this.testDataIndex}]`;
  }
}
