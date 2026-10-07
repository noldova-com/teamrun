/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { effect } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ShellDocuments } from "../../../src/app/models/shell-documents";
import { LayoutService } from "../../../src/app/services/layout.service";
import { SettingsPageService } from "../../../src/app/services/settings-page.service";

describe("SettingsPageService", () => {
  let opened: DocumentTab[];

  beforeEach(() => {
    opened = [];
    TestBed.configureTestingModule({
      providers: [{ provide: LayoutService, useValue: { openDocument: (tab: DocumentTab) => opened.push(tab) } }]
    });
  });

  it("asks for no page at first, then opens Settings asking for a page until the page is taken", () => {
    const service = TestBed.inject(SettingsPageService);
    const initial = service.requested();

    service.open("About");
    const asked = service.requested();
    service.take();

    expect([initial, asked, service.requested()]).toEqual([null, "About", null]);
    expect(opened).toEqual([ShellDocuments.settingsTab]);
  });

  it("asks again for the same page, so Settings returns to it after the person moved away", () => {
    const service = TestBed.inject(SettingsPageService);
    const seen: (string | null)[] = [];
    TestBed.runInInjectionContext(() => effect(() => seen.push(service.requested())));
    TestBed.tick();

    service.open("About");
    TestBed.tick();
    service.open("About");
    TestBed.tick();

    expect(seen).toEqual([null, "About", "About"]);
  });
});
