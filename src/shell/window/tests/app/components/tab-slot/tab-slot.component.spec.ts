/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { TabSlotComponent } from "../../../../src/app/components/tab-slot/tab-slot.component";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { LiveViewService } from "../../../../src/app/services/live-view.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

@Component({
  selector: "tr-test-page",
  template: "<textarea></textarea>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPageComponent {
}

@Component({
  imports: [TabSlotComponent],
  template: "@if (isShown()) { <tr-tab-slot [tab]=\"tab()\" [isDocked]=\"isDocked()\" /> }",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  public readonly tab: WritableSignal<Tab> = signal(LayoutFixture.plan);
  public readonly isDocked: WritableSignal<boolean> = signal(false);
  public readonly isShown: WritableSignal<boolean> = signal(true);
  public readonly slot: Signal<TabSlotComponent | undefined> = viewChild(TabSlotComponent);
}

describe("TabSlotComponent", () => {
  const { plan, todo } = LayoutFixture;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    const host = new WindowPartHostFixture();
    for (const tab of [plan, todo])
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo));
    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function slotElement(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector("tr-tab-slot");
  }

  it("shows its tab's view and tells it whether it is docked", async () => {
    const content = fixture.componentInstance.slot()?.content();

    fixture.componentInstance.isDocked.set(true);
    await fixture.whenStable();

    expect(content?.element.parentElement).toBe(slotElement());
    expect(content?.element.querySelector("textarea")).not.toBeNull();
    expect(content?.isDocked()).toBe(true);
  });

  it("hides the view of the tab it showed before and shows it again as it was when that tab comes back", async () => {
    const planned = fixture.componentInstance.slot()?.content();
    (planned?.element.querySelector("textarea") as HTMLTextAreaElement).value = "draft";

    fixture.componentInstance.tab.set(todo);
    await fixture.whenStable();
    const other = fixture.componentInstance.slot()?.content();
    const whileOther = [planned?.element.isConnected, other?.element.parentElement];
    fixture.componentInstance.tab.set(plan);
    await fixture.whenStable();

    expect(whileOther).toEqual([false, slotElement()]);
    expect(fixture.componentInstance.slot()?.content()).toBe(planned);
    expect((planned?.element.querySelector("textarea") as HTMLTextAreaElement).value).toBe("draft");
  });

  it("shows a new view once its tab's view is destroyed", async () => {
    const planned = fixture.componentInstance.slot()?.content();

    TestBed.inject(LiveViewService).destroy(t => t.equals(plan));
    await fixture.whenStable();
    const replaced = fixture.componentInstance.slot()?.content();

    expect(replaced).not.toBe(planned);
    expect(replaced?.element.parentElement).toBe(slotElement());
  });

  it("hides its view when it goes and keeps the view for the next slot", async () => {
    const planned = fixture.componentInstance.slot()?.content();

    fixture.componentInstance.isShown.set(false);
    await fixture.whenStable();
    const hidden = [planned?.element.isConnected, planned?.isShown()];
    fixture.componentInstance.isShown.set(true);
    await fixture.whenStable();

    expect(hidden).toEqual([false, false]);
    expect(fixture.componentInstance.slot()?.content()).toBe(planned);
  });

  it("lets nothing go when it goes before it has shown a view", () => {
    const early = TestBed.createComponent(TabSlotComponent);
    early.componentRef.setInput("tab", todo);

    early.destroy();

    expect(early.componentInstance.content()).toBeNull();
  });
});
