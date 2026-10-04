/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { DialogService } from "@noldova/teamrun-shell-ui";

import { AppearanceFixture } from "../../../../ui/tests/fixtures/appearance.fixture";
import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../fixtures/window-part-host.fixture";

@Component({
  selector: "tr-test-search",
  template: `
    <p class="tr-test-search">Search</p>
    <input class="tr-test-query" aria-label="Query" (keydown.escape)="$event.preventDefault()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestSearchComponent {
}

@Component({
  selector: "tr-test-note",
  template: "<p class=\"tr-test-note\">Plan</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestNoteComponent {
}

describe("ViewDialogService", () => {
  const { search, plan } = LayoutFixture;
  let opener: HTMLButtonElement;
  let dialogs: ViewDialogService;

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(search.key, new ContributionMatch(() => Promise.resolve(TestSearchComponent), null));
    for (const note of [new DocumentTab(plan.name, "draft"), plan, LayoutFixture.todo])
      host.contributions.set(note.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan));
    TestBed.inject(TabLabelService).register(search.name, new TabLabel("Search", "search"));
    dialogs = TestBed.inject(ViewDialogService);
    opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.append(opener);
    opener.focus();
    AppearanceFixture.apply();
  });

  afterEach(async () => {
    dialogs.close();
    await vi.waitFor(() => expect(document.querySelector("tr-view-dialog")).toBeNull());
    opener.remove();
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function container(): HTMLElement {
    return document.querySelector("[role=dialog]") as HTMLElement;
  }

  it("shows a registered view in a large modal dialog named by its label, focuses its first control and resolves once closed", async () => {
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("tr-test-query")).toBe(true));
    const title = document.getElementById(container().getAttribute("aria-labelledby") ?? "")?.textContent;
    const isLarge = document.querySelector("tr-dialog")?.classList.contains("tr-dialog-large");
    const shownTab = dialogs.shown();

    dialogs.close();
    await shown;

    expect([container(), title, isLarge, shownTab?.key, dialogs.shown()]).toEqual([null, "Search", true, search.key, null]);
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("shows a document under the given title", async () => {
    void dialogs.showAsync(new DocumentTab(plan.name, "draft"), "Draft plan");
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());

    expect(document.getElementById(container().getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Draft plan");
  });

  it("refuses a second view while one is shown, and a view or document that is not registered", async () => {
    void dialogs.showAsync(search);

    await expect(dialogs.showAsync(plan)).rejects.toThrowError(new ViewDialogException("A dialog is already open."));
    dialogs.close();
    await expect(dialogs.showAsync(new ViewTab("files.missing"))).rejects.toThrowError(new ArgumentException("No view named \"files.missing\" is registered.", "tab"));
    await expect(dialogs.showAsync(new DocumentTab("notes.page", "1"))).rejects.toThrowError(ArgumentException);
    expect([dialogs.canShow(search), dialogs.shown()]).toEqual([true, null]);
  });

  it("refuses a view while another dialog is open", async () => {
    const other = TestBed.inject(DialogService).open(TestSearchComponent, ".tr-test-query");

    const isShowable = dialogs.canShow(search);
    await expect(dialogs.showAsync(search)).rejects.toThrowError(ViewDialogException);
    other.close();

    expect([isShowable, dialogs.canShow(search)]).toEqual([false, true]);
  });

  it("closes when its view's module goes away, or when the tab it came from is closed, but not when a tab it didn't come from closes", async () => {
    const layout = TestBed.inject(LayoutService);
    const registry = layout.registry();
    const fromRegistry = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-search")).not.toBeNull());
    layout.setRegistry(new ViewRegistry([], ["notes.note"]));
    await fromRegistry;
    layout.setRegistry(registry);

    const fromTab = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());
    layout.close(plan);
    await fromTab;

    void dialogs.showAsync(LayoutFixture.todo);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());
    layout.close(LayoutFixture.todo);
    TestBed.tick();

    expect(dialogs.shown()?.key).toBe(LayoutFixture.todo.key);
  });

  it("focuses the tab it came from when the control that opened it is gone, and leaves focus where it returned otherwise", async () => {
    const tabElement = document.createElement("button");
    tabElement.dataset["tabKey"] = plan.key;
    document.body.append(tabElement);
    const shown = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());
    opener.remove();
    dialogs.close();
    await shown;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElement));

    document.body.append(opener);
    opener.focus();
    const again = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());
    dialogs.close();
    await again;
    TestBed.tick();
    tabElement.remove();

    expect(document.activeElement).toBe(opener);
  });

  it("closes on Escape or the close button but leaves Escape to the view when the view handled it, and the window behind doesn't respond", async () => {
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("tr-test-query")).toBe(true));
    let clicks = 0;
    opener.addEventListener("click", () => clicks++);

    await userEvent.keyboard("{Escape}");
    const isOpenAfterHandledEscape = !Object.isNull(dialogs.shown());
    await userEvent.click(document.querySelector(".cdk-overlay-backdrop") as HTMLElement, { position: { x: 4, y: 4 } });
    const isOpenAfterBackdrop = !Object.isNull(dialogs.shown());
    (document.querySelector(".tr-dialog-close") as HTMLElement).focus();
    await userEvent.keyboard("{Escape}");
    await shown;

    void dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-search")).not.toBeNull());
    await userEvent.click(page.getByRole("button", { name: "Close" }));

    expect([isOpenAfterHandledEscape, isOpenAfterBackdrop, clicks, dialogs.shown()]).toEqual([true, true, 0, null]);
  });
});
