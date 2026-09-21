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
import { ProjectIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class ProjectIdParamsTests {
  private static readonly json: object = { projectId: "prj-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProjectIdParams.fromJson(ProjectIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ProjectIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProjectIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProjectIdParams.fromJson({ ...ProjectIdParamsTests.json, projectId: String.empty }), JsonException);

    Assert.areEqual("$.projectId", exception.path);
  }
}
