/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Project, ProjectListing } from "@noldova/teamrun.protocol";

@TestClass
export class ProjectListingTests {
  private static readonly json: object = {
    project: { id: "prj-1", name: "fixture", rootPath: "/work/fixture", createdAt: "2026-09-08T09:00:00Z" },
    folderMissing: true
  };

  @TestMethod
  public holdsTheProjectAndWhetherItsFolderIsMissing(): void {
    const listing = new ProjectListing(new Project("prj-2", "plain", "/work/plain", "t"), false);

    Assert.areEqual("/work/plain", listing.project.rootPath);
    Assert.isFalse(listing.folderMissing);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const listing = ProjectListing.fromJson(ProjectListingTests.json);

    Assert.areEqual("prj-1", listing.project.id);
    Assert.isTrue(listing.folderMissing);
    Assert.areEqual(JSON.stringify(ProjectListingTests.json), JSON.stringify(listing.toJson()));
  }

  @TestMethod
  public reportsMissingAndNestedFieldsWithTheirPath(): void {
    Assert.areEqual("$.folderMissing", Assert.throws(() => ProjectListing.fromJson({ ...ProjectListingTests.json, folderMissing: "yes" }), JsonException).path);
    Assert.areEqual("$.project.rootPath", Assert.throws(() => ProjectListing.fromJson({ ...ProjectListingTests.json,
      project: { id: "prj-1", name: "fixture", createdAt: "t" } }), JsonException).path);
  }
}
