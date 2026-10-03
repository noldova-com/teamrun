/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WorkReport } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WorkReportTests {
  @TestMethod
  public keepsItsDescriptionsInOrderAndMayBeEmpty(): void {
    const descriptions = ["Indexing the project", "Saving the notes"];
    const report = new WorkReport(descriptions);
    descriptions.pop();

    const copy = WorkReport.fromJson(JSON.parse(JSON.stringify(report.toJson())));

    Assert.areEqual("Indexing the project,Saving the notes", copy.descriptions.join(","));
    Assert.areEqual(0, WorkReport.fromJson({ descriptions: [] }).descriptions.length);
  }

  @TestMethod
  public refusesABlankDescriptionAndNamesWhatIsInvalid(): void {
    Assert.throws(() => new WorkReport(["Indexing", " "]), ArgumentException);
    Assert.areEqual("$.descriptions", Assert.throws(() => WorkReport.fromJson({}), JsonException).path);
    Assert.areEqual("$.descriptions", Assert.throws(() => WorkReport.fromJson({ descriptions: [""] }), JsonException).path);
  }
}
