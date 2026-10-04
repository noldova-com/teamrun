/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { Layout } from "../../../src/app/models/layout/layout";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { ViewStateService } from "../../../src/app/services/view-state.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";

class PageState {
  public readonly page: string;

  public constructor(page: string) {
    this.page = page;
  }
}

class OtherState {}

describe("ViewStateService", () => {
  const registry = LayoutFixture.createRegistry();
  const settings = LayoutFixture.settings.key;
  let layout: LayoutService;
  let views: ViewStateService;

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.settings).openDocument(LayoutFixture.plan));
    views = TestBed.inject(ViewStateService);
    TestBed.tick();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("gives back the latest state kept for a tab's key, only as the type asked for", () => {
    const later = new PageState("Clock");

    views.keep(settings, new PageState("Keyboard shortcuts"));
    views.keep(settings, later);

    expect([views.find(settings, PageState), views.find(settings, OtherState), views.find(LayoutFixture.plan.key, PageState)]).toEqual([later, null, null]);
  });

  it("keeps a tab's state while the tab moves to another group, and drops it once the tab closes", () => {
    const state = new PageState("Clock");
    views.keep(settings, state);
    views.keep(LayoutFixture.plan.key, new PageState("Notes"));

    layout.place(LayoutFixture.settings, new SplitDropTarget(layout.layout().groupOf(LayoutFixture.settings)?.id ?? -1, PanelEdge.Right));
    TestBed.tick();
    const moved = views.find(settings, PageState);
    layout.close(LayoutFixture.settings);
    TestBed.tick();
    layout.openDocument(LayoutFixture.settings);
    TestBed.tick();

    expect([moved, views.find(settings, PageState), views.find(LayoutFixture.plan.key, PageState)]).toEqual([state, null, new PageState("Notes")]);
  });
});
