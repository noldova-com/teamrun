/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { Conversation, MethodName } from "@noldova/teamrun-protocol";
import { TeammateFixture } from "../../../fixtures/teammate-fixture";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { SettingsTeammatesComponent } from "../../../../src/app/components/settings-teammates/settings-teammates.component";

describe("SettingsTeammatesComponent", () => {
  it("creates and opens a conversation with the teammate as its saved responder", async () => {
    const data = new TeammateFixture();
    data.bridge.answer(MethodName.ConversationCreate, () => new Conversation("c2", "p1", "New conversation", "t", "t").toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    const fixture = TestBed.createComponent(SettingsTeammatesComponent);
    await fixture.whenStable();
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>("tbody tr:first-child button"))
      .find(t => t.textContent?.trim() === "New conversation")!.click();
    await fixture.whenStable();
    expect(store.selectedConversationId()).toBe("c2");
    expect(store.membersOf("c2").map(t => t.teammateId)).toEqual(["bob"]);
    expect(TestBed.inject(PreferencesService).composerFor("c2")?.responderTeammateId).toBe("bob");
  });
  it("opens create/edit dialogs, dims unavailable teammates, and confirms deletion", async () => {
    const data = new TeammateFixture();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(SettingsTeammatesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(Array.from(root.querySelectorAll("tbody [data-avatar-color]")).slice(0, 2)
      .map(t => t.getAttribute("data-avatar-color"))).toEqual(["Purple", "Cyan"]);
    expect(root.querySelector(".tr-teammate-unavailable")?.textContent).toContain("Offline");
    root.querySelector<HTMLButtonElement>('[aria-label="Add teammate"]')!.click();
    await fixture.whenStable();
    expect(document.querySelector("tr-teammate-dialog")).not.toBeNull();
    TestBed.inject(MatDialog).closeAll();
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.querySelector("tr-teammate-dialog")).toBeNull());
    root.querySelectorAll<HTMLButtonElement>("tbody button")[0]!.click();
    await fixture.whenStable();
    expect(document.querySelector<HTMLInputElement>('tr-teammate-dialog input')?.value).toBe("Bob");
    TestBed.inject(MatDialog).closeAll();
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.querySelector("tr-teammate-dialog")).toBeNull());
    Array.from(root.querySelectorAll<HTMLButtonElement>("tbody tr:first-child button")).find(t => t.textContent?.trim() === "Delete teammate")!.click();
    await fixture.whenStable();
    expect(data.bridge.methods).not.toContain(MethodName.TeammateDelete);
    const dialog = TestBed.inject(MatDialog).openDialogs[0]!;
    dialog.close(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(data.bridge.methods).toContain(MethodName.TeammateDelete));
    await fixture.whenStable();
    expect(root.textContent).not.toContain("Bob");
  });
});
