/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProjectOpenParams } from "@noldova/teamrun-protocol";

@TestClass
export class ProjectOpenParamsTests {
  private static readonly json: object = { rootPath: "/work/fixture" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProjectOpenParams.fromJson(ProjectOpenParamsTests.json);

    Assert.areEqual(JSON.stringify(ProjectOpenParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProjectOpenParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProjectOpenParams.fromJson({ ...ProjectOpenParamsTests.json, rootPath: null }), JsonException);

    Assert.areEqual("$.rootPath", exception.path);
  }
}
