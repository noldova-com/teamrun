/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { ButtonComponent } from "../../../../src/app/components/button/button.component";
import { DialogComponent } from "../../../../src/app/components/dialog/dialog.component";
import { ButtonVariant } from "../../../../src/app/enums/button-variant";
import { DialogService } from "../../../../src/app/services/dialog.service";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [DialogComponent, ButtonComponent],
  template: `
    <tr-dialog title="Work is still running" (dismissed)="dismissals = dismissals + 1">
      <p class="tr-dialog-probe">TeamRun is still working on the project.</p>
      <button tr-button trDialogAction [variant]="secondary" data-cancel>Cancel</button>
      <button tr-button trDialogAction data-wait>Wait, then quit</button>
    </tr-dialog>
  `
})
class DialogHostComponent {
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public dismissals: number = 0;
}

describe("DialogComponent", () => {
  let opener: HTMLButtonElement;
  let reference: DialogRef<unknown, DialogHostComponent> | null = null;

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
  });

  async function openAsync(): Promise<DialogRef<unknown, DialogHostComponent>> {
    reference = TestBed.inject(DialogService).open(DialogHostComponent, "[data-wait]");
    await vi.waitFor(() => expect(document.querySelector("tr-dialog")).not.toBeNull());
    return reference;
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
});
