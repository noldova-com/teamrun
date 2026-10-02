/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DiscoveredTestClassOptions } from "./discovered-test-class-options.js";
import type { DiscoveredTestMethod } from "./discovered-test-method.js";

export class DiscoveredTestClass {
  public readonly packageName: string;
  public readonly className: string;
  public readonly filePath: string;
  public readonly testClassConstructor: new () => object;
  public readonly methods: readonly DiscoveredTestMethod[];
  public readonly skipReason?: string;
  public readonly categories: readonly string[];

  public constructor(
    packageName: string,
    className: string,
    filePath: string,
    testClassConstructor: new () => object,
    methods: readonly DiscoveredTestMethod[],
    options: DiscoveredTestClassOptions = new DiscoveredTestClassOptions()) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<DiscoveredTestClass>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(className, nameof<DiscoveredTestClass>(t => t.className));
    ArgumentException.throwIfNullOrWhitespace(filePath, nameof<DiscoveredTestClass>(t => t.filePath));
    ArgumentException.throwIfEmpty(methods, nameof<DiscoveredTestClass>(t => t.methods));

    this.packageName = packageName;
    this.className = className;
    this.filePath = filePath;
    this.testClassConstructor = testClassConstructor;
    this.methods = [...methods];
    if (!Object.isUndefined(options.skipReason))
      this.skipReason = options.skipReason;
    this.categories = options.categories;
  }
}
