/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataFolder } from "@noldova/teamrun.protocol";

@TestClass
export class DataFolderTests {
  private static readonly json: object = { path: "/data/modules/teamrun", databaseFile: "/data/modules/teamrun/teamrun.sqlite" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const folder = DataFolder.fromJson(DataFolderTests.json);

    Assert.areEqual(JSON.stringify(DataFolderTests.json), JSON.stringify(folder.toJson()));
    Assert.areEqual("/data/modules/teamrun", folder.path);
    Assert.areEqual("/data/modules/teamrun/teamrun.sqlite", folder.databaseFile);
  }

  @TestMethod
  public rejectsBlanksAndInvalidJson(): void {
    Assert.throws(() => new DataFolder(String.empty, "/data/teamrun.sqlite"), ArgumentException);
    Assert.throws(() => new DataFolder("/data", " "), ArgumentException);
    Assert.areEqual("$.databaseFile", Assert.throws(() => DataFolder.fromJson({ path: "/data" }), JsonException).path);
    Assert.areEqual("$.path", Assert.throws(() => DataFolder.fromJson({ path: " ", databaseFile: "/data/teamrun.sqlite" }), JsonException).path);
  }
}
