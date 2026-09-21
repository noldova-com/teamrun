/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataSource, DbContextOptions } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryProvider } from "../fixtures/memory-provider.fixture.js";

@TestClass
export class DbContextOptionsTests {
  @TestMethod
  public holdsTheProviderAndTheDataSource(): void {
    const provider = new MemoryProvider();
    const dataSource = new DataSource("notes", ":memory:");
    const options = new DbContextOptions(provider, dataSource);

    Assert.areEqual(provider, options.provider);
    Assert.areEqual(dataSource, options.dataSource);
  }
}
