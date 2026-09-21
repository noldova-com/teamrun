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
import { Project } from "@noldova/teamrun-protocol";

@TestClass
export class ProjectTests {
  private static readonly json: object = { id: "prj-1", name: "fixture", rootPath: "/work/fixture", createdAt: "2026-09-08T09:00:00Z" };

  @TestMethod
  public holdsTheProjectDefinition(): void {
    const project = new Project("prj-2", "plain", "/work/plain", "t");

    Assert.areEqual("plain", project.name);
    Assert.areEqual("/work/plain", project.rootPath);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new Project(String.empty, "plain", "/work/plain", "t"), ArgumentException);
    Assert.throws(() => new Project("prj", String.empty, "/work/plain", "t"), ArgumentException);
    Assert.throws(() => new Project("prj", "plain", " ", "t"), ArgumentException);
    Assert.throws(() => new Project("prj", "plain", "/work/plain", String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const project = Project.fromJson(ProjectTests.json);

    Assert.areEqual("prj-1", project.id);
    Assert.areEqual("/work/fixture", project.rootPath);
    Assert.areEqual(JSON.stringify(ProjectTests.json), JSON.stringify(project.toJson()));
  }

  @TestMethod
  public reportsMissingFieldsWithTheirPath(): void {
    Assert.areEqual("$.rootPath", Assert.throws(() => Project.fromJson({ ...ProjectTests.json, rootPath: undefined }), JsonException).path);
  }
}
