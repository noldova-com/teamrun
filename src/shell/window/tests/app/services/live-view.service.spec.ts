/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, ChangeDetectionStrategy, Component, DestroyRef, type WritableSignal, inject, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { TabContentComponent } from "../../../src/app/components/tab-content/tab-content.component";
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import type { Tab } from "../../../src/app/models/layout/tab";
import { LayoutService } from "../../../src/app/services/layout.service";
import { LiveViewService } from "../../../src/app/services/live-view.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../fixtures/window-part-host.fixture";

@Component({
  selector: "tr-test-page",
  template: "<textarea></textarea><p class=\"text\">{{ read() }}</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPageComponent {
  public static readonly text: WritableSignal<string> = signal("first");
  public static reads: number = 0;
  public static destroyed: number = 0;

  public constructor() {
    inject(DestroyRef).onDestroy(() => TestPageComponent.destroyed++);
  }

  protected read(): string {
    TestPageComponent.reads++;
    return TestPageComponent.text();
  }
}

describe("LiveViewService", () => {
  const { plan, todo } = LayoutFixture;
  const notes = Array.from({ length: 10 }, (_, index) => new DocumentTab("notes.note", `${index + 1}`));
  let host: WindowPartHostFixture;
  let views: LiveViewService;
  let application: ApplicationRef;
  let slots: HTMLElement[];

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    host = new WindowPartHostFixture();
    for (const tab of [plan, todo, ...notes])
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, [plan, todo, ...notes].reduce((layout, tab) => layout.openDocument(tab), Layout.createDefault(registry)));
    views = TestBed.inject(LiveViewService);
    application = TestBed.inject(ApplicationRef);
    slots = Array.from({ length: notes.length }, () => document.createElement("div"));
    document.body.append(...slots);
    TestPageComponent.text.set("first");
    TestPageComponent.reads = 0;
    TestPageComponent.destroyed = 0;
  });

  afterEach(() => {
    for (const slot of slots)
      slot.remove();
    DesktopBridgeFixture.remove();
  });

  function slot(index: number): HTMLElement {
    return slots[index] as HTMLElement;
  }

  async function showAsync(tab: Tab, index: number, isDocked: boolean = false): Promise<TabContentComponent> {
    const content = views.show(tab, slot(index), isDocked);
    await application.whenStable();
    return content;
  }

  function textOf(content: TabContentComponent): string | undefined {
    return content.element.querySelector(".text")?.textContent;
  }

  it("creates one view for a tab and moves it between slots, keeping what was typed", async () => {
    const first = await showAsync(plan, 0);
    const field = first.element.querySelector("textarea") as HTMLTextAreaElement;
    field.value = "draft";

    const second = await showAsync(plan, 1);

    expect(second).toBe(first);
    expect([slot(0).children.length, first.element.parentElement, field.value, textOf(first)]).toEqual([0, slot(1), "draft", "first"]);
    expect(TestPageComponent.destroyed).toBe(0);
  });

  it("keeps a view in its slot when it is shown there again and tells it whether it is docked", async () => {
    const content = await showAsync(plan, 0);

    const again = await showAsync(plan, 0, true);

    expect(again).toBe(content);
    expect([content.isDocked(), content.isShown(), content.element.parentElement]).toEqual([true, true, slot(0)]);
  });

  it("hides a view without destroying it, tells it that it is hidden and shows it again as it was", async () => {
    const content = await showAsync(plan, 0);
    (content.element.querySelector("textarea") as HTMLTextAreaElement).value = "draft";

    views.hide(plan, slot(0));
    const hidden = [content.element.isConnected, content.isShown(), TestPageComponent.destroyed];
    const shown = await showAsync(plan, 0);

    expect(hidden).toEqual([false, false, 0]);
    expect(shown).toBe(content);
    expect([content.isShown(), (content.element.querySelector("textarea") as HTMLTextAreaElement).value]).toEqual([true, "draft"]);
  });

  it("costs no change detection while ten views are hidden, even when what they show changes", async () => {
    const before = application.viewCount;
    const contents: TabContentComponent[] = [];
    for (const [index, tab] of notes.entries())
      contents.push(await showAsync(tab, index));
    const whileShown = application.viewCount;
    for (const [index, tab] of notes.entries())
      views.hide(tab, slot(index));
    TestPageComponent.reads = 0;

    TestPageComponent.text.set("second");
    for (let pass = 0; pass < 5; pass++)
      application.tick();
    await application.whenStable();

    expect([whileShown - before, application.viewCount - before]).toEqual([notes.length, 0]);
    expect(TestPageComponent.reads).toBe(0);
    expect(new Set(contents.map(textOf))).toEqual(new Set(["first"]));
  });

  it("renders at once a change made while a view was hidden when the view is shown again", async () => {
    const content = await showAsync(plan, 0);
    views.hide(plan, slot(0));
    TestPageComponent.text.set("second");
    application.tick();
    const whileHidden = textOf(content);

    views.show(plan, slot(0), false);
    application.tick();

    expect([whileHidden, textOf(content)]).toEqual(["first", "second"]);
  });

  it("destroys a hidden view once its tab closes, and a shown one once its slot lets it go", async () => {
    const layout = TestBed.inject(LayoutService);
    const planned = await showAsync(plan, 0);
    await showAsync(todo, 1);
    views.hide(plan, slot(0));

    layout.close(plan);
    await application.whenStable();
    const afterHidden = TestPageComponent.destroyed;
    layout.close(todo);
    await application.whenStable();
    const afterShown = TestPageComponent.destroyed;
    views.hide(todo, slot(1));
    const reopened = await showAsync(plan, 0);

    expect([afterHidden, afterShown, TestPageComponent.destroyed]).toEqual([1, 1, 2]);
    expect(reopened).not.toBe(planned);
  });

  it("destroys the views a test owns, shown or hidden, and tells the slots once", async () => {
    const before = views.destroyed();
    await showAsync(plan, 0);
    await showAsync(todo, 1);
    views.hide(todo, slot(1));

    views.destroy(t => t.name === "notes.note");
    const destroyed = views.destroyed();
    views.destroy(() => false);

    expect([destroyed - before, views.destroyed() - before, TestPageComponent.destroyed, slot(0).children.length]).toEqual([1, 1, 2, 0]);
  });

  it("ignores hiding a tab from a slot that doesn't show it, or a tab without a view", async () => {
    const content = await showAsync(plan, 0);

    views.hide(plan, slot(1));
    views.hide(todo, slot(0));

    expect([content.element.parentElement, content.isShown(), TestPageComponent.destroyed]).toEqual([slot(0), true, 0]);
  });

  it("destroys every view when the window goes", async () => {
    await showAsync(plan, 0);
    await showAsync(todo, 1);
    views.hide(todo, slot(1));

    TestBed.resetTestingModule();

    expect([TestPageComponent.destroyed, slot(0).children.length]).toEqual([2, 0]);
  });
});
