/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

export class TestProject {
  public readonly packageName: string;
  public readonly rootDirectory: string;

  public constructor(packageName: string, rootDirectory: string) {
    ArgumentException.throwIfNullOrWhitespace(packageName, nameof<TestProject>(t => t.packageName));
    ArgumentException.throwIfNullOrWhitespace(rootDirectory, nameof<TestProject>(t => t.rootDirectory));

    this.packageName = packageName;
    this.rootDirectory = rootDirectory;
  }
}
