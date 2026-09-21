/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationHistory } from "@noldova/teamrun-foundation-data";
import { SqlMigrationHistory } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { RecordingConnection } from "../fixtures/recording-connection.fixture.js";

@TestClass
export class SqlMigrationHistoryTests {
  @TestMethod
  public createsItsTableWhenReadAndRecordsIds(): void {
    const connection = new RecordingConnection();
    const history = new SqlMigrationHistory(connection);

    Assert.isInstanceOf(history, MigrationHistory);
    Assert.areEqual(0, history.getApplied().length);
    history.record("20260908130001_B");
    history.record("20260908130000_A");

    Assert.areEqual("20260908130000_A,20260908130001_B", history.getApplied().join(","));
    Assert.isTrue(connection.statements[0]?.startsWith("CREATE TABLE IF NOT EXISTS __migrations") === true);
    Assert.areEqual("SELECT id FROM __migrations ORDER BY id", connection.statements[1]);
    Assert.isTrue(connection.statements[2]?.startsWith("INSERT INTO __migrations") === true);
  }
}
