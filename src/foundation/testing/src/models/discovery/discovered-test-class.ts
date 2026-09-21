/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { DiscoveredTestMethod } from "./discovered-test-method.js";

export class DiscoveredTestClass {
  public readonly packageName: string;
  public readonly className: string;
  public readonly filePath: string;
  public readonly testClassConstructor: new () => object;
  public readonly skipReason: string | undefined;
  public readonly methods: readonly DiscoveredTestMethod[];
  public readonly categories: readonly string[];

  public constructor(
    packageName: string,
    className: string,
    filePath: string,
    testClassConstructor: new () => object,
    skipReason: string | undefined,
    methods: readonly DiscoveredTestMethod[],
    categories: readonly string[] = []) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<DiscoveredTestClass>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(className, nameof<DiscoveredTestClass>(t => t.className));
    ArgumentException.throwIfNullOrWhitespace(filePath, nameof<DiscoveredTestClass>(t => t.filePath));
    if (!Object.isUndefined(skipReason))
      ArgumentException.throwIfNullOrWhitespace(skipReason, nameof<DiscoveredTestClass>(t => t.skipReason));

    ArgumentException.throwIfEmpty(methods, nameof<DiscoveredTestClass>(t => t.methods));
    for (const category of categories)
      ArgumentException.throwIfNullOrWhitespace(category, nameof<DiscoveredTestClass>(t => t.categories));

    this.packageName = packageName;
    this.className = className;
    this.filePath = filePath;
    this.testClassConstructor = testClassConstructor;
    this.skipReason = skipReason;
    this.methods = [...methods];
    this.categories = [...new Set(categories)];
  }
}
