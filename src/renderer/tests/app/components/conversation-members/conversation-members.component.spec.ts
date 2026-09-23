/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { TeammateFixture } from "../../../fixtures/teammate-fixture";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { ConversationMembersComponent } from "../../../../src/app/components/conversation-members/conversation-members.component";

describe("ConversationMembersComponent", () => {
  it("shows the default and members, adds another teammate and removes a member", async () => {
    const data = new TeammateFixture();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(ConversationMembersComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll("tr-teammate-avatar")).toHaveLength(2);
    expect(Array.from(root.querySelectorAll("[data-avatar-color]")).map(t => t.getAttribute("data-avatar-color"))).toEqual(["Default", "Cyan"]);
    root.querySelector<HTMLButtonElement>('[aria-label="Add conversation member"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(t => t.textContent?.trim() === "Bob")!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll("tr-teammate-avatar")).toHaveLength(3);
    expect(Array.from(root.querySelectorAll("[data-avatar-color]")).map(t => t.getAttribute("data-avatar-color"))).toEqual(["Default", "Cyan", "Purple"]);
    root.querySelector<HTMLButtonElement>('[aria-label="Alice"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(t => t.textContent?.includes("Remove from conversation"))!.click();
    await fixture.whenStable();
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["bob"]);
  });
});
