/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import { ButtonComponent } from "../../../../src/app/components/button/button.component";
import { DialogComponent } from "../../../../src/app/components/dialog/dialog.component";
import { ButtonVariant } from "../../../../src/app/enums/button-variant";
import { DialogSize } from "../../../../src/app/enums/dialog-size";
import { DialogService } from "../../../../src/app/services/dialog.service";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [DialogComponent, ButtonComponent],
  template: `
    <tr-dialog title="Work is still running" (dismissed)="dismissals = dismissals + 1">
      <p class="tr-dialog-probe">TeamRun is still working on the project.</p>
      Wait for it to finish, or stop it now.
      <button tr-button trDialogAction [variant]="secondary" data-cancel>Cancel</button>
      <button tr-button trDialogAction data-wait>Wait, then quit</button>
    </tr-dialog>
  `
})
class DialogHostComponent {
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public dismissals: number = 0;
}

@Component({
  imports: [DialogComponent],
  template: `
    <tr-dialog [title]="title()" [size]="large" (dismissed)="dismissals = dismissals + 1">
      <input class="tr-dialog-field" aria-label="Draft" (keydown.escape)="$event.preventDefault()" />
    </tr-dialog>
  `
})
class LargeDialogHostComponent {
  protected readonly large: DialogSize = DialogSize.Large;

  public readonly title = signal("Notes");

  public dismissals: number = 0;
}

