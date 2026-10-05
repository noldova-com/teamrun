/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NotificationPost, NotificationSeverity, NotificationState } from "@noldova/teamrun-shell-protocol";

import { NotificationsFixture } from "../../../fixtures/notifications.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

describe("NotificationsPopoverComponent", () => {
  let service: NotificationsFixture;

  beforeEach(() => {
    service = NotificationsFixture.install();
  });

  afterEach(() => NotificationsFixture.remove());

  it("lists each notification with its severity, title, text, module, time, progress and actions, and says when there are none", async () => {
    const fixture = await NotificationsFixture.renderAsync();
    const empty = (await NotificationsFixture.openAsync(fixture)).querySelector(".tr-notifications-empty")?.textContent;
    service.stateValue.set(new NotificationState([
      NotificationsFixture.createNotification(3, "notes.saved", "Saved", { severity: NotificationSeverity.Success, text: "Plan.md", open: "notes.open", actions: ["notes.undo", "clock.reset"], isRead: true }),
      NotificationsFixture.createNotification(2, "clock.sync", "Syncing", { severity: NotificationSeverity.Warning, progress: NotificationPost.indeterminate, isRead: true }),
      NotificationsFixture.createNotification(1, "clock.sync", "Copying", { severity: NotificationSeverity.Error, progress: 0.25, isRead: true })
    ], false, [], 0));
    await fixture.whenStable();
    const rows = [...(NotificationsFixture.findPopover() as HTMLElement).querySelectorAll<HTMLElement>(".tr-notifications-row")];

    expect(empty).toBe("No notifications");
    expect(rows.map(t => [t.dataset["notification"], t.querySelector(".tr-notifications-severity")?.getAttribute("aria-label"), t.querySelector(".tr-notifications-row-title")?.textContent?.trim()]))
      .toEqual([["3", "Success", "Saved"], ["2", "Warning", "Syncing"], ["1", "Error", "Copying"]]);
    expect(rows[0]?.querySelector(".tr-notifications-text")?.textContent).toBe("Plan.md");
    expect(rows[0]?.querySelector(".tr-notifications-meta")?.textContent).toMatch(/^Notes · \d{1,2}:05/);
    expect(rows[1]?.querySelector(".tr-notifications-meta")?.textContent).toMatch(/^clock · /);
    expect(rows[1]?.querySelector("tr-progress")?.hasAttribute("aria-valuenow")).toBe(false);
    expect(rows[2]?.querySelector("tr-progress")?.getAttribute("aria-valuenow")).toBe("0.25");
    expect([...rows[0]?.querySelectorAll<HTMLButtonElement>(".tr-notifications-action") ?? []].map(t => [t.textContent?.trim(), t.disabled]))
      .toEqual([["Run notes.undo", false], ["Run clock.reset", true]]);
    expect(rows[0]?.querySelector<HTMLButtonElement>("button.tr-notifications-open")?.disabled).toBe(false);
    expect(rows[1]?.querySelector("button.tr-notifications-open")).toBeNull();
  });

  it("runs an action or the open command and closes, dismisses one, clears all and switches Do not disturb", async () => {
    service.stateValue.set(new NotificationState([
      NotificationsFixture.createNotification(2, "notes.saved", "Saved", { open: "notes.open", actions: ["notes.undo"], isRead: true }),
      NotificationsFixture.createNotification(1, "clock.sync", "Syncing", { progress: 0.5, isRead: true })
    ], false, [], 0));
    const fixture = await NotificationsFixture.renderAsync();

    (await NotificationsFixture.openAsync(fixture)).querySelector<HTMLButtonElement>(".tr-notifications-action")?.click();
    await fixture.whenStable();
    const closedAfterAction = NotificationsFixture.findPopover();
    (await NotificationsFixture.openAsync(fixture)).querySelector<HTMLButtonElement>("button.tr-notifications-open")?.click();
    await fixture.whenStable();
    const list = await NotificationsFixture.openAsync(fixture);
    await TooltipFixture.expectTooltipAsync(list.querySelector<HTMLButtonElement>(".tr-notifications-dismiss") as HTMLButtonElement, "Dismiss");
    list.querySelector<HTMLButtonElement>(".tr-notifications-dismiss")?.click();
    list.querySelector<HTMLButtonElement>(".tr-notifications-clear")?.click();
    list.querySelector<HTMLInputElement>(".tr-notifications-quiet .tr-checkbox-box")?.click();

    expect(closedAfterAction).toBeNull();
    expect(service.calls).toEqual(["run notes.undo", "run notes.open", "dismiss 2", "clear", "quiet true"]);
  });

  it("checks its Do not disturb box while Do not disturb is on", async () => {
    const fixture = await NotificationsFixture.renderAsync();

    const list = await NotificationsFixture.openAsync(fixture);
    const box = list.querySelector<HTMLInputElement>(".tr-notifications-quiet .tr-checkbox-box");
    const unchecked = box?.checked;
    service.stateValue.set(new NotificationState([], true, [], 0));
    await fixture.whenStable();

    expect([unchecked, box?.checked, list.querySelector(".tr-notifications-quiet .tr-checkbox-text")?.textContent?.trim()]).toEqual([false, true, "Do not disturb"]);
  });

  it("disables Clear all while every notification is in progress and reports an action that fails", async () => {
    service.stateValue.set(new NotificationState([NotificationsFixture.createNotification(1, "clock.sync", "Syncing", { progress: 0.5, actions: ["clock.cancel"], isRead: true })], false, [], 0));
    service.failure = new Error("The clock stopped.");
    const fixture = await NotificationsFixture.renderAsync();

    const list = await NotificationsFixture.openAsync(fixture);
    const isClearDisabled = list.querySelector<HTMLButtonElement>(".tr-notifications-clear")?.disabled;
    list.querySelector<HTMLButtonElement>(".tr-notifications-action")?.click();
    await vi.waitFor(() => expect(service.errors.length).toBe(1));

    expect(isClearDisabled).toBe(true);
    expect((service.errors[0] as Error).message).toBe("The clock stopped.");
  });
});
