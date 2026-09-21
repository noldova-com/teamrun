/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataSource } from "@noldova/teamrun-foundation-data";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataSourceTests {
  @TestMethod
  public holdsANameAndALocation(): void {
    const dataSource = new DataSource("teamrun", "/data/teamrun.db");

    Assert.areEqual("teamrun", dataSource.name);
    Assert.areEqual("/data/teamrun.db", dataSource.location);
  }

  @TestMethod
  public rejectsBlankParts(): void {
    Assert.areEqual("name", Assert.throws(() => new DataSource(" ", "/data"), ArgumentException).parameterName);
    Assert.areEqual("location", Assert.throws(() => new DataSource("teamrun", ""), ArgumentException).parameterName);
  }
}
