/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { CommandSearchService } from "../../../src/app/services/command-search.service";
import { AppearanceFixture } from "../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("CommandSearchService", () => {
  let row: HTMLElement;
  let button: HTMLButtonElement;
  let search: CommandSearchService;

  beforeEach(() => {
    AppearanceFixture.apply();
    DesktopBridgeFixture.install();
    row = document.body.appendChild(document.createElement("tr-window-row"));
    row.setAttribute("data-tr-chrome", "top");
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "var(--tr-window-row-height)", display: "block" });
    button = document.body.appendChild(document.createElement("button"));
    search = TestBed.inject(CommandSearchService);
  });

  afterEach(() => {
    search.close();
    row.remove();
    button.remove();
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  function pane(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container .tr-command-search-pane");
  }

  it("opens once, in its own pane centred under the window row", async () => {
    search.open();
    search.open();
    await vi.waitFor(() => expect(pane()?.querySelector("tr-command-search")).not.toBeNull());
    const box = pane()?.getBoundingClientRect();

    expect(search.isOpen).toBe(true);
    expect(document.querySelectorAll(".cdk-overlay-container .tr-command-search-pane").length).toBe(1);
    expect(box?.top).toBeCloseTo(row.getBoundingClientRect().bottom, 0);
    expect(Math.abs((box?.left ?? 0) + (box?.width ?? 0) / 2 - document.documentElement.clientWidth / 2)).toBeLessThan(1);
  });

  it("opens nothing without a window row", () => {
    row.remove();

    search.open();

    expect(search.isOpen).toBe(false);
  });

  it("returns focus to where it was when it closes, and to nothing that has gone or is not an HTML element", () => {
    const drawing = document.body.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    drawing.setAttribute("tabindex", "0");
    drawing.focus();
    search.open();
    search.close();
    const focusAfterDrawing = document.activeElement;
    drawing.remove();
    button.focus();
    search.open();
    search.close();
    const focusAfterClose = document.activeElement;
    button.focus();
    search.open();
    button.remove();
    search.close();

    expect(focusAfterDrawing).toBe(drawing);
    expect(focusAfterClose).toBe(button);
    expect(search.isOpen).toBe(false);
  });

  it("closes on a click outside and when the window row moves", async () => {
    search.open();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const isOpenAfterClick = search.isOpen;
    search.open();
    row.style.top = "10px";
    row.dispatchEvent(new Event("scroll"));

    expect(isOpenAfterClick).toBe(false);
    expect(search.isOpen).toBe(false);
  });
});
