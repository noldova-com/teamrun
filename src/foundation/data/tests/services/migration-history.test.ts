/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationHistory } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryMigrationHistory } from "../fixtures/memory-migration-history.fixture.js";

@TestClass
export class MigrationHistoryTests {
  @TestMethod
  public isImplementedByStoreKinds(): void {
    const history = new MemoryMigrationHistory();
    history.record("20260908130001_B");
    history.record("20260908130000_A");

    Assert.isInstanceOf(history, MigrationHistory);
    Assert.areEqual("20260908130000_A,20260908130001_B", history.getApplied().join(","));
  }
}
