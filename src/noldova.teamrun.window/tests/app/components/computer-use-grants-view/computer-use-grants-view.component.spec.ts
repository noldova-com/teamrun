/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern } from "@noldova/desktop.protocol";
import { WindowPartTokens } from "@noldova/desktop.window";
import { ComputerUseGrant, ComputerUseGrantIdParams, MethodName } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ComputerUseGrantsViewComponent } from "../../../../src/app/components/computer-use-grants-view/computer-use-grants-view.component";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ComputerUseGrantsViewComponent", () => {
  const paint = new ComputerUseGrant("g2", "c1", "Release notes", "Reviewer", "c:\\program files\\paint\\paint.exe", null, null, "2026-10-29T11:00:00.000Z");
  const notes = new ComputerUseGrant("g1", "c1", "Release notes", null, "com.example.notes", null, null, "2026-10-29T10:00:00.000Z");
  const mail = new ComputerUseGrant("g3", "c9", null, null, "com.example.mail", null, null, "2026-10-29T09:00:00.000Z");
  const screen = new ComputerUseGrant("g4", "c1", "Release notes", null, null, null, null, "2026-10-29T08:00:00.000Z");
  const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const described = new ComputerUseGrant("g1", "c1", "Release notes", null, "com.example.notes", "Notes", pixel, "2026-10-29T10:00:00.000Z");
  const unnamedIcon = new ComputerUseGrant("g2", "c1", "Release notes", "Reviewer", "c:\\program files\\paint\\paint.exe", "Paint", null, "2026-10-29T11:00:00.000Z");
  const refusal = "The computer-use grant \"g2\" does not exist or was already revoked.";
  const reading = "Reading what chats may control…";
  const none = "No chat may control an app or the screen";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ComputerUseGrantsViewComponent>;
  let grants: ComputerUseGrant[];

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The view has no element.");
    return native;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const part = (root: ParentNode, selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("tbody tr.nol-teamrun-item")];
  const row = (index: number): HTMLElement => {
    const found = rows()[index];
    if (Object.isUndefined(found))
      throw new Error(`There is no row ${index}.`);
    return found;
  };
  const icon = (index: number): HTMLImageElement | null => row(index).querySelector<HTMLImageElement>(".nol-teamrun-grant-icon > img");
  const loaded = (index: number): boolean => {
    const image = icon(index);
    return image?.complete === true && image.naturalWidth > 0;
  };
  const revokeButton = (index: number): HTMLButtonElement => {
    const found = part(row(index), ".nol-teamrun-revoke");
    if (!(found instanceof HTMLButtonElement))
      throw new Error(`Row ${index}'s revoke control is no button.`);
    return found;
  };
  const revoked = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ComputerUseGrantRevoke))
    .map(t => ComputerUseGrantIdParams.fromJson(t.parameters).grantId);
  const timeOf = (grant: ComputerUseGrant): string => DatePattern.format(new Date(grant.grantedAt), "MMM d, yyyy, h:mm a");
  const oldestFirst = (list: readonly ComputerUseGrant[]): ComputerUseGrant[] => list.toSorted((a, b) => a.grantedAt.localeCompare(b.grantedAt));
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.ComputerUseGrantList, () => grants.map(t => t.toJson()))
      .answer(MethodName.ComputerUseGrantRevoke, t => {
        const id = ComputerUseGrantIdParams.fromJson(t).grantId;
        grants = grants.filter(u => u.id !== id);
        return null;
      });
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(ComputerUseGrantsViewComponent);
    fixture.autoDetectChanges();
    await settle();
    await Wait.until(() => expect(texts(".nol-teamrun-no-grants")).not.toEqual([reading]));
  };

  beforeEach(() => {
    grants = [paint, notes, mail, screen];
  });

  it("lists each app a chat may control by its program's name, and the screen, with its chat, its teammate and when it was allowed, oldest first and newest at the bottom, whatever order the runtime part sends", async () => {
    await create();

    expect(texts("th").slice(0, 3)).toEqual(["App", "Chat", "Allowed"]);
    expect(rows().map(t => texts("td", t).slice(0, 3))).toEqual([
      ["The screen", "Release notes", timeOf(screen)],
      ["com.example.mail", "Deleted chat", timeOf(mail)],
      ["com.example.notes", "Release notes", timeOf(notes)],
      ["paint.exe", "Release notes · Reviewer", timeOf(paint)]
    ]);
    expect(rows().map((_, t) => revokeButton(t).getAttribute("aria-label")))
      .toEqual(["Revoke the screen", "Revoke com.example.mail", "Revoke com.example.notes", "Revoke paint.exe"]);
  });

  it("writes when each app was allowed in the 24-hour format once the setting asks for it, and in the 12-hour default again once the setting is cleared", async () => {
    await create(t => TimeFormatService.register(t));
    try {
      context.changeSetting("desktop.dateTimeFormat", "d MMM yyyy, HH:mm");
      await Wait.until(() => expect(rows().map(t => texts("td", t)[2])).toEqual(oldestFirst(grants).map(t => DatePattern.format(new Date(t.grantedAt), "d MMM yyyy, HH:mm"))));
      expect(texts(".nol-teamrun-grant-time").map(t => / [AP]M$/u.test(t))).toEqual([false, false, false, false]);

      context.changeSetting("desktop.dateTimeFormat", null);

      await Wait.until(() => expect(rows().map(t => texts("td", t)[2])).toEqual(oldestFirst(grants).map(t => timeOf(t))));
    }
    finally {
      TimeFormatService.release(context);
    }
  });

  it("names each app as computer use describes it, with its icon, and Revoke by that name", async () => {
    grants = [unnamedIcon, described, mail, screen];
    await create();
    await Wait.until(() => expect(loaded(2)).toBe(true));

    expect(rows().map(t => texts(".nol-teamrun-grant-app-name", t)[0])).toEqual(["The screen", "com.example.mail", "Notes", "Paint"]);
    expect(rows().map((_, t) => revokeButton(t).getAttribute("aria-label"))).toEqual(["Revoke the screen", "Revoke com.example.mail", "Revoke Notes", "Revoke Paint"]);
    expect(rows().map((_, t) => icon(t)?.getAttribute("src") ?? null)).toEqual([null, null, `data:image/png;base64,${pixel}`, null]);
    expect(icon(2)?.getAttribute("alt")).toBe("");
    expect(rows().map(t => t.querySelectorAll(".nol-teamrun-grant-icon").length)).toEqual([1, 1, 1, 1]);
  });

  it("drops an icon that doesn't decode and keeps its blank slot", async () => {
    grants = [new ComputerUseGrant("g1", "c1", "Release notes", null, "com.example.notes", "Notes", "iVBORw==", "2026-10-29T10:00:00.000Z"), mail];
    await create();
    await Wait.until(() => expect(icon(1)).toBeNull());
    const name = (index: number): DOMRect => part(row(index), ".nol-teamrun-grant-app-name").getBoundingClientRect();

    expect(texts(".nol-teamrun-grant-app-name")).toEqual(["com.example.mail", "Notes"]);
    AppearanceFixture.expectPixels(name(0).left, name(1).left);
  });

  it("names an app whose identity ends in a separator by the whole identity, as it has no program name", async () => {
    grants = [new ComputerUseGrant("g5", "c1", "Release notes", null, "c:\\tools\\", null, null, "2026-10-29T07:00:00.000Z")];
    await create();

    expect(rows().map(t => texts("td", t)[0])).toEqual(["c:\\tools\\"]);
    expect(revokeButton(0).getAttribute("aria-label")).toBe("Revoke c:\\tools\\");
  });

  it("cuts a long chat title to one line with an ellipsis and shows it in full in its tooltip, and gives a short title none", async () => {
    const longTitle = `A chat titled ${"at length ".repeat(30)}`.trim();
    const long = new ComputerUseGrant("g5", "c2", longTitle, "Writer", "com.example.long", null, null, "2026-10-29T12:00:00.000Z");
    grants = [long, notes];
    await create();
    const title = (index: number): HTMLElement => part(row(index), ".nol-teamrun-grant-chat-text");
    const tooltip = (): string | null => document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;

    expect(getComputedStyle(title(1)).textOverflow).toBe("ellipsis");
    expect(title(1).scrollWidth).toBeGreaterThan(title(1).clientWidth);
    AppearanceFixture.expectPixels(title(1).getBoundingClientRect().height, title(0).getBoundingClientRect().height);
    expect(title(1).getBoundingClientRect().right).toBeLessThanOrEqual(part(row(1), ".nol-teamrun-grant-chat").getBoundingClientRect().right);
    await userEvent.hover(title(1));
    await Wait.until(() => expect(tooltip()).toBe(`${longTitle} · Writer`));
    await userEvent.unhover(title(1));
    await Wait.until(() => expect(tooltip()).toBeNull());
    await userEvent.hover(title(0));
    await settle();
    expect(tooltip()).toBeNull();
  });

  it("shows that it reads the apps until the runtime part answers", async () => {
    let answer: () => void = () => undefined;
    context = SampleData.createContext()
      .answer(MethodName.ComputerUseGrantList, () => new Promise<JsonValue>(resolve => answer = () => resolve(grants.map(t => t.toJson()))));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(ComputerUseGrantsViewComponent);
    fixture.autoDetectChanges();
    await settle();

    expect(texts(".nol-teamrun-no-grants")).toEqual([reading]);
    answer();
    await Wait.until(() => expect(rows()).toHaveLength(4));
  });

  it("revokes an app and the screen through the runtime part and lists them again, saying when no chat may control either", async () => {
    grants = [notes, screen];
    await create();

    revokeButton(1).click();
    await Wait.until(() => expect(rows()).toHaveLength(1));
    revokeButton(0).click();
    await Wait.until(() => expect(rows()).toHaveLength(0));

    expect(revoked()).toEqual(["g1", "g4"]);
    expect(texts(".nol-teamrun-no-grants")).toEqual([none]);
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("sends one revoke for a second click while the first is in flight, and drops the row before it lists the grants again", async () => {
    let release: () => void = () => undefined;
    let answerList: () => void = () => undefined;
    await create(t => t
      .answer(MethodName.ComputerUseGrantRevoke, u => new Promise<JsonValue>(resolve => release = () => {
        grants = grants.filter(v => v.id !== ComputerUseGrantIdParams.fromJson(u).grantId);
        resolve(null);
      }))
      .answer(MethodName.ComputerUseGrantList, () => {
        const listed = grants.map(v => v.toJson());
        return revoked().length === 0 ? listed : new Promise<JsonValue>(resolve => answerList = () => resolve(listed));
      }));

    revokeButton(0).click();
    await Wait.until(() => expect(revokeButton(0).disabled).toBe(true));
    revokeButton(0).click();
    revokeButton(1).click();
    expect(rows().map((_, t) => revokeButton(t).disabled)).toEqual([true, true, true, true]);
    release();

    await Wait.until(() => expect(rows()).toHaveLength(3));
    expect(rows().map(t => texts("td", t)[0])).toEqual(["com.example.mail", "com.example.notes", "paint.exe"]);
    expect(rows().map((_, t) => revokeButton(t).disabled)).toEqual([false, false, false]);
    answerList();
    await settle();
    expect(revoked()).toEqual(["g4"]);
    expect(rows()).toHaveLength(3);
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("shows a refused revoke above the table with the apps the runtime part still lists, until Dismiss clears it", async () => {
    await create(t => t.fail(MethodName.ComputerUseGrantRevoke, refusal));

    revokeButton(0).click();
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-error")).not.toBeNull());

    expect(texts(".nol-teamrun-error-text")).toEqual([refusal]);
    expect(part(element(), ".nol-teamrun-error").getAttribute("role")).toBe("alert");
    expect(rows()).toHaveLength(4);
    expect(context.noticeText()).toBeNull();
    part(element(), ".nol-teamrun-dismiss").click();
    await settle();
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("shows a failed list above the table and no apps", async () => {
    await create(t => t.fail(MethodName.ComputerUseGrantList, "The method is not available."));

    expect(texts(".nol-teamrun-error-text")).toEqual(["The method is not available."]);
    expect(rows()).toHaveLength(0);
    expect(texts(".nol-teamrun-no-grants")).toEqual([none]);
  });

  it("shows a failed list that isn't an error by its text", async () => {
    await create(t => t.answer(MethodName.ComputerUseGrantList, () => Promise.reject("The runtime stopped.")));

    expect(texts(".nol-teamrun-error-text")).toEqual(["The runtime stopped."]);
    expect(rows()).toHaveLength(0);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (target: Element): DOMRect => target.getBoundingClientRect();

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("scrolls from its own edges and insets the view inside by the window's document padding", async () => {
      await create();
      const view = part(element(), ".nol-teamrun-settings-view");
      const table = part(view, "nol-configuration-table");
      const block = AppearanceFixture.measureLook("document-padding-block");
      const inline = AppearanceFixture.measureLook("content-padding-inline");

      expect(getComputedStyle(element()).overflowY).toBe("auto");
      AppearanceFixture.expectPixels(box(view).top, box(element()).top);
      AppearanceFixture.expectPixels(box(view).left, box(element()).left);
      AppearanceFixture.expectPixels(box(table).top - box(view).top, block);
      AppearanceFixture.expectPixels(box(table).left - box(view).left, inline);
      AppearanceFixture.expectPixels(box(view).right - box(table).right, inline);
      AppearanceFixture.expectPixels(box(view).bottom - box(table).bottom, block);
    });

    it("keeps a long chat title on one line inside its cell, as high as a short one", async () => {
      grants = [new ComputerUseGrant("g5", "c2", "A long chat title ".repeat(20).trim(), null, "com.example.long", null, null, "2026-10-29T12:00:00.000Z"), notes];
      await create();
      const title = (index: number): HTMLElement => part(row(index), ".nol-teamrun-grant-chat-text");
      const cell = box(part(row(1), ".nol-teamrun-grant-chat"));

      AppearanceFixture.expectPixels(box(title(1)).height, box(title(0)).height);
      expect(box(title(1)).left).toBeGreaterThanOrEqual(cell.left);
      expect(box(title(1)).right).toBeLessThanOrEqual(cell.right);
      expect(box(revokeButton(1)).left).toBeGreaterThanOrEqual(cell.right);
    });

    const expectAppCells = async (): Promise<void> => {
      grants = [described, unnamedIcon, screen];
      await create();
      await Wait.until(() => expect(loaded(1)).toBe(true));
      const [size, gap] = [AppearanceFixture.measureLook("icon"), AppearanceFixture.measureLook("space-2")];
      const name = (index: number): HTMLElement => part(row(index), ".nol-teamrun-grant-app-name");
      const line = parseFloat(getComputedStyle(name(1)).lineHeight);
      const image = icon(1);
      if (Object.isNull(image))
        throw new Error("The described app shows no icon.");

      AppearanceFixture.expectPixels(box(image).width, size);
      AppearanceFixture.expectPixels(box(image).height, size);
      AppearanceFixture.expectPixels(box(image).top + size / 2, box(name(1)).top + line / 2);
      AppearanceFixture.expectPixels(box(name(1)).left - box(image).right, gap);
      AppearanceFixture.expectPixels(box(image).left, box(part(row(1), ".nol-teamrun-grant-app-label")).left);
      for (const index of [0, 2])
        AppearanceFixture.expectPixels(box(name(index)).left, box(name(1)).left);
      for (const index of [0, 1, 2])
        AppearanceFixture.expectPixels(box(name(index)).top, box(part(row(index), ".nol-teamrun-grant-chat-text")).top);
    };

    it("shows an app's icon at the kit's icon size, centred on its name's line, starts every name at the same edge with or without one, and lines each name up with its chat", async () => {
      await expectAppCells();
    });

    it("keeps the icon and the names' edge at 200% text", async () => {
      document.documentElement.style.fontSize = "200%";
      try {
        await expectAppCells();
      }
      finally {
        document.documentElement.style.removeProperty("font-size");
      }
    });

    it("shows each row's Revoke as an icon button of the full target size inside its row, in the danger colour", async () => {
      await create();
      const target = AppearanceFixture.measureLook("icon-button-target");

      for (const [index, row] of rows().entries()) {
        const button = box(revokeButton(index));
        expect(revokeButton(index).classList).toContain("nol-icon-button");
        AppearanceFixture.expectPixels(button.width, target);
        AppearanceFixture.expectPixels(button.height, target);
        expect(button.top).toBeGreaterThanOrEqual(box(row).top);
        expect(button.bottom).toBeLessThanOrEqual(box(row).bottom);
      }
      if (forcedColors === "none")
        expect(getComputedStyle(revokeButton(0)).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "error"));
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the computer use grants view visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the computer use grants view at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the computer use grants view by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the computer use grants view", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
