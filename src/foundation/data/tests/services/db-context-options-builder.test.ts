/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataSource, DbContextOptions, DbContextOptionsBuilder } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryProvider } from "../fixtures/memory-provider.fixture.js";

@TestClass
export class DbContextOptionsBuilderTests {
  @TestMethod
  public buildsOptionsForAProviderAndADataSource(): void {
    const provider = new MemoryProvider();
    const dataSource = new DataSource("notes", ":memory:");

    const options = new DbContextOptionsBuilder().use(provider, dataSource);

    Assert.isInstanceOf(options, DbContextOptions);
    Assert.areEqual(provider, options.provider);
    Assert.areEqual(dataSource, options.dataSource);
  }
}
