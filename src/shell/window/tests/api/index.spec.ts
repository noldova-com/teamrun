/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide, DocumentContribution, ViewContribution } from "@noldova/teamrun-shell-window";

import { DockSide as SourceDockSide } from "../../src/app/enums/dock-side";
import { DocumentContribution as SourceDocumentContribution } from "../../src/app/models/document-contribution";
import { ViewContribution as SourceViewContribution } from "../../src/app/models/view-contribution";

describe("the window's API", () => {
  it("publishes the window-part contract", () => {
    expect([DockSide, DocumentContribution, ViewContribution]).toEqual([SourceDockSide, SourceDocumentContribution, SourceViewContribution]);
  });
});
