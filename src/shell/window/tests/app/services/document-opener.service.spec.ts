/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { DocumentOpenerService } from "../../../src/app/services/document-opener.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("DocumentOpenerService", () => {
  let opener: DocumentOpenerService;
  let layout: LayoutService;
  let labels: TabLabelService;

  beforeEach(() => {
    opener = TestBed.inject(DocumentOpenerService);
    layout = TestBed.inject(LayoutService);
    labels = TestBed.inject(TabLabelService);
    layout.setRegistry(LayoutFixture.createRegistry());
  });

  it("opens a module's own document with its title and activates it when opened again with a new title", () => {
    opener.open("notes", "notes.note", "1", "Note 1");
    opener.open("notes", "notes.note", "2", "Note 2");
    opener.open("notes", "notes.note", "1", "First note");
    const first = new DocumentTab("notes.note", "1");

    expect(layout.layout().documents.tabs).toEqual([first, new DocumentTab("notes.note", "2")]);
    expect(layout.layout().documents.active).toEqual(first);
    expect(labels.of(first).title).toBe("First note");
  });

  it("refuses another module's document, an unregistered one and an empty title", () => {
    expect(() => opener.open("clock", "notes.note", "1", "Note 1")).toThrow(ArgumentException);
    expect(() => opener.open("note", "notes.note", "1", "Note 1")).toThrow(ArgumentException);
    expect(() => opener.open("notes", "notes.page", "1", "Page")).toThrow(ArgumentException);
    expect(() => opener.open("notes", "notes.note", "1", " ")).toThrow(ArgumentException);
    expect(layout.layout().documents.tabs).toEqual([]);
  });
});
