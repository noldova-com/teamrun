/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide, DocumentContribution, ViewContribution, WindowPartTokens } from "@noldova/teamrun-shell-window";

import * as api from "../../src/api/index";
import { DockSide as SourceDockSide } from "../../src/app/enums/dock-side";
import { DocumentContribution as SourceDocumentContribution } from "../../src/app/models/document-contribution";
import { MenuDeclarations } from "../../src/app/models/menu-declarations";
import { ViewContribution as SourceViewContribution } from "../../src/app/models/view-contribution";
import { WindowPartSource } from "../../src/app/models/window-part-source";
import { WindowPartTokens as SourceWindowPartTokens } from "../../src/app/models/window-part-tokens";

describe("the window's API", () => {
  it("publishes the window-part contract", () => {
    expect([DockSide, DocumentContribution, ViewContribution, WindowPartTokens])
      .toEqual([SourceDockSide, SourceDocumentContribution, SourceViewContribution, SourceWindowPartTokens]);
  });

  it("leaves what only the build's generated source uses to the build entry", () => {
    expect(Object.values(api)).not.toContain(MenuDeclarations);
    expect(Object.values(api)).not.toContain(WindowPartSource);
  });
});
