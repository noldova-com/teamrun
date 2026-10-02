/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide, DocumentContribution, ViewContribution, WindowPartSource, WindowPartTokens } from "@noldova/teamrun-shell-window";

import { DockSide as SourceDockSide } from "../../src/app/enums/dock-side";
import { DocumentContribution as SourceDocumentContribution } from "../../src/app/models/document-contribution";
import { ViewContribution as SourceViewContribution } from "../../src/app/models/view-contribution";
import { WindowPartSource as SourceWindowPartSource } from "../../src/app/models/window-part-source";
import { WindowPartTokens as SourceWindowPartTokens } from "../../src/app/models/window-part-tokens";

describe("the window's API", () => {
  it("publishes the window-part contract", () => {
    expect([DockSide, DocumentContribution, ViewContribution, WindowPartSource, WindowPartTokens])
      .toEqual([SourceDockSide, SourceDocumentContribution, SourceViewContribution, SourceWindowPartSource, SourceWindowPartTokens]);
  });
});
