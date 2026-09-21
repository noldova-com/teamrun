/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeFeed, ChangeOperation, DataException, DataRecord, type DataValue } from "@noldova/teamrun-foundation-data";
import { SqlChangeFeed } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { RecordingConnection } from "../fixtures/recording-connection.fixture.js";

@TestClass
export class SqlChangeFeedTests {
  @TestMethod
  public preparesItsTableOnceAndAppendsWithTheAssignedSequence(): void {
    const connection = new RecordingConnection();
    const feed = new SqlChangeFeed(connection);

    const first = feed.append("note", "a", ChangeOperation.Insert, "{}");
    const second = feed.append("note", "a", ChangeOperation.Delete, "{}");

    Assert.isInstanceOf(feed, ChangeFeed);
    Assert.areEqual(1, first.sequence);
    Assert.areEqual(2, second.sequence);
    Assert.areEqual(ChangeOperation.Delete, second.operation);
    Assert.isTrue(connection.statements[0]?.startsWith("CREATE TABLE IF NOT EXISTS __changes") === true);
    Assert.isTrue(connection.statements[1]?.startsWith("CREATE INDEX IF NOT EXISTS IX___changes_entity_entityId") === true);
    Assert.areEqual(2, connection.statements.filter(t => t.startsWith("INSERT INTO __changes")).length);
    Assert.areEqual(4, connection.statements.length);
  }

  @TestMethod
  public readsTheRecordsTheStoreReturns(): void {
    const connection = new RecordingConnection();
    connection.queryResults.push(SqlChangeFeedTests.createRecord(3, "Delete"), SqlChangeFeedTests.createRecord(4, "Insert"));
    const feed = new SqlChangeFeed(connection);

    const changes = feed.readAfter(2, 10);

    Assert.areEqual("3,4", changes.map(t => t.sequence).join(","));
    Assert.areEqual(ChangeOperation.Delete, changes[0]?.operation);
    Assert.areEqual("{\"id\":\"a\"}", changes[0]?.payload);
    Assert.isTrue(connection.statements.some(t => t.startsWith("SELECT sequence, entity, entityId, operation, payload, createdAt FROM __changes WHERE sequence > ?")));
  }

  @TestMethod
  public rejectsRecordsWithUnknownOperations(): void {
    const connection = new RecordingConnection();
    connection.queryResults.push(SqlChangeFeedTests.createRecord(1, "upsert"));
    const feed = new SqlChangeFeed(connection);

    Assert.throws(() => feed.readAfter(0), DataException);
  }

  private static createRecord(sequence: number, operation: string): DataRecord {
    const values: [string, DataValue][] = [["sequence", sequence], ["entity", "note"], ["entityId", "a"], ["operation", operation], ["payload", "{\"id\":\"a\"}"], ["createdAt", "t"]];
    return new DataRecord(new Map(values));
  }
}
