/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  QualifiedName,
  SettingDefinition,
  SettingEntry,
  SettingKey,
  SettingLocality,
  SettingScope,
  SettingType,
  SettingChange,
  SettingsSnapshot
} from "@noldova/teamrun-shell-protocol";

import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import { SettingsService } from "../../../src/app/services/settings.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("SettingsService", () => {
  const mode = QualifiedName.parse("shell.mode");
  const size = QualifiedName.parse("shell.panelSize");
  const definitions = [
    new SettingDefinition(mode, "Mode", "Light or dark.", SettingType.text(10), "System", SettingLocality.Shared, [], "Appearance", "Theme"),
    new SettingDefinition(size, "Size", "Text size.", SettingType.number(12, 18, 1), 13, SettingLocality.Device, [], "Appearance", "Text")
  ];
  const snapshot = (modeValue: JsonValue): unknown => ({
    payload: new SettingsSnapshot(definitions, [new SettingEntry(mode, modeValue, modeValue !== "System"), new SettingEntry(size, 13, false)]).toJson()
  });
  const change = (name: QualifiedName, value: JsonValue, scope: SettingScope | null = null, isSet: boolean = true): JsonValue =>
    new SettingChange(new SettingKey(name, scope), value, isSet).toJson();
  let bridge: DesktopBridgeFixture;
  let service: SettingsService;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    bridge.responses.set("shell.settings", snapshot("Dark"));
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("loads the definitions and the values in effect, and reads them by name", async () => {
    const value = service.value("shell.mode");
    expect([service.definitions().length, value(), service.read("shell.mode")]).toEqual([0, undefined, undefined]);

    await service.loadAsync();

    expect(service.definitions().map(t => t.name.text)).toEqual(["shell.mode", "shell.panelSize"]);
    expect([value(), service.read("shell.panelSize"), service.read("shell.other")]).toEqual(["Dark", 13, undefined]);
    expect(["shell.mode", "shell.panelSize", "shell.other"].map(t => service.isSet(t)())).toEqual([true, false, false]);
    expect(bridge.requests).toEqual([["shell.settings", {}]]);
  });

  it("asks the runtime to set and reset a value, for the application or a scope", async () => {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c1");

    await service.setAsync("shell.mode", "Light");
    await service.setAsync("chat.sendWithEnter", false, scope);
    await service.resetAsync("shell.mode");
    await service.resetAsync("chat.sendWithEnter", scope);

    expect(bridge.requests).toEqual([
      ["shell.setSetting", { name: "shell.mode", value: "Light" }],
      ["shell.setSetting", { name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c1" }, value: false }],
      ["shell.resetSetting", { name: "shell.mode" }],
      ["shell.resetSetting", { name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c1" } }]
    ]);
  });

  it("asks the runtime for a setting's entry, for the application or a scope", async () => {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c1");
    bridge.responses.set("shell.readSetting", { payload: new SettingEntry(mode, "Light", true).toJson() });

    const entries = [await service.readAsync("shell.mode", null), await service.readAsync("shell.mode", scope)];

    expect(entries).toEqual([new SettingEntry(mode, "Light", true), new SettingEntry(mode, "Light", true)]);
    expect(bridge.requests).toEqual([
      ["shell.readSetting", { name: "shell.mode" }],
      ["shell.readSetting", { name: "shell.mode", scope: { name: "chat.conversation", id: "c1" } }]
    ]);
  });

  it("rejects a change the runtime did not confirm because the connection ended as an action not confirmed, and passes any other failure on", async () => {
    bridge.responses.set("shell.setSetting", { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    bridge.responses.set("shell.resetSetting", { failure: { code: "Unavailable", message: "The runtime did not answer shell.resetSetting in time." } });

    const set = await service.setAsync("shell.mode", "Light").catch((error: unknown) => error);
    const reset = await service.resetAsync("shell.mode").catch((error: unknown) => error);

    expect([set instanceof ActionNotConfirmedException, (set as Error).message])
      .toEqual([true, "The runtime did not confirm the change to the setting shell.mode because the connection to it ended."]);
    expect([reset instanceof RuntimeRequestException, (reset as RuntimeRequestException).code]).toEqual([true, "Unavailable"]);
  });

  it("follows changes, keeping only those without a scope as values and whether each is stored, and tells each listener until it stops", async () => {
    await service.loadAsync();
    const isModeSet = service.isSet("shell.mode");
    const heard: string[] = [];
    const stop = service.onChanged(t => heard.push(`${t.key.name.text}=${String(t.value)}${t.key.scope === null ? "" : ` in ${t.key.scope.id}`}`));

    bridge.publishEvent("shell.settingsChanged", change(mode, "Light"));
    bridge.publishEvent("shell.settingsChanged", change(mode, "Dark", new SettingScope(QualifiedName.parse("chat.conversation"), "c1")));
    bridge.publishEvent("shell.notifications", { notifications: [] });
    stop();
    bridge.publishEvent("shell.settingsChanged", change(size, 15));
    const wasModeSet = isModeSet();
    bridge.publishEvent("shell.settingsChanged", change(mode, "System", null, false));

    expect(heard).toEqual(["shell.mode=Light", "shell.mode=Dark in c1"]);
    expect([service.read("shell.mode"), service.read("shell.panelSize")]).toEqual(["System", 15]);
    expect([wasModeSet, isModeSet(), service.isSet("shell.panelSize")()]).toEqual([true, false, true]);
  });

  it("keeps a change that arrives during a load over the loaded value, and ignores a load that a later one overtook", async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.settings", new Promise(resolve => answerFirst = resolve));
    const first = service.loadAsync();
    bridge.responses.set("shell.settings", snapshot("System"));
    const second = service.loadAsync();
    bridge.publishEvent("shell.settingsChanged", change(size, 16));

    await second;
    answerFirst(snapshot("Dark"));
    await first;

    expect([service.read("shell.mode"), service.read("shell.panelSize")]).toEqual(["System", 16]);
    bridge.responses.set("shell.settings", snapshot("Light"));
    await service.loadAsync();
    expect([service.read("shell.mode"), service.read("shell.panelSize")]).toEqual(["Light", 13]);
  });
});