describe("DialogComponent", () => {
  let opener: HTMLButtonElement;
  let reference: { close(): void } | null = null;
  const viewport = { width: window.innerWidth, height: window.innerHeight };

  beforeEach(() => {
    opener = document.createElement("button");
    opener.textContent = "Quit";
    document.body.append(opener);
    opener.focus();
  });

  afterEach(async () => {
    reference?.close();
    reference = null;
    await vi.waitFor(() => expect(document.querySelector("tr-dialog")).toBeNull());
    opener.remove();
    AppearanceFixture.reset();
    await page.viewport(viewport.width, viewport.height);
  });

  async function openAsync(): Promise<DialogRef<unknown, DialogHostComponent>> {
    const opened = TestBed.inject(DialogService).open(DialogHostComponent, "[data-wait]");
    reference = opened;
    await vi.waitFor(() => expect(document.querySelector("tr-dialog")).not.toBeNull());
    return opened;
  }

  async function openLargeAsync(): Promise<DialogRef<unknown, LargeDialogHostComponent>> {
    const opened = TestBed.inject(DialogService).open(LargeDialogHostComponent, ".tr-dialog-close");
    reference = opened;
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("tr-dialog-close")).toBe(true));
    return opened;
  }

  function pixels(value: string, property: "width" | "height"): number {
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.setProperty(property, value);
    document.body.append(probe);
    const resolved = probe.getBoundingClientRect()[property];
    probe.remove();
    return resolved;
  }

  function container(): HTMLElement {
    return document.querySelector("[role=dialog]") as HTMLElement;
  }

  it("is a modal dialog named by its title that focuses the chosen control and keeps focus inside", async () => {
    AppearanceFixture.apply();
    await openAsync();
    const wait = document.querySelector("[data-wait]");
    const cancel = document.querySelector("[data-cancel]");

    await vi.waitFor(() => expect(document.activeElement).toBe(wait));
    await userEvent.tab();
    const afterLast = document.activeElement;
    await userEvent.tab({ shift: true });

    expect(container().getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(container().getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Work is still running");
    expect(afterLast).toBe(cancel);
    expect(document.activeElement).toBe(wait);
  });

  it("says whether a dialog is the topmost one open", async () => {
    const dialogs = TestBed.inject(DialogService);
    const first = await openAsync();
    const second = dialogs.open(DialogHostComponent, "[data-wait]");
    const whileBoth = [dialogs.isTopmost(first), dialogs.isTopmost(second)];
    second.close();

    expect(whileBoth).toEqual([false, true]);
    expect(dialogs.isTopmost(first)).toBe(true);
  });

  it("tells its owner when Escape is pressed, leaves closing to it and returns focus to the opener once closed", async () => {
    AppearanceFixture.apply();
    const opened = await openAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector("[data-wait]")));

    await userEvent.keyboard("{Escape}");
    const isOpenAfterEscape = document.querySelector("tr-dialog") !== null;
    const dismissals = opened.componentInstance?.dismissals;
    opened.close();
    reference = null;

    expect(dismissals).toBe(1);
    expect(isOpenAfterEscape).toBe(true);
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`dims the window behind it and takes its geometry and surface from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await openAsync();
        const dialog = getComputedStyle(document.querySelector("tr-dialog") as HTMLElement);
        const title = getComputedStyle(document.querySelector(".tr-dialog-title") as HTMLElement);
        const body = getComputedStyle(document.querySelector(".tr-dialog-body") as HTMLElement);
        const actions = getComputedStyle(document.querySelector(".tr-dialog-actions") as HTMLElement);

        AppearanceFixture.expectLook(dialog.width, theme, "dialog-width", "width");
        AppearanceFixture.expectLook(dialog.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius", "border-radius");
        AppearanceFixture.expectLook(dialog.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(dialog.boxShadow, theme, "shadow-xlarge", "box-shadow");
        AppearanceFixture.expectLook(title.paddingTop, theme, "dialog-title-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(title.paddingLeft, theme, "dialog-title-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(body.paddingRight, theme, "dialog-body-padding", "padding-right", "padding");
        AppearanceFixture.expectLook(actions.paddingTop, theme, "dialog-actions-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(actions.columnGap, theme, "space-2", "column-gap", "gap");
        AppearanceFixture.expectLook(getComputedStyle(document.querySelector(".tr-dialog-backdrop") as HTMLElement).backgroundColor, theme, "backdrop", "background-color");
        expect(dialog.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "dialog.background"));
        expect(dialog.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "widget.border"));
        expect(title.fontWeight).toBe("600");
      });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`shows its body in the dialog's text color at full opacity from the start and under the pointer, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await openAsync();
        const text = AppearanceFixture.readColor(theme, mode, "foreground");
        const colors = (): string[] => [".tr-dialog-body", ".tr-dialog-probe"].map(t => getComputedStyle(document.querySelector(t) as HTMLElement).color);
        const opened = colors();
        const opacity = getComputedStyle(document.querySelector(".tr-dialog-probe") as HTMLElement).opacity;

        await AppearanceFixture.expectThumbRevealsOnHoverAsync(document.querySelector(".tr-dialog-body") as HTMLElement);

        expect([opened, opacity]).toEqual([[text, text], "1"]);
        expect(colors()).toEqual([text, text]);
      });

  it("keeps a large dialog's long title on one line ending with an ellipsis, and lets a dialog of the default size wrap its title", async () => {
    const title = "Meeting notes for the quarterly planning review, with every decision, owner and follow-up the team agreed on. ".repeat(4).trim();
    AppearanceFixture.apply();
    const large = await openLargeAsync();
    large.componentInstance?.title.set(title);
    await vi.waitFor(() => expect(document.querySelector(".tr-dialog-title")?.textContent).toBe(title));

    AppearanceFixture.expectTruncates(document.querySelector(".tr-dialog-title") as HTMLElement);
    reference?.close();
    await vi.waitFor(() => expect(document.querySelector("tr-dialog")).toBeNull());
    await openAsync();
    const plain = document.querySelector(".tr-dialog-title") as HTMLElement;
    expect([plain.hasAttribute("data-truncates"), getComputedStyle(plain).whiteSpace]).toEqual([false, "normal"]);
  });

  it("gives a large dialog a title bar whose close button asks its owner to close, and leaves Escape to a control that handled it", async () => {
    AppearanceFixture.apply();
    const opened = await openLargeAsync();
    const field = document.querySelector(".tr-dialog-field") as HTMLInputElement;
    const close = page.getByRole("button", { name: "Close" });

    await userEvent.click(close);
    const afterClick = opened.componentInstance?.dismissals;
    field.focus();
    await userEvent.keyboard("{Escape}");
    const afterHandledEscape = opened.componentInstance?.dismissals;
    (document.querySelector(".tr-dialog-close") as HTMLElement).focus();
    await userEvent.keyboard("{Escape}");

    expect(document.getElementById(container().getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Notes");
    expect([afterClick, afterHandledEscape, opened.componentInstance?.dismissals]).toEqual([1, 1, 2]);
    expect(document.querySelector("tr-dialog")?.classList.contains("tr-dialog-large")).toBe(true);
  });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`lays out a large dialog's title bar and a body without padding or actions, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await openLargeAsync();
        const header = getComputedStyle(document.querySelector(".tr-dialog-header") as HTMLElement);
        const title = getComputedStyle(document.querySelector(".tr-dialog-title") as HTMLElement);
        const body = getComputedStyle(document.querySelector(".tr-dialog-body") as HTMLElement);
        const actions = getComputedStyle(document.querySelector(".tr-dialog-actions") as HTMLElement);

        AppearanceFixture.expectLook(header.paddingTop, theme, "dialog-large-header-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(header.paddingRight, theme, "dialog-large-header-padding", "padding-right", "padding");
        AppearanceFixture.expectLook(header.paddingLeft, theme, "dialog-large-header-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(header.borderBottomWidth, theme, "border-width", "border-bottom-width");
        expect(header.borderBottomColor).toBe(AppearanceFixture.readColor(theme, mode, "widget.border"));
        expect([title.paddingTop, title.paddingLeft]).toEqual(["0px", "0px"]);
        expect([body.paddingTop, body.paddingRight, body.paddingBottom, body.paddingLeft, body.display]).toEqual(["0px", "0px", "0px", "0px", "flex"]);
        expect(actions.display).toBe("none");
      });

  for (const theme of AppearanceFixture.themes)
    for (const [width, height] of [[1280, 800], [640, 400], [320, 200]] as const)
      it(`sizes a large dialog to its share of a ${width} by ${height} window with its minimum yielding to the window, with the ${theme.id} theme`, async () => {
        await page.viewport(width, height);
        AppearanceFixture.apply(theme);
        await openLargeAsync();
        const rectangle = (document.querySelector("tr-dialog") as HTMLElement).getBoundingClientRect();
        const share = (name: string, property: "width" | "height"): number => pixels(theme.readLook(name) ?? String.empty, property);
        const gap = share("space-2", "width");
        const widest = width - gap * 2;
        const tallest = height - share("window-row-height", "height") - share("status-bar-height", "height") - gap * 2;

        AppearanceFixture.expectPixels(rectangle.width, Math.min(Math.max(share("dialog-large-width", "width"), share("dialog-large-min-width", "width")), widest));
        AppearanceFixture.expectPixels(rectangle.height, Math.min(Math.max(share("dialog-large-height", "height"), share("dialog-large-min-height", "height")), tallest));
        expect(rectangle.left).toBeGreaterThanOrEqual(gap - 1);
        expect(rectangle.top).toBeGreaterThanOrEqual(0);
      });
});
