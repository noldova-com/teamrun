/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, type WritableSignal, inject, input, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/teamrun-shell-protocol";

import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { TabContentComponent } from "../../../../src/app/components/tab-content/tab-content.component";
import type { IWindowPartContext } from "../../../../src/app/interfaces/i-window-part-context";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";

@Component({
  selector: "tr-test-view",
  template: "<p class=\"view\">notes</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestViewComponent {
  public static contexts: IWindowPartContext[] = [];

  public constructor() {
    TestViewComponent.contexts.push(inject(WindowPartTokens.context));
  }
}

@Component({
  selector: "tr-test-document",
  template: "<p class=\"document\">{{ instance() }}: {{ title() }}</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestDocumentComponent {
  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();
}

@Component({
  selector: "tr-test-shell-document",
  template: "<p class=\"shell-document\">settings</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestShellDocumentComponent {
  public static contexts: (IWindowPartContext | null)[] = [];

  public constructor() {
    TestShellDocumentComponent.contexts.push(inject(WindowPartTokens.context, { optional: true }));
  }
}

class StubWindowPartHost {
  public readonly generation: WritableSignal<number> = signal(0);
  public readonly contributions: Map<string, ContributionMatch> = new Map();
  public readonly failures: Map<string, ModuleFailure> = new Map();

  public findContribution(tab: Tab): ContributionMatch | null {
    return this.contributions.get(tab.key) ?? null;
  }

  public findFailure(tab: Tab): ModuleFailure | null {
    return this.failures.get(tab.key) ?? null;
  }
}

describe("TabContentComponent", () => {
  const context = new WindowPartContext(new WindowPartSource("notes", "Notes", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused"))), {
    requestAsync: () => Promise.resolve(null),
    onEvent: () => () => undefined,
    openDocument: () => undefined,
    keepDocument: () => undefined,
    isCommandRegistered: () => false,
    runCommandAsync: () => Promise.resolve(null),
    postNotificationAsync: () => Promise.resolve(1),
    updateNotificationAsync: () => Promise.resolve(),
    dismissNotification: () => undefined,
    readSetting: () => undefined,
    writeSettingAsync: () => Promise.resolve(),
    resetSettingAsync: () => Promise.resolve(),
    onSettingChanged: () => () => undefined,
    declaresDynamicMenuGroup: () => false,
    provideMenuGroup: () => () => undefined,
    refresh: () => undefined
  });
  let host: StubWindowPartHost;

  beforeEach(() => {
    host = new StubWindowPartHost();
    TestViewComponent.contexts = [];
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
  });

  async function renderAsync(tab: Tab): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it("shows a view with its module's context", async () => {
    const tab = new ViewTab("notes.list");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context));

    const element = await renderAsync(tab);

    expect(element.querySelector(".view")?.textContent).toBe("notes");
    expect(TestViewComponent.contexts).toEqual([context]);
  });

  it("shows a document with its instance and title", async () => {
    const tab = new DocumentTab("notes.note", "1");
    TestBed.inject(TabLabelService).setTitle(tab, "Note 1");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestDocumentComponent), context));

    const element = await renderAsync(tab);

    expect(element.querySelector(".document")?.textContent).toBe("1: Note 1");
  });

  it("shows a shell document without a part's context or inputs", async () => {
    const tab = new DocumentTab("shell.settings");
    TestShellDocumentComponent.contexts = [];
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestShellDocumentComponent), null));

    const element = await renderAsync(tab);

    expect(element.querySelector(".shell-document")?.textContent).toBe("settings");
    expect(TestShellDocumentComponent.contexts).toEqual([null]);
  });

  it("shows why a failed module's view is empty", async () => {
    const tab = new ViewTab("clock.face");
    host.failures.set(tab.key, new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]));

    const element = await renderAsync(tab);

    expect(element.querySelector("tr-module-failure-card")?.textContent).toMatch(/Clock didn't start\s*Its runtime part failed to activate\./);
  });

  it("shows nothing for a tab no module contributes and loads again when the parts change", async () => {
    const tab = new ViewTab("notes.list");
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const isEmpty = element.querySelector(".tr-tab-content-text")?.children.length === 0;

    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context));
    host.generation.set(1);
    await fixture.whenStable();

    expect(isEmpty).toBe(true);
    expect(element.querySelector(".view")?.textContent).toBe("notes");
  });

  it("scrolls with a stable gutter and a hover-revealed thumb while its content keeps the text color", async () => {
    AppearanceFixture.apply();
    try {
      const tab = new ViewTab("notes.list");
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context));
      const fixture = TestBed.createComponent(TabContentComponent);
      fixture.componentRef.setInput("tab", tab);
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const view = element.querySelector(".view") ?? element;
      const probe = document.createElement("div");
      probe.style.color = "var(--tr-text)";
      document.body.append(probe);
      const text = getComputedStyle(probe).color;
      probe.remove();

      expect(element.classList.contains("tr-scroll-reveal")).toBe(true);
      expect(getComputedStyle(element).scrollbarGutter).toBe("stable");
      expect(getComputedStyle(element).color).toBe("rgba(0, 0, 0, 0)");
      expect(getComputedStyle(view).color).toBe(text);
      expect(text).not.toBe("rgba(0, 0, 0, 0)");
    }
    finally {
      AppearanceFixture.reset();
    }
  });
});
