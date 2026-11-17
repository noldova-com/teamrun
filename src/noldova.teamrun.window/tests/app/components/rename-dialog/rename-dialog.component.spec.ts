/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { DialogTokens, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { RenameDialogComponent } from "../../../../src/app/components/rename-dialog/rename-dialog.component";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";

describe("RenameDialogComponent", () => {
  let fixture: ComponentFixture<RenameDialogComponent>;
  let answers: (string | null)[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const field = (): HTMLInputElement | null => element().querySelector<HTMLInputElement>(".nol-teamrun-rename-title");
  const save = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>(".nol-teamrun-save");
  const type = (text: string): void => {
    const input = field();
    if (Object.isNull(input))
      throw new Error("The rename dialog shows no title field.");
    input.value = text;
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    fixture = TestBed.createComponent(RenameDialogComponent);
    fixture.componentRef.setInput("initialTitle", "First");
    answers = [];
    fixture.componentInstance.answered.subscribe(t => answers.push(t));
    fixture.detectChanges();
  });

  it("starts from the conversation's title, named for assistive technology", () => {
    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.renameTitle);
    expect(field()?.value).toBe("First");
    expect(field()?.getAttribute("aria-label")).toBe(Resources.renameFieldLabel);
    expect(save()?.disabled).toBe(false);
  });

  it("saves the trimmed title from Save and from Enter in the field", () => {
    type("  Second  ");
    save()?.click();
    type("Third");
    field()?.form?.requestSubmit();

    expect(answers).toEqual(["Second", "Third"]);
  });

  it("refuses a blank title", () => {
    type("   ");

    expect(save()?.disabled).toBe(true);
    field()?.form?.requestSubmit();
    expect(answers).toEqual([]);
  });

  it("keeps its title when an input event comes from something other than the field", () => {
    fixture.debugElement.query(By.css(".nol-teamrun-rename-title")).triggerEventHandler("input", { target: document.createElement("div") });
    save()?.click();

    expect(answers).toEqual(["First"]);
  });

  it("answers nothing from Close and from Escape", () => {
    const close = element().querySelector<HTMLButtonElement>(".nol-teamrun-cancel");

    expect(close?.textContent?.trim()).toBe(Resources.closeLabel);
    close?.click();
    element().querySelector("nol-dialog")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(answers).toEqual([null, null]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("puts Close as a text button before Save, half a rem apart, with Save at the end of the actions", () => {
      DialogActionsFixture.expectCloseThenPrimary(element(), ".nol-teamrun-save");
    });

    it("spans the field across the body's content, from the title's start to the body's content end", () => {
      const title = element().querySelector<HTMLElement>(".nol-dialog-title")!;
      const body = element().querySelector<HTMLElement>(".nol-dialog-body")!;
      const input = field()!.getBoundingClientRect();

      AppearanceFixture.expectPixels(input.left, title.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(title).paddingLeft));
      AppearanceFixture.expectPixels(input.right, body.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(body).paddingRight));
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the rename dialog visible under forced colours", async () => {
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the rename dialog at 200% zoom", async () => {
      await AccessibilityFixture.expectFitsZoomedAsync(element(), async () => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await fixture.whenStable();
      });
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the rename dialog by keyboard, with a visible ring", async () => {
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the rename dialog", () => {
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
