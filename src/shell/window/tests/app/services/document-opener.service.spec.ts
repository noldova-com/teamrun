/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import { DocumentOpenerService } from "../../../src/app/services/document-opener.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("DocumentOpenerService", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

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
    opener.open("notes", "notes.note", "1", "Note 1", false);
    opener.open("notes", "notes.note", "2", "Note 2", false);
    opener.open("notes", "notes.note", "1", "First note", false);
    const first = new DocumentTab("notes.note", "1");

    expect(layout.layout().documents.tabs).toEqual([first, new DocumentTab("notes.note", "2")]);
    expect(layout.layout().documents.active).toEqual(first);
    expect(labels.of(first).title).toBe("First note");
  });

  it("opens a document as a preview that the next preview replaces, and keeps it on request", () => {
    opener.open("notes", "notes.note", "1", "Note 1", true);
    opener.open("notes", "notes.note", "2", "Note 2", true);
    opener.keep("notes", "notes.note", "2");
    const second = new DocumentTab("notes.note", "2");

    expect(layout.layout().documents.tabs).toEqual([second]);
    expect(layout.layout().documents.preview).toBeNull();
    expect(() => opener.keep("clock", "notes.note", "2")).toThrow(ArgumentException);
    expect(() => opener.keep("notes", "notes.page", "2")).toThrow(ArgumentException);
  });

  it("restores an open document with its title and keeps it without activating it, and adds one that is not open without activating it", () => {
    const first = new DocumentTab("notes.note", "1");
    const second = new DocumentTab("notes.note", "2");
    const third = new DocumentTab("notes.note", "3");
    opener.open("notes", "notes.note", "1", "Note 1", false);
    opener.open("notes", "notes.note", "2", "Note 2", true);
    opener.open("notes", "notes.note", "1", "Note 1", false);

    opener.restore("notes", "notes.note", "2", "Second note", true);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, second]);
    opener.restore("notes", "notes.note", "2", "Second note", false);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, null]);
    expect(labels.of(second).title).toBe("Second note");
    opener.restore("notes", "notes.note", "3", "Note 3", true);
    expect(layout.layout().documents.tabs).toEqual([first, second, third]);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, third]);
    expect(() => opener.restore("clock", "notes.note", "1", "Note 1", false)).toThrow(ArgumentException);
  });

  it("restores a document into an empty group as its active tab, and a preview as a kept tab when the group has a preview", () => {
    const first = new DocumentTab("notes.note", "1");
    const second = new DocumentTab("notes.note", "2");
    opener.restore("notes", "notes.note", "1", "Note 1", true);
    opener.restore("notes", "notes.note", "2", "Note 2", true);

    expect(layout.layout().documents.tabs).toEqual([first, second]);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, first]);
  });

  it("restores a document in another document group without making that group the active one", () => {
    const first = new DocumentTab("notes.note", "1");
    opener.open("notes", "notes.note", "1", "Note 1", false);
    opener.open("notes", "notes.note", "2", "Note 2", false);
    layout.place(new DocumentTab("notes.note", "2"), new SplitDropTarget(layout.layout().documents.id, PanelEdge.Right));
    layout.activate(first);
    const active = layout.layout().documents.id;

    opener.restore("notes", "notes.note", "2", "Note 2", false);

    expect(layout.layout().documentGroups).toHaveLength(2);
    expect(layout.layout().documents.id).toBe(active);
    expect(layout.layout().documents.active).toEqual(first);
  });

  it("refuses another module's document, an unregistered one and an empty title", () => {
    expect(() => opener.open("clock", "notes.note", "1", "Note 1", false)).toThrow(ArgumentException);
    expect(() => opener.open("note", "notes.note", "1", "Note 1", false)).toThrow(ArgumentException);
    expect(() => opener.open("notes", "notes.page", "1", "Page", false)).toThrow(ArgumentException);
    expect(() => opener.open("notes", "notes.note", "1", " ", false)).toThrow(ArgumentException);
    expect(layout.layout().documents.tabs).toEqual([]);
  });
});
