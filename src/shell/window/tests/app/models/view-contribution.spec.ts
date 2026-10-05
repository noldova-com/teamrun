/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { DockSide } from "../../../src/app/enums/dock-side";
import { ViewContribution } from "../../../src/app/models/view-contribution";

@Component({ template: "" })
class FilesViewComponent {
}

describe("ViewContribution", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(FilesViewComponent);

  it("keeps its name, title, icon, default place and loader", async () => {
    const view = new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load);

    expect([view.name, view.title, view.icon, view.defaultSide, view.isShownByDefault]).toEqual(["files.tree", "Files", "folder", DockSide.Left, true]);
    expect(await view.loadComponent()).toBe(FilesViewComponent);
  });

  it("leaves its padding to its module unless it declares one", () => {
    expect([new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load).padding, new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load, ContentPadding.None).padding])
      .toEqual([null, ContentPadding.None]);
  });

  for (const [name, title, icon] of [["tree", "Files", "folder"], ["files.tree", " ", "folder"], ["files.tree", "Files", ""]] as const)
    it(`refuses the name "${name}", the title "${title}" and the icon "${icon}"`, () => {
      expect(() => new ViewContribution(name, title, icon, DockSide.Right, false, load)).toThrowError(ArgumentException);
    });
});
