/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException, DataRecord, type DataValue } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataRecordTests {
  private static createRecord(): DataRecord {
    const values: [string, DataValue][] = [["id", "a"], ["count", 3], ["ratio", 1.5], ["title", null]];
    return new DataRecord(new Map(values));
  }

  @TestMethod
  public readsTypedFields(): void {
    const record = DataRecordTests.createRecord();

    Assert.isTrue(record.hasField("title"));
    Assert.isFalse(record.hasField("missing"));
    Assert.areEqual("a", record.readString("id"));
    Assert.areEqual(3, record.readInteger("count"));
    Assert.areEqual("a", record.readNullableString("id"));
    Assert.isNull(record.readNullableString("title"));
    Assert.areEqual(3, record.readNullableInteger("count"));
    Assert.isNull(record.readNullableInteger("title"));
    Assert.areEqual(1.5, record.readValue("ratio"));
  }

  @TestMethod
  public rejectsMissingAndMistypedFields(): void {
    const record = DataRecordTests.createRecord();

    Assert.isTrue(Assert.throws(() => record.readValue("missing"), DataException).message.includes("\"missing\""));
    Assert.throws(() => record.readString("count"), DataException);
    Assert.throws(() => record.readString("title"), DataException);
    Assert.throws(() => record.readInteger("id"), DataException);
    Assert.throws(() => record.readInteger("ratio"), DataException);
    Assert.throws(() => record.readInteger("title"), DataException);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheValues(): void {
    const values = new Map<string, DataValue>([["id", "a"]]);
    const record = new DataRecord(values);
    values.set("id", "b");

    Assert.areEqual("a", record.readString("id"));
  }
}
