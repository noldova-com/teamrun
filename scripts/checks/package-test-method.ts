/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestMethodResult } from "@noldova/context.testing";

export class PackageTestMethod {
  public readonly file: string;
  public readonly method: TestMethodResult;

  public constructor(file: string, method: TestMethodResult) {
    this.file = file;
    this.method = method;
  }
}
