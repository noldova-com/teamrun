/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { CommandRow } from "../../../src/app/models/command-row";
import { Layout } from "../../../src/app/models/layout/layout";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import type { MenuSection } from "../../../src/app/models/menu-section";
import { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { TabDestinationsService } from "../../../src/app/services/tab-destinations.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("TabDestinationsService", () => {
  const { files, search, changes, plan, todo } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(search, registry).openDocument(plan).openDocument(todo, true);
  let menus: MenuService;

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    await LayoutServiceFixture.prepareAsync(registry, prepared);
    TestBed.inject(TabDestinationsService);
    menus = TestBed.inject(MenuService);
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function rows(sections: readonly MenuSection[]): readonly (readonly string[])[] {
    return sections.map(t => t.rows.map(u => `${u.title}${u instanceof CommandRow && !u.isEnabled ? " (disabled)" : ""}`));
  }

  function menuOf(key: string, place: string = Resources.tabMenu): readonly (readonly string[])[] {
    return rows(menus.resolve(place, { [Resources.tabArgument]: key }));
  }

  it("offers a view's tab every other group that accepts it, named by its views or as the documents, and nothing for a document while it has no other documents group, or for an unknown tab", () => {
    expect(menuOf(search.key, Resources.tabMoveToMenu)).toEqual([[changes.name, Resources.documentsGroupLabel]]);
    expect(menuOf(changes.key, Resources.tabMoveToMenu)).toEqual([[`${files.name}${Resources.groupLabelJoiner}${search.name}`, Resources.documentsGroupLabel]]);
    expect([menuOf(plan.key, Resources.tabMoveToMenu), menuOf("missing", Resources.tabMoveToMenu)]).toEqual([[], []]);
  });

  it("offers a document every other documents group, numbered once there are several", () => {
    const layout = TestBed.inject(LayoutService);
    layout.place(todo, new SplitDropTarget(0, PanelEdge.Right));

    expect([menuOf(plan.key, Resources.tabMoveToMenu), menuOf(todo.key, Resources.tabMoveToMenu), menuOf(search.key, Resources.tabMoveToMenu)]).toEqual([
      [[Resources.formatDocumentsGroup(2)]],
      [[Resources.formatDocumentsGroup(1)]],
      [[changes.name, Resources.formatDocumentsGroup(1), Resources.formatDocumentsGroup(2)]]
    ]);
  });

  it("builds the tab menu from the shell's groups, leaving out what can never apply to the tab and disabling what can't run now", () => {
    expect(menuOf(search.key)).toEqual([
      [
        Resources.moveToLabel, Resources.splitLabel, Resources.dockLabel, Resources.moveEarlierLabel, `${Resources.moveLaterLabel} (disabled)`, Resources.moveToNextGroupLabel,
        Resources.moveToPreviousGroupLabel
      ],
      [Resources.closeTabLabel, Resources.closeOthersLabel, `${Resources.closeToTheRightLabel} (disabled)`, Resources.closeAllLabel]
    ]);
    expect(menuOf(todo.key)).toEqual([
      [Resources.keepLabel, Resources.splitLabel, Resources.moveEarlierLabel, `${Resources.moveLaterLabel} (disabled)`],
      [Resources.closeTabLabel, Resources.closeOthersLabel, `${Resources.closeToTheRightLabel} (disabled)`, Resources.closeAllLabel]
    ]);
    expect(menuOf(changes.key, Resources.tabSplitMenu)).toEqual([Object.values(Resources.splitLabels).map(t => `${t} (disabled)`)]);
    expect(menuOf(changes.key, Resources.tabDockMenu)).toEqual([Object.values(Resources.dockLabels)]);
  });
});
