/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogService, DialogTokens, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ConfirmDialogComponent } from "../../../../src/app/components/confirm-dialog/confirm-dialog.component";
import { ConfirmRequest } from "../../../../src/app/models/confirm-request";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { DialogDescriptionFixture } from "../../../fixtures/dialog-description.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";

describe("ConfirmDialogComponent", () => {
  const request = new ConfirmRequest("Delete chat", "\"First\" and its messages are removed.", "Delete");

  const withOther = new ConfirmRequest("Delete chat", "\"First\", its messages and the 2 files it holds are removed.", "Delete", "Move to project…");

  const create = (shown: ConfirmRequest = request): { element: HTMLElement; answers: (boolean | string)[] } => {
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput("request", shown);
    const answers: (boolean | string)[] = [];
    fixture.componentInstance.answered.subscribe(t => answers.push(t));
    fixture.componentInstance.other.subscribe(() => answers.push("other"));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, answers };
  };

  it("shows the request and answers yes from its confirm button", () => {
    const { element, answers } = create();

    expect(element.querySelector(".nol-dialog-title")?.textContent).toBe(request.title);
    expect(element.textContent).toContain(request.text);
    const confirm = element.querySelector<HTMLButtonElement>(".nol-teamrun-confirm");
    expect(confirm?.textContent?.trim()).toBe(request.confirmLabel);
    confirm?.click();

    expect(answers).toEqual([true]);
  });

  it("is described by its text, under the title, when Close takes the first focus", async () => {
    const reference = TestBed.inject(DialogService).open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    reference.componentRef?.setInput("request", request);

    DialogDescriptionFixture.expectDescribedBy(await DialogDescriptionFixture.focusedAsync(".nol-teamrun-cancel"), [request.text]);

    await DialogDescriptionFixture.closeAsync(reference);
  });

  it("answers no from Close and from Escape", () => {
    const { element, answers } = create();
    const close = element.querySelector<HTMLButtonElement>(".nol-teamrun-cancel");

    expect(close?.textContent?.trim()).toBe(Resources.closeLabel);
    close?.click();
    element.querySelector("nol-dialog")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(answers).toEqual([false, false]);
  });

  it("shows the request's other action only when it names one, and answers it apart from yes and no", () => {
    const plain = create();
    expect(plain.element.querySelector(".nol-teamrun-other")).toBeNull();
    TestBed.resetTestingModule();
    const { element, answers } = create(withOther);
    const other = element.querySelector<HTMLButtonElement>(".nol-teamrun-other");

    expect(other?.textContent?.trim()).toBe(withOther.otherLabel);
    other?.click();

    expect(answers).toEqual(["other"]);
  });

  describe.each([
    { look: "light", mode: ThemeMode.Light },
    { look: "dark", mode: ThemeMode.Dark }
  ])("in $look", ({ mode }) => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("shows a destructive request's confirm button in the danger look, and any other request's in the primary look", () => {
      const lookOf = (shown: ConfirmRequest): readonly [boolean, string] => {
        const button = create(shown).element.querySelector<HTMLElement>(".nol-teamrun-confirm");
        if (Object.isNull(button))
          throw new Error("The dialog shows no confirm button.");
        const look: readonly [boolean, string] = [button.classList.contains("nol-button-danger"), getComputedStyle(button).backgroundColor];
        TestBed.resetTestingModule();
        return look;
      };
      const error = AppearanceFixture.readColor(FixtureTheme.theme, mode, "error");

      const danger = lookOf(new ConfirmRequest(request.title, request.text, request.confirmLabel, null, true));
      const plain = lookOf(request);

      expect([danger, plain[0]]).toEqual([[true, error], false]);
      expect(plain[1]).not.toBe(error);
    });
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

    it("puts Close as a text button before the confirm button, half a rem apart, with the confirm button at the end of the actions", () => {
      const { element } = create();

      DialogActionsFixture.expectCloseThenPrimary(element, ".nol-teamrun-confirm");
    });

    it("puts the other action as a secondary button between Close and the confirm button, half a rem from each", () => {
      const { element } = create(withOther);
      const box = (selector: string): DOMRect => element.querySelector(selector)!.getBoundingClientRect();
      const other = element.querySelector(".nol-teamrun-other")!;

      expect([...element.querySelector(".nol-dialog-actions")!.children]).toEqual([element.querySelector(".nol-teamrun-cancel"), other,
        element.querySelector(".nol-teamrun-confirm")]);
      expect(other.classList).toContain("nol-button-secondary");
      AppearanceFixture.expectPixels(box(".nol-teamrun-other").height, AppearanceFixture.measureLook("button-height"));
      AppearanceFixture.expectPixels(box(".nol-teamrun-other").top, box(".nol-teamrun-confirm").top);
      AppearanceFixture.expectPixels(box(".nol-teamrun-other").left - box(".nol-teamrun-cancel").right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box(".nol-teamrun-confirm").left - box(".nol-teamrun-other").right, AppearanceFixture.measureLook("space-2"));
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the confirm dialog visible under forced colours", async () => {
      const { element } = create(withOther);
      await AccessibilityFixture.expectVisibleForcedAsync(element);
      expect(AccessibilityFixture.popups(element)).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the confirm dialog at 200% zoom", async () => {
      const { element } = create(withOther);
      await AccessibilityFixture.expectFitsZoomedAsync(element, async () => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await TestBed.inject(ApplicationRef).whenStable();
      });
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the confirm dialog by keyboard, with a visible ring", async () => {
      const { element } = create(withOther);
      expect(await AccessibilityFixture.expectKeyboardAsync(element)).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the confirm dialog", () => {
      const { element } = create(withOther);
      expect(AccessibilityFixture.expectNamed(element)).toBeGreaterThan(0);
    });
  });
});
