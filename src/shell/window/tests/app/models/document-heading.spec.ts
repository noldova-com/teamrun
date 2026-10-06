/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DocumentHeading } from "../../../src/app/models/document-heading";
import { Resources } from "../../../src/resources";

describe("DocumentHeading", () => {
  it("joins its breadcrumb and title, names the window after the title, and keeps its own copy of the breadcrumb", () => {
    const breadcrumb = ["Notes", "Drafts"];
    const heading = new DocumentHeading("Plan", breadcrumb);
    breadcrumb.push("Archive");

    expect([heading.text, heading.windowTitle, heading.breadcrumb]).toEqual(["Notes › Drafts › Plan", `Plan — ${Resources.productName}`, ["Notes", "Drafts"]]);
    expect(new DocumentHeading("Plan").text).toBe("Plan");
  });

  it("changes its title, its breadcrumb or both, and keeps what is left out", () => {
    const heading = new DocumentHeading("Plan", ["Notes"]);

    expect([heading.with("Todo", null), heading.with(null, []), heading.with("Todo", ["Tasks"]), heading.with(null, null)].map(t => t.text))
      .toEqual(["Notes › Todo", "Plan", "Tasks › Todo", "Notes › Plan"]);
  });

  it("refuses a blank title and a blank breadcrumb segment", () => {
    expect(() => new DocumentHeading(" ")).toThrowError(ArgumentException);
    expect(() => new DocumentHeading("Plan", ["Notes", ""])).toThrowError(Resources.invalidBreadcrumb);
    expect(() => new DocumentHeading("Plan", ["  "])).toThrowError(ArgumentException);
  });
});
