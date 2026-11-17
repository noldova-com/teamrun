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
import { ProjectFolderChange } from "@noldova/teamrun.protocol";

@TestClass
export class ProjectFolderChangeTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { projectId: "prj-1", folderMissing: false };
    const change = ProjectFolderChange.fromJson(json);

    Assert.areEqual("prj-1", change.projectId);
    Assert.isFalse(change.folderMissing);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(change.toJson()));
  }

  @TestMethod
  public rejectsABlankProjectAndReportsMissingFieldsWithTheirPath(): void {
    Assert.throws(() => new ProjectFolderChange(" ", true), ArgumentException);
    Assert.areEqual("$.folderMissing", Assert.throws(() => ProjectFolderChange.fromJson({ projectId: "prj-1" }), JsonException).path);
  }
}
