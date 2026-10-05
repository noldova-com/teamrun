/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { userEvent } from "vitest/browser";

import { QuitFixture } from "../../../fixtures/quit.fixture";

describe("QuitDialogComponent", () => {
  let quit: QuitFixture;

  beforeEach(() => {
    quit = QuitFixture.start();
  });

  afterEach(async () => {
    await quit.endAsync();
  });

  function title(): string {
    return document.getElementById(QuitFixture.dialog()?.getAttribute("aria-labelledby") ?? "")?.textContent ?? "";
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
    quit.bridge.askToQuit({ descriptions: ["Indexing the project", "Saving the notes"], isWaiting: false });
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
    expect(QuitFixture.dialog()?.getAttribute("aria-modal")).toBe("true");
    expect(quit.bridge.quitAnswers).toEqual(["Wait", "Stop", "Cancel", "Cancel"]);
  });

  it("waits with the list the desktop keeps current, moves focus to Cancel and lists at most five pieces of work", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));

    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));
    const waiting = [title(), buttons(), document.querySelector(".tr-quit-text")?.textContent?.trim()];
    quit.bridge.askToQuit({ descriptions: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"], isWaiting: true });
    await vi.waitFor(() => expect(items().length).toBe(6));

    expect(waiting).toEqual(["Waiting for the work to finish", ["Stop the work and quit", "Cancel"], "TeamRun quits when this work finishes:"]);
    expect(items()).toEqual(["One", "Two", "Three", "Four", "Five", "and 2 more"]);
    expect(document.activeElement).toBe(button("Cancel"));
    expect(document.querySelectorAll("[role=dialog]").length).toBe(1);
  });
});
