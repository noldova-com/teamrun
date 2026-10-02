/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { DocumentGroup } from "../../../../src/app/models/layout/document-group";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import type { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("DocumentGroup", () => {
  const { files, plan, todo, settings } = LayoutFixture;
  const group: TabGroup = new DocumentGroup([plan, files, todo], todo);

  it("is the group with id 0 that may be empty and holds documents and views", () => {
    expect([group.id, group.isDocuments, group.tabs, group.active]).toEqual([0, true, [plan, files, todo], todo]);
    expect([DocumentGroup.createEmpty().tabs, DocumentGroup.createEmpty().active]).toEqual([[], null]);
    expect([group.accepts(plan), group.accepts(files)]).toEqual([true, true]);
  });

  it("keeps the document area's minimum on both axes", () => {
    expect([group.minimumLength(SplitAxis.Horizontal), group.minimumLength(SplitAxis.Vertical)]).toEqual([13.75, 13.75]);
  });

  it("stays as an empty group when its last tab leaves or none is registered", () => {
    expect(new DocumentGroup([plan], plan).without(plan)).toEqual(DocumentGroup.createEmpty());
    expect(group.withVisibleTabs(ViewRegistry.createEmpty())).toEqual(DocumentGroup.createEmpty());
    expect(group.without(todo)).toEqual(new DocumentGroup([plan, files], files));
    expect(group.insert(settings, 0)).toEqual(new DocumentGroup([settings, plan, files, todo], settings));
    expect(group.withVisibleTabs(LayoutFixture.createRegistry())).toBe(group);
    expect(new DocumentGroup([new DocumentTab("gone.document"), plan], plan).withVisibleTabs(LayoutFixture.createRegistry()))
      .toEqual(new DocumentGroup([plan], plan));
  });

  it("marks itself as the documents group when written", () => {
    expect(new DocumentGroup([settings], settings).toJson()).toEqual({ tabs: [{ document: "shell.settings" }], active: 0, documents: true });
    expect(DocumentGroup.createEmpty().toJson()).toEqual({ tabs: [], active: null, documents: true });
  });
});
