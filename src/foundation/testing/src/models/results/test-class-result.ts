/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";
import type { TestMethodResult } from "./test-method-result.js";

export class TestClassResult {
  public readonly packageName: string;
  public readonly className: string;
  public readonly filePath: string;
  public readonly methodResults: readonly TestMethodResult[];

  public constructor(packageName: string, className: string, filePath: string, methodResults: readonly TestMethodResult[]) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<TestClassResult>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(className, nameof<TestClassResult>(t => t.className));
    ArgumentException.throwIfNullOrWhitespace(filePath, nameof<TestClassResult>(t => t.filePath));
    ArgumentException.throwIfEmpty(methodResults, nameof<TestClassResult>(t => t.methodResults));

    if (methodResults.some(t => t.packageName !== packageName || t.className !== className))
      throw new ArgumentException(Resources.methodResultIdentityInvalid, nameof<TestClassResult>(t => t.methodResults));

    this.packageName = packageName;
    this.className = className;
    this.filePath = filePath;
    this.methodResults = [...methodResults];
  }
}
