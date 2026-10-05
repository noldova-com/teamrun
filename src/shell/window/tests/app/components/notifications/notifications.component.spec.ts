/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { userEvent } from "vitest/browser";

import { NotificationState } from "@noldova/teamrun-shell-protocol";

import { NotificationsFixture } from "../../../fixtures/notifications.fixture";

describe("NotificationsComponent", () => {
  let service: NotificationsFixture;

  beforeEach(() => {
    service = NotificationsFixture.install();
  });

  afterEach(() => NotificationsFixture.remove());

  it("shows a bell with its unread count, capped at 9+, and a silenced bell while Do not disturb is on", async () => {
    const fixture = await NotificationsFixture.renderAsync();
    const quietLabel = (): string | null => NotificationsFixture.item(fixture).getAttribute("aria-label");
    const empty = [NotificationsFixture.item(fixture).textContent?.trim(), quietLabel()];

    service.stateValue.set(new NotificationState(Array.from({ length: 12 }, (_, index) => NotificationsFixture.notification(index + 1, "clock.alarm", `Alarm ${index}`)), true, [], 0));
    await fixture.whenStable();

    expect(empty).toEqual(["notifications", "Notifications"]);
    expect([NotificationsFixture.item(fixture).querySelector(".tr-notifications-icon")?.textContent, NotificationsFixture.item(fixture).querySelector(".tr-notifications-count")?.textContent]).toEqual(["notifications_off", "9+"]);
    expect(quietLabel()).toBe("Notifications, 12 unread, Do not disturb");
    await NotificationsFixture.expectTooltipAsync(NotificationsFixture.item(fixture), "Notifications, 12 unread, Do not disturb");
  });

  it("opens its list, marking everything read only when something is unread, and closes on a second click, Escape and a click outside", async () => {
    service.stateValue.set(new NotificationState([NotificationsFixture.notification(1, "clock.alarm", "Alarm")], false, [], 0));
    const fixture = await NotificationsFixture.renderAsync();

    const opened = await NotificationsFixture.openAsync(fixture);
    const expanded = NotificationsFixture.item(fixture).getAttribute("aria-expanded");
    NotificationsFixture.item(fixture).click();
    await fixture.whenStable();
    const afterSecondClick = NotificationsFixture.popover();
    service.stateValue.set(new NotificationState([NotificationsFixture.notification(1, "clock.alarm", "Alarm", { isRead: true })], false, [], 0));
    await NotificationsFixture.openAsync(fixture);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();
    const focusAfterEscape = document.activeElement;
    await NotificationsFixture.openAsync(fixture);
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await fixture.whenStable();

    expect(opened.getAttribute("aria-label")).toBe("Notifications");
    expect(expanded).toBe("true");
    expect(afterSecondClick).toBeNull();
    expect(focusAfterEscape).toBe(NotificationsFixture.item(fixture));
    expect(NotificationsFixture.popover()).toBeNull();
    expect(service.calls).toEqual(["read"]);
  });

  it("stays open for other keys and closes when something around the item scrolls", async () => {
    const fixture = await NotificationsFixture.renderAsync();

    await NotificationsFixture.openAsync(fixture);
    await userEvent.keyboard("{ArrowDown}");
    await fixture.whenStable();
    const isOpenAfterKey = NotificationsFixture.popover() !== null;
    (fixture.nativeElement as HTMLElement).style.marginTop = "40px";
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event("scroll"));
    await fixture.whenStable();

    expect(isOpenAfterKey).toBe(true);
    expect(NotificationsFixture.popover()).toBeNull();
  });
});
