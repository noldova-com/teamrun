/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ITestName from "./interfaces/test-name.ts";
import TestIdentity from "./test-identity.ts";

export default class TestNames {
  private readonly identities: Set<string> = new Set();
  private readonly repeated: Map<string, ITestName> = new Map();

  public get duplicates(): readonly ITestName[] {
    return [...this.repeated.values()];
  }

  public add(file: string, names: readonly string[]): void {
    const identity = TestIdentity.of(file, names);
    if (this.identities.has(identity))
      this.repeated.set(identity, { file, names });
    this.identities.add(identity);
  }
}
