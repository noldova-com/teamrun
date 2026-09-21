/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteConnection } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "./fixtures/temporary-directory.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public reportsTheCanonicalUnsupportedValueMessage(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));

    const failure = Assert.throws(() => connection.query(new SqlQuery("SELECT x'00' AS blob")), DataException);

    Assert.areEqual("The row holds a value that is neither text, a number, nor null.", failure.message);
  }
}
