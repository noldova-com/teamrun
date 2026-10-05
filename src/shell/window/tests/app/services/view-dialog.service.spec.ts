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
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { LayoutService } from "../../../src/app/services/layout.service";
import { StartupService } from "../../../src/app/services/startup.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { Resources } from "../../../src/resources";
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
  let bridge: DesktopBridgeFixture;

  beforeEach(async () => {
    bridge = DesktopBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(search.key, new ContributionMatch(() => Promise.resolve(TestSearchComponent), null, ContentPadding.Default));
    for (const note of [new DocumentTab(plan.name, "draft"), plan, LayoutFixture.todo, LayoutFixture.settings])
      host.contributions.set(note.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
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

  it("lets its view's module run its commands while it is the topmost dialog, but not another module's, the shell's for its own document, or any under another dialog", async () => {
    const before = dialogs.ownsCommand("files.find");
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("tr-test-query")).toBe(true));
    const whileShown = ["files.find", "notes.newNote", "shell.closeTab"].map(t => dialogs.ownsCommand(t));
    const other = TestBed.inject(DialogService).open(TestSearchComponent, ".tr-test-query");
    const underAnother = dialogs.ownsCommand("files.find");
    other.close();
    dialogs.close();
    await shown;
    const settings = dialogs.showAsync(LayoutFixture.settings);
    await vi.waitFor(() => expect(container()).not.toBeNull());
    const forShellDocument = dialogs.ownsCommand("shell.closeTab");
    dialogs.close();
    await settings;

    expect([before, ...whileShown, underAnother, forShellDocument]).toEqual([false, true, false, false, false, false]);
  });

  it("refuses a view while another dialog is open", async () => {
    const other = TestBed.inject(DialogService).open(TestSearchComponent, ".tr-test-query");

    const isShowable = dialogs.canShow(search);
    await expect(dialogs.showAsync(search)).rejects.toThrowError(ViewDialogException);
    other.close();

    expect([isShowable, dialogs.canShow(search)]).toEqual([false, true]);
  });

  it("closes while the runtime starts again and shows none until it is ready", async () => {
    const startup = TestBed.inject(StartupService);
    await vi.waitFor(() => expect(startup.hasStarted()).toBe(true));
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-search")).not.toBeNull());

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await shown;
    const isShowable = dialogs.canShow(search);
    await expect(dialogs.showAsync(search)).rejects.toThrowError(new ViewDialogException(Resources.dialogWhileReconnecting));
    bridge.publishStartup({ kind: "Ready", details: [] });

    expect([isShowable, dialogs.canShow(search), container()]).toEqual([false, true, null]);
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

    layout.openDocument(plan);
    layout.openDocument(LayoutFixture.todo);
    void dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());
    layout.close(LayoutFixture.todo);
    TestBed.tick();

    expect([layout.layout().isOpen(LayoutFixture.todo), layout.layout().isOpen(plan), dialogs.shown()?.key]).toEqual([false, true, plan.key]);
  });

  it("closes when a document is opened or activated from it, and focuses that document's tab", async () => {
    const layout = TestBed.inject(LayoutService);
    const tabElements = [LayoutFixture.todo, plan].map(t => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = t.key;
      document.body.append(element);
      return element;
    });
    const opened = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-search")).not.toBeNull());
    layout.openDocument(LayoutFixture.todo);
    TestBed.tick();
    await opened;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElements[0]));
    const isTodoActive = layout.layout().groupOf(LayoutFixture.todo)?.active?.equals(LayoutFixture.todo);

    const activated = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-search")).not.toBeNull());
    layout.activate(plan);
    TestBed.tick();
    await activated;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElements[1]));
    tabElements.forEach(t => t.remove());

    expect([isTodoActive, dialogs.shown()]).toEqual([true, null]);
  });

  it("stays open for its own document, a view, a document that is not open and one revealed before it showed", async () => {
    const layout = TestBed.inject(LayoutService);
    layout.openDocument(LayoutFixture.todo);
    void dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-note")).not.toBeNull());

    TestBed.tick();
    const shownAfter = [plan, LayoutFixture.files, new DocumentTab("notes.note", "gone")].map(t => {
      layout.activate(t);
      TestBed.tick();
      return dialogs.shown()?.key;
    });

    expect(shownAfter).toEqual([plan.key, plan.key, plan.key]);
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
