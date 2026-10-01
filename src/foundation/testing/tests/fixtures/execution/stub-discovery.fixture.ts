/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiscoveredTestClass, TestDiscovery } from "@noldova/teamrun-foundation-testing";

export class StubDiscovery extends TestDiscovery {
  private readonly testClasses: readonly DiscoveredTestClass[];

  public constructor(testClasses: readonly DiscoveredTestClass[]) {
    super();

    this.testClasses = testClasses;
  }

  public override async discoverAsync(): Promise<DiscoveredTestClass[]> {
    return [...this.testClasses];
  }
}
