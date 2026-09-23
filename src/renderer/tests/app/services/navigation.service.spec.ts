/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { AppView } from "../../../src/app/enums/app-view";
import { SettingsSection } from "../../../src/app/enums/settings-section";
import { NavigationService } from "../../../src/app/services/navigation.service";
import { ImageSource } from "../../../src/app/models/image-source";

describe("NavigationService", () => {
  it("reuses image tabs, closes neighbours and leaves an active settings tab alone", () => {
    const navigation = TestBed.inject(NavigationService);
    const first = new ImageSource("1", "same.png", "D:/one.png", null);
    const second = new ImageSource("2", "same.png", "D:/two.png", null);
    navigation.openImage(first);
    const a = navigation.activeImage()!;
    navigation.openImage(second);
    const b = navigation.activeImage()!;
    navigation.openImage(new ImageSource("different-key", "same.png", "D:/one.png", null));
    expect(navigation.images()).toHaveLength(2);
    expect(navigation.activeImage()).toBe(a);
    navigation.openSettings();
    navigation.showImage(b.id);
    navigation.closeSettingsTab();
    expect(navigation.view()).toBe(AppView.Image);
    navigation.closeImage(b.id);
    expect(navigation.activeImage()).toBe(a);
    navigation.openSettings();
    navigation.closeImage(a.id);
    expect(navigation.view()).toBe(AppView.Settings);
    navigation.openImage(first);
    navigation.closeImages();
    expect(navigation.images()).toHaveLength(0);
    expect(navigation.view()).toBe(AppView.Chat);
  });

  it("owns a draft image URL until its tab closes", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tab-owned");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const file = new File(["image"], "draft.png", { type: "image/png" });
    const navigation = TestBed.inject(NavigationService);
    const source = new ImageSource("draft", "draft.png", null, "blob:composer-owned", file);
    navigation.openImage(source);
    const document = navigation.activeImage()!;
    expect(document.data.image.data).toBe("blob:tab-owned");
    navigation.openImage(source);
    expect(create).toHaveBeenCalledTimes(1);
    navigation.closeImage(document.id);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:tab-owned");
    create.mockRestore();
    revoke.mockRestore();
  });
  it("opens settings on a section, switches sections, and returns to the chat", () => {
    const navigation = TestBed.inject(NavigationService);
    expect(navigation.view()).toBe(AppView.Chat);

    navigation.openSettings(SettingsSection.Teammates);
    expect(navigation.view()).toBe(AppView.Settings);
    expect(navigation.section()).toBe(SettingsSection.Teammates);

    navigation.showSection(SettingsSection.About);
    navigation.closeSettings();
    expect(navigation.settingsOpen()).toBe(true);
    navigation.openSettings();
    expect(navigation.section()).toBe(SettingsSection.About);
    expect(navigation.view()).toBe(AppView.Settings);
    navigation.closeSettingsTab();
    expect(navigation.settingsOpen()).toBe(false);
    expect(navigation.view()).toBe(AppView.Chat);
  });
});
