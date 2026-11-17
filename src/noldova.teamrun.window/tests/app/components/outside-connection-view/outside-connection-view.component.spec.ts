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
import { WindowPartTokens } from "@noldova/desktop.window";
import { MethodName, OutsideConnection } from "@noldova/teamrun.protocol";
import { ClipboardWriter, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OutsideConnectionViewComponent } from "../../../../src/app/components/outside-connection-view/outside-connection-view.component";
import { ClockService } from "../../../../src/app/services/clock.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OutsideConnectionViewComponent", () => {
  const url = "http://127.0.0.1:47391/mcp";
  const token = "tok-0123456789abcdefghijklmnopqrstuvwxyzABCDE";
  const renewed = "new-0123456789abcdefghijklmnopqrstuvwxyzABCDE";
  const codex = `[mcp_servers.teamrun]\nurl = "${url}"\nbearer_token_env_var = "TEAMRUN_TOKEN"`;
  const claude = JSON.stringify({ mcpServers: { teamrun: { type: "http", url, headers: { Authorization: "Bearer ${TEAMRUN_TOKEN}" } } } }, null, 2);
  const hidden = "••••••••••••••••";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OutsideConnectionViewComponent>;
  let connection: OutsideConnection;
  let clipboard: ClipboardWriterFixture;
  let clock: FakeClock;

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The view has no element.");
    return native;
  };
  const part = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const cells = (): string[][] => [...element().querySelectorAll("tbody tr.nol-teamrun-item")].map(t => [...t.children].map(u => u.textContent?.trim() ?? ""));
  const click = async (selector: string, root: ParentNode = element()): Promise<void> => {
    await userEvent.click(part(selector, root));
    await fixture.whenStable();
  };
  const resets = (): number => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OutsideTokenReset)).length;
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, writer: ClipboardWriter | null = clipboard, read: boolean = true): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.OutsideConnectionRead, () => connection.toJson())
      .answer(MethodName.OutsideTokenReset, () => {
        connection = new OutsideConnection(connection.enabled, connection.url, renewed, connection.failure, connection.note);
        return connection.toJson();
      });
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClipboardWriter, useValue: writer },
      { provide: ClockService, useValue: clock }] });
    fixture = TestBed.createComponent(OutsideConnectionViewComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    if (read)
      await Wait.until(() => expect(texts("[role=status]")).toEqual([]));
  };

  beforeEach(() => {
    connection = new OutsideConnection(true, url, token, null, null);
    clipboard = new ClipboardWriterFixture();
    clock = new FakeClock(0);
  });

  it("shows that outside sessions are on, the address, the token hidden until Show, and each agent's settings naming the variable, never the token", async () => {
    await create();

    expect(cells()).toEqual([
      ["Outside sessions", "On", ""],
      ["Address", url, "Copy"],
      ["Token", hidden, "ShowCopy"]
    ]);
    expect(texts(".nol-teamrun-reset-token")).toEqual(["Reset token"]);
    expect(part(".nol-teamrun-reset-token").classList).toContain("nol-button-secondary");
    expect(texts(".nol-teamrun-outside-setup-title")).toEqual(["Codex, in config.toml", "Claude Code, in .mcp.json"]);
    expect(texts(".nol-teamrun-outside-setup-text")).toEqual([codex, claude]);
    expect(texts(".nol-teamrun-outside-setup-text").some(t => t.includes(token))).toBe(false);

    await click(".nol-teamrun-show-token");
    expect(texts(".nol-teamrun-outside-token code")).toEqual([token]);
    expect(part(".nol-teamrun-show-token").getAttribute("aria-pressed")).toBe("true");
    expect(texts(".nol-teamrun-show-token")).toEqual(["Hide"]);

    await click(".nol-teamrun-show-token");
    expect(texts(".nol-teamrun-outside-token code")).toEqual([hidden]);
    expect(part(".nol-teamrun-show-token").getAttribute("aria-pressed")).toBe("false");
  });

  it("copies the address, the token and each agent's settings, saying Copied on the last one copied", async () => {
    await create();

    await click(".nol-teamrun-copy-address");
    expect(texts(".nol-teamrun-copy-address")).toEqual(["Copied"]);
    await click(".nol-teamrun-copy-token");
    expect([texts(".nol-teamrun-copy-address"), texts(".nol-teamrun-copy-token")]).toEqual([["Copy"], ["Copied"]]);
    await click(".nol-teamrun-outside-setup:last-child .nol-teamrun-copy-setup");

    expect(clipboard.texts).toEqual([url, token, claude]);
    expect(texts(".nol-teamrun-copy-setup")).toEqual(["Copy", "Copied"]);
    expect(texts(".nol-teamrun-copy-token")).toEqual(["Copy"]);
  });

  it("shows Copied for the image viewer's moment after a copy, then Copy again", async () => {
    await create();

    await click(".nol-teamrun-copy-address");
    const copied = [texts(".nol-teamrun-copy-address"), clock.remaining];
    clock.advance(1499);
    await fixture.whenStable();
    const before = texts(".nol-teamrun-copy-address");
    clock.advance(1);
    await fixture.whenStable();

    expect([copied, before]).toEqual([[["Copied"], [1500]], ["Copied"]]);
    expect([texts(".nol-teamrun-copy-address"), clock.remaining]).toEqual([["Copy"], []]);
  });

  it("moves Copied to a field copied within the moment, and starts the moment again from that copy", async () => {
    await create();

    await click(".nol-teamrun-copy-address");
    clock.advance(1000);
    await click(".nol-teamrun-copy-token");
    const shown = [texts(".nol-teamrun-copy-address"), texts(".nol-teamrun-copy-token"), clock.remaining];
    clock.advance(1000);
    await fixture.whenStable();
    const later = texts(".nol-teamrun-copy-token");
    clock.advance(500);
    await fixture.whenStable();

    expect([shown, later]).toEqual([[["Copy"], ["Copied"], [1500]], ["Copied"]]);
    expect(texts(".nol-teamrun-copy-token")).toEqual(["Copy"]);
  });

  it("stops the moment when the page closes, and starts none for a copy that ends after it closed", async () => {
    await create();
    let answer: (copied: boolean) => void = () => undefined;
    const held = new Promise<boolean>(resolve => answer = resolve);

    await click(".nol-teamrun-copy-token");
    clipboard.answer = () => held;
    await click(".nol-teamrun-copy-address");
    const running = clock.remaining;
    fixture.destroy();
    const closed = clock.remaining;
    answer(true);
    await held;

    expect([running, closed, clock.remaining]).toEqual([[1500], [], []]);
  });

  it("shows a refused copy above the table until Dismiss clears it", async () => {
    clipboard.answer = () => Promise.resolve(false);
    await create();

    await click(".nol-teamrun-copy-address");

    expect(texts(".nol-teamrun-error-text")).toEqual(["TeamRun couldn't copy to the clipboard."]);
    expect(texts(".nol-teamrun-copy-address")).toEqual(["Copy"]);
    await click(".nol-teamrun-dismiss");
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("offers no Copy where the window has no clipboard", async () => {
    await create(undefined, null);

    expect(element().querySelectorAll(".nol-teamrun-copy-address, .nol-teamrun-copy-token, .nol-teamrun-copy-setup")).toHaveLength(0);
    expect(texts(".nol-teamrun-show-token, .nol-teamrun-reset-token")).toEqual(["Reset token", "Show"]);
  });

  it("resets the token through the runtime part, hiding the new one and clearing Copied", async () => {
    await create();
    await click(".nol-teamrun-show-token");
    await click(".nol-teamrun-copy-token");

    await click(".nol-teamrun-reset-token");
    await Wait.until(() => expect(resets()).toBe(1));
    await Wait.until(() => expect(texts(".nol-teamrun-outside-token code")).toEqual([hidden]));
    await click(".nol-teamrun-show-token");

    expect(texts(".nol-teamrun-outside-token code")).toEqual([renewed]);
    expect(texts(".nol-teamrun-copy-token")).toEqual(["Copy"]);
    expect(part(".nol-teamrun-reset-token").hasAttribute("disabled")).toBe(false);
  });

  it("holds Reset token while a reset is in flight and shows a refused one above the table", async () => {
    let refuse: (reason: Error) => void = () => undefined;
    await create(t => t.answer(MethodName.OutsideTokenReset, () => new Promise((_, reject) => refuse = reject)));

    await click(".nol-teamrun-reset-token");
    await Wait.until(() => expect(part(".nol-teamrun-reset-token").hasAttribute("disabled")).toBe(true));
    refuse(new Error("The keychain is locked."));

    await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The keychain is locked."]));
    expect(part(".nol-teamrun-reset-token").hasAttribute("disabled")).toBe(false);
    expect(texts(".nol-teamrun-outside-token code")).toEqual([hidden]);
  });

  it("says outside sessions are off, and that the token comes when they are turned on, with no token controls", async () => {
    connection = new OutsideConnection(false, url, null, null, null);
    await create();

    expect(cells()).toEqual([
      ["Outside sessions", "Off. Turn on Outside sessions in Settings to let outside agents in.", ""],
      ["Address", url, "Copy"],
      ["Token", "Made when you turn outside sessions on", ""]
    ]);
    expect(element().querySelector(".nol-teamrun-outside-failed")).toBeNull();
    expect(element().querySelector(".nol-teamrun-reset-token")).toBeNull();
  });

  it("shows the port's failure as the state, in the error colour", async () => {
    connection = new OutsideConnection(true, url, token, "Port 47391 is in use; choose another in Settings.", null);
    await create();

    expect(texts(".nol-teamrun-outside-state td")[0]).toBe("Port 47391 is in use; choose another in Settings.");
    expect(part(".nol-teamrun-outside-state .nol-teamrun-outside-failed")).toBeDefined();
  });

  it("keeps the state On in its own colour and shows the note under it in the body text's colour", async () => {
    connection = new OutsideConnection(true, url, token, null, "TeamRun made a new token; give outside agents the new token.");
    await create();

    const state = part(".nol-teamrun-outside-state td span");
    const note = part(".nol-teamrun-outside-state .nol-teamrun-outside-note");
    const cell = part(".nol-teamrun-outside-state td");

    expect([...texts(".nol-teamrun-outside-state td span"), ...texts(".nol-teamrun-outside-note")]).toEqual(["On", "TeamRun made a new token; give outside agents the new token."]);
    expect(element().querySelector(".nol-teamrun-outside-failed")).toBeNull();
    expect([getComputedStyle(state).color, getComputedStyle(note).color]).toEqual([getComputedStyle(cell).color, getComputedStyle(cell).color]);
    expect(note.getBoundingClientRect().top).toBeGreaterThanOrEqual(state.getBoundingClientRect().bottom - 0.5);
    expect(note.getBoundingClientRect().left).toBeCloseTo(state.getBoundingClientRect().left, 1);
  });

  it("shows that it reads the connection until the runtime part answers, then a failed read by its text with no rows", async () => {
    let answer: (reason: unknown) => void = () => undefined;
    await create(t => t.answer(MethodName.OutsideConnectionRead, () => new Promise((_, reject) => answer = reject)), clipboard, false);

    expect(texts("[role=status]")).toEqual(["Reading how outside agents connect…"]);
    expect(element().querySelectorAll(".nol-teamrun-outside-setup")).toHaveLength(0);
    answer("The runtime stopped.");

    await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The runtime stopped."]));
    expect(cells()).toEqual([]);
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

    it("insets both tables by the window's document padding and lines them up on the same edges", async () => {
      await create();
      const view = part(".nol-teamrun-settings-view");
      const [table, setups] = [part(".nol-teamrun-outside-connection"), part(".nol-teamrun-outside-setups")];
      const block = AppearanceFixture.measureLook("document-padding-block");
      const inline = AppearanceFixture.measureLook("content-padding-inline");

      expect(getComputedStyle(element()).overflowY).toBe("auto");
      AppearanceFixture.expectPixels(box(table).top - box(view).top, block);
      AppearanceFixture.expectPixels(box(table).left - box(view).left, inline);
      AppearanceFixture.expectPixels(box(view).right - box(table).right, inline);
      AppearanceFixture.expectPixels(box(setups).left, box(table).left);
      AppearanceFixture.expectPixels(box(setups).right, box(table).right);
      AppearanceFixture.expectPixels(box(view).bottom - box(setups).bottom, block);
    });

    it("starts each setting's title at its text's edge and ends its Copy at the text's far edge, the text scrolling inside its own box", async () => {
      await create();
      const setup = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-outside-setup")];
      const [first, second] = setup;
      if (Object.isUndefined(first) || Object.isUndefined(second))
        throw new Error("The view shows fewer than two settings.");

      expect(setup).toHaveLength(2);
      for (const each of setup) {
        const [title, copy, text] = [part(".nol-teamrun-outside-setup-title", each), part(".nol-teamrun-copy-setup", each), part(".nol-teamrun-outside-setup-text", each)];
        AppearanceFixture.expectPixels(box(title).left, box(text).left);
        AppearanceFixture.expectPixels(box(copy).right, box(text).right);
        expect(box(text).width).toBeLessThanOrEqual(box(each).width);
        expect(getComputedStyle(text).overflowX).toBe("auto");
      }
      AppearanceFixture.expectPixels(box(second).top - box(first).bottom, AppearanceFixture.measureLook("space-3"));
    });

    it("keeps the address, the token and every button inside a 24rem panel, with nothing scrolling sideways", async () => {
      await create();
      element().style.width = "24rem";
      await click(".nol-teamrun-show-token");
      await Wait.until(() => expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth));
      const view = box(element());

      for (const selector of [".nol-teamrun-outside-address code", ".nol-teamrun-copy-address", ".nol-teamrun-outside-token code", ".nol-teamrun-show-token",
        ".nol-teamrun-copy-token", ".nol-teamrun-reset-token", ".nol-teamrun-outside-connection", ".nol-teamrun-outside-setup-text",
        ".nol-teamrun-copy-setup"]) {
        expect(box(part(selector)).left).toBeGreaterThanOrEqual(view.left);
        expect(box(part(selector)).right).toBeLessThanOrEqual(view.right);
      }
      expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-copy-address")).right, box(part(".nol-teamrun-copy-token")).right);
    });

    it("keeps a long token on its line's cell without widening the table", async () => {
      connection = new OutsideConnection(true, url, `${token}${"x".repeat(200)}`, null, null);
      await create();
      await click(".nol-teamrun-show-token");
      const [row, value] = [part(".nol-teamrun-outside-token"), part(".nol-teamrun-outside-token code")];

      expect(box(value).right).toBeLessThanOrEqual(box(row).right);
      expect(box(part(".nol-teamrun-outside-connection")).right).toBeLessThanOrEqual(box(element()).right);
    });
  });
});
