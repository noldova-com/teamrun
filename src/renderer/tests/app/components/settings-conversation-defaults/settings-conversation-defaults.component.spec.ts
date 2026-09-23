/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { AuthStatus, ErrorCode, MethodName, ProviderAccount, ProviderListModelsParams, ProviderModel } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { DeferredResponse } from "../../../fixtures/deferred-response";
import { ComposerSettings } from "../../../../src/app/models/composer-settings";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { SettingsConversationDefaultsComponent } from "../../../../src/app/components/settings-conversation-defaults/settings-conversation-defaults.component";

describe("SettingsConversationDefaultsComponent", () => {
  it("filters accounts by provider, clears dependent choices and ignores a late account catalog", async () => {
    MemoryStorage.install(window);
    const second = new ProviderAccount("a2", "claude", "Home", "D:/home", AuthStatus.LoggedIn, null, null, null, null, "t");
    let delayed: DeferredResponse | null = null;
    const bridge = SampleData.createBridge().answer(MethodName.ProviderAccountList, () => [SampleData.account.toJson(), second.toJson()])
      .answer(MethodName.ProviderModelCatalog, payload => {
        const params = ProviderListModelsParams.fromJson(payload);
        if (params.providerAccountId === "a2") {
          expect(params.provider).toBe("claude");
          return delayed?.promise ?? [new ProviderModel("other", "Other model", "", ["low"], true, null, true).toJson()];
        }
        return [new ProviderModel("pin", "Pinned model", "", ["high"], true, null, true).toJson()];
      });
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const preferences = TestBed.inject(PreferencesService);
    preferences.setDefaultComposer(new ComposerSettings("codex", "pin", "high", "a1"));
    const fixture = TestBed.createComponent(SettingsConversationDefaultsComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const pick = async (field: string, label: string): Promise<void> => {
      const select = root.querySelector<HTMLElement>(`mat-select[aria-label="${field}"]`)!;
      select.click();
      await fixture.whenStable();
      const options = Array.from(document.getElementById(select.getAttribute("aria-controls")!)!.querySelectorAll<HTMLElement>("mat-option"));
      if (field === "Account")
        expect(options.map(t => t.textContent?.trim())).toEqual(
          preferences.defaultComposer()?.provider === "claude"
            ? ["Home · This computer", "Default sign-in · This computer"]
            : ["Work · This computer", "Default sign-in · This computer"]);
      options.find(t => t.textContent?.trim() === label)!.click();
      await fixture.whenStable();
    };
    await pick("Provider", "Claude Code");
    expect(preferences.defaultComposer()?.provider).toBe("claude");
    expect(preferences.defaultComposer()?.providerAccountId).toBeNull();
    expect(preferences.defaultComposer()?.model).toBeNull();
    expect(preferences.defaultComposer()?.effort).toBeNull();
    await pick("Account", "Home · This computer");
    expect(preferences.defaultComposer()?.providerAccountId).toBe("a2");
    await vi.waitFor(() => expect(root.querySelector('mat-select[aria-label="Model"]')?.textContent).toContain("Default model"));
    delayed = new DeferredResponse();
    bridge.answer(MethodName.ProviderModelCatalog, payload => ProviderListModelsParams.fromJson(payload).providerAccountId === "a2"
      ? delayed!.promise : [new ProviderModel("pin", "Pinned model", "", ["high"], true, null, true).toJson()]);
    const refresh = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(t => t.textContent?.trim() === "Refresh models")!;
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    refresh.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.querySelector('mat-select[aria-label="Model"]')?.getAttribute("aria-disabled")).toBe("true"));
    await pick("Provider", "Codex");
    await pick("Account", "Work · This computer");
    delayed.resolve([new ProviderModel("late", "Late model", "", ["low"], true, null, true).toJson()]);
    await fixture.whenStable();
    expect(preferences.defaultComposer()?.providerAccountId).toBe("a1");
    expect(root.textContent).not.toContain("Late model");
  });

  it("refreshes for the selected account, uses model efforts, and retains choices after failure", async () => {
    MemoryStorage.install(window);
    const bridge = SampleData.createBridge().answer(MethodName.ProviderModelCatalog, payload => {
      const account = ProviderListModelsParams.fromJson(payload).providerAccountId;
      return [new ProviderModel("pin", account ? "Account model" : "Pinned model", "", account ? ["low"] : ["high"], true, null, true),
        new ProviderModel("plain", "Plain model", "", [], false, null, false)].map(t => t.toJson());
    });
    TestBed.configureTestingModule({ imports: [SettingsConversationDefaultsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const preferences = TestBed.inject(PreferencesService);
    preferences.setDefaultComposer(new ComposerSettings("codex", "pin", "high", null));
    const fixture = TestBed.createComponent(SettingsConversationDefaultsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const pick = async (index: number, label: string): Promise<void> => {
      root.querySelectorAll<HTMLElement>("mat-select")[index]!.click();
      await fixture.whenStable();
      Array.from(document.querySelectorAll<HTMLElement>("mat-option")).find(t => t.textContent?.trim() === label)!.click();
      await fixture.whenStable();
    };
    await vi.waitFor(() => { fixture.detectChanges(); expect(root.textContent).toContain("Pinned model"); });
    expect(Array.from(root.querySelectorAll("mat-select")).map(t => t.getAttribute("aria-label"))).toEqual(["Provider", "Account", "Model", "Effort"]);
    await pick(1, "Work · This computer");
    await vi.waitFor(() => { fixture.detectChanges(); expect(root.textContent).toContain("Account model"); });
    expect(preferences.defaultComposer()?.model).toBe("pin");
    expect(preferences.defaultComposer()?.effort).toBeNull();
    await pick(3, "low");
    expect(preferences.defaultComposer()?.effort).toBe("low");
    bridge.fail(MethodName.ProviderModelCatalog, ErrorCode.Unavailable, "offline");
    Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(t => t.textContent?.trim() === "Refresh models")!.click();
    await fixture.whenStable();
    await vi.waitFor(() => { fixture.detectChanges(); expect(root.textContent).toContain("could not be refreshed"); });
    expect(root.textContent).toContain("Account model");
    await pick(2, "Plain model");
    expect(preferences.defaultComposer()?.model).toBe("plain");
    expect(preferences.defaultComposer()?.effort).toBeNull();
  });
});
