/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ShellDocuments } from "../../../src/app/models/shell-documents";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ModuleSelectionService } from "../../../src/app/services/module-selection.service";

describe("ModuleSelectionService", () => {
  let opened: DocumentTab[];

  beforeEach(() => {
    opened = [];
    TestBed.configureTestingModule({
      providers: [{ provide: LayoutService, useValue: { openDocument: (tab: DocumentTab) => opened.push(tab) } }]
    });
  });

  it("selects no module at first, then the one it is given, without opening anything", () => {
    const service = TestBed.inject(ModuleSelectionService);
    const initial = service.selected();

    service.select("clock");

    expect([initial, service.selected(), opened]).toEqual([null, "clock", []]);
  });

  it("selects a module and opens the Modules document to show it", () => {
    const service = TestBed.inject(ModuleSelectionService);

    service.open("notes");

    expect(service.selected()).toBe("notes");
    expect(opened).toEqual([ShellDocuments.modulesTab]);
  });
});
