/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { QuitService } from "../../../../src/app/services/quit.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("QuitDialogComponent", () => {
  let bridge: DesktopBridgeFixture;
  let opener: HTMLButtonElement;
  let stop: () => void;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    opener = document.createElement("button");
    opener.textContent = "Close";
    document.body.append(opener);
    opener.focus();
    stop = TestBed.inject(QuitService).listen();
  });

  afterEach(async () => {
    bridge.askToQuit(null);
    stop();
    await vi.waitFor(() => expect(document.querySelector("tr-quit-dialog")).toBeNull());
    opener.remove();
    DesktopBridgeFixture.remove();
  });

  function dialog(): HTMLElement | null {
    return document.querySelector("[role=dialog]");
  }

  function title(): string {
    return document.getElementById(dialog()?.getAttribute("aria-labelledby") ?? "")?.textContent ?? "";
  }

  function items(): string[] {
    return [...document.querySelectorAll(".tr-quit-list li")].map(t => t.textContent?.trim() ?? "");
  }

  function buttons(): string[] {
    return [...document.querySelectorAll(".tr-dialog-actions button")].map(t => t.textContent?.trim() ?? "");
  }

  function button(choice: string): HTMLButtonElement {
    return document.querySelector(`[data-tr-quit=${choice}]`) as HTMLButtonElement;
  }

  it("asks what to do with the work in progress, with waiting as the focused choice, and passes on each answer", async () => {
    bridge.askToQuit({ descriptions: ["Indexing the project", "Saving the notes"], isWaiting: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));

    const asked = [title(), items(), buttons(), document.querySelector(".tr-dialog-body")?.textContent?.includes("Wait for it to finish, or stop it now.")];
    await userEvent.keyboard("{Enter}");
    button("Stop").click();
    button("Cancel").click();
    await userEvent.keyboard("{Escape}");

    expect(asked).toEqual([
      "Work is still running",
      ["Indexing the project", "Saving the notes"],
      ["Wait, then quit", "Stop the work and quit", "Cancel"],
      true
    ]);
    expect(dialog()?.getAttribute("aria-modal")).toBe("true");
    expect(bridge.quitAnswers).toEqual(["Wait", "Stop", "Cancel", "Cancel"]);
  });

  it("waits with the list the desktop keeps current, moves focus to Cancel and lists at most five pieces of work", async () => {
    bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));

    bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));
    const waiting = [title(), buttons(), document.querySelector(".tr-quit-text")?.textContent?.trim()];
    bridge.askToQuit({ descriptions: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"], isWaiting: true });
    await vi.waitFor(() => expect(items().length).toBe(6));

    expect(waiting).toEqual(["Waiting for the work to finish", ["Stop the work and quit", "Cancel"], "TeamRun quits when this work finishes:"]);
    expect(items()).toEqual(["One", "Two", "Three", "Four", "Five", "and 2 more"]);
    expect(document.activeElement).toBe(button("Cancel"));
    expect(document.querySelectorAll("[role=dialog]").length).toBe(1);
  });

  it("closes when the desktop takes the question away and returns focus to where it was", async () => {
    bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    bridge.askToQuit(null);
    bridge.askToQuit(null);

    await vi.waitFor(() => expect(dialog()).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
    expect(bridge.quitAnswers).toEqual([]);
  });
});
