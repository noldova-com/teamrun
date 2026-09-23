/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { AuthStatus, MethodName, ProviderAccount } from "@noldova/teamrun-protocol";
import { SampleData } from "../../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { SettingsProvidersComponent } from "../../../../src/app/components/settings-providers/settings-providers.component";

describe("SettingsProvidersComponent", () => {
  it("shows configured connections in a table, with readable states and the actual check error", async () => {
    const failed = new ProviderAccount("g", "grok", "Personal", "D:/profile", AuthStatus.Error, null, null, "t", "Use a managed profile", "t");
    const bridge = SampleData.createBridge().answer(MethodName.ProviderAccountList, () => [SampleData.account.toJson(), failed.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(SettingsProvidersComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll("th")).map(t => t.textContent?.trim())).toEqual(["Provider", "Account", "Status", "Actions"]);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(Array.from(root.querySelectorAll("tbody tr")).every(t => t.textContent?.includes("This computer"))).toBe(true);
    expect(root.textContent).toContain("Connected");
    expect(root.textContent).toContain("Connection error");
    expect(root.textContent).toContain("Use a managed profile");
    expect(root.textContent).not.toContain("loggedIn");
    expect(root.querySelector("form")).toBeNull();
    root.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    expect(document.querySelector("tr-provider-dialog")).not.toBeNull();
    TestBed.inject(MatDialog).closeAll();
  });

  it("checks sign-in and requires confirmation before removing a saved connection", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.ProviderAccountCheck, () => SampleData.account.toJson())
      .answer(MethodName.ProviderAccountDelete, () => null);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    const fixture = TestBed.createComponent(SettingsProvidersComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLButtonElement>("tbody button")[0]!.click();
    await fixture.whenStable();
    expect(bridge.methods).toContain(MethodName.ProviderAccountCheck);
    root.querySelectorAll<HTMLButtonElement>("tbody button")[1]!.click();
    await fixture.whenStable();
    expect(bridge.methods).not.toContain(MethodName.ProviderAccountDelete);
    TestBed.inject(MatDialog).openDialogs[0]!.close(true);
    await vi.waitFor(() => expect(store.accounts()).toHaveLength(0));
    await fixture.whenStable();
    expect(root.textContent).toContain("No provider connections yet");
  });
});
