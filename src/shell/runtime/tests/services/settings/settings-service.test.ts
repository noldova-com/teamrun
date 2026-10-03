/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  FailureCode,
  QualifiedName,
  SettingDefinition,
  SettingKey,
  SettingLocality,
  SettingScope,
  SettingType,
  SettingValue
} from "@noldova/teamrun-shell-protocol";
import { SettingException } from "@noldova/teamrun-shell-runtime";

import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class SettingsServiceTests {
  private static readonly SEND: QualifiedName = QualifiedName.parse("chat.sendWithEnter");
  private static readonly QUIET: QualifiedName = QualifiedName.parse("chat.quiet");
  private static readonly CONVERSATION: QualifiedName = QualifiedName.parse("chat.conversation");
  private static readonly PROJECT: QualifiedName = QualifiedName.parse("projects.project");
  private static readonly DEFINITIONS: readonly SettingDefinition[] = [
    new SettingDefinition(SettingsServiceTests.SEND, "Send with Enter", "Sends on Enter.", SettingType.boolean(), true, SettingLocality.Shared,
      [SettingsServiceTests.CONVERSATION, SettingsServiceTests.PROJECT], "Chat", "Composer"),
    new SettingDefinition(SettingsServiceTests.QUIET, "Quiet", "Holds back sounds.", SettingType.boolean(), false, SettingLocality.Device, [], "Chat", "Sounds")
  ];

  @TestMethod
  public async readsTheDefaultUntilAValueIsSetAndAgainAfterAReset(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const key = new SettingKey(SettingsServiceTests.SEND);
    const changes: string[] = [];
    settings.service.onChanged(t => changes.push(JSON.stringify(t.toJson())));

    const before = settings.service.read(key);
    settings.service.write(new SettingValue(key, false));
    const set = settings.service.read(key);
    const entry = settings.service.snapshot(null).entries.find(t => t.name.text === SettingsServiceTests.SEND.text);
    settings.service.reset(key);

    Assert.areEqual("true,false,true", [before, set, settings.service.read(key)].join(","));
    Assert.areEqual("false,true", [entry?.value, entry?.isSet].join(","));
    Assert.areEqual(JSON.stringify(["{\"name\":\"chat.sendWithEnter\",\"value\":false}", "{\"name\":\"chat.sendWithEnter\",\"value\":true}"]), JSON.stringify(changes));
    Assert.isFalse(settings.service.snapshot(null).entries.some(t => t.isSet));
  }

  @TestMethod
  public async keepsADeviceSettingForEachDeviceAndAsksForOne(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const quiet = (device: string | null): SettingKey => new SettingKey(SettingsServiceTests.QUIET, null, device);

    settings.service.write(new SettingValue(quiet("d1"), true));
    settings.service.write(new SettingValue(quiet("d2"), false));
    const missing = Assert.throws(() => settings.service.write(new SettingValue(quiet(null), true)), SettingException);
    const scoped = Assert.throws(() => settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.QUIET, new SettingScope(SettingsServiceTests.CONVERSATION, "c1"), "d1"), true)),
      SettingException);

    Assert.areEqual("true,false,false,false", [quiet("d1"), quiet("d2"), quiet("d3"), quiet(null)].map(t => settings.service.read(t)).join(","));
    Assert.areEqual("d1=true,d2=false", [...settings.service.readDevices(SettingsServiceTests.QUIET)].map(([device, value]) => `${device}=${String(value)}`).join(","));
    Assert.areEqual("true,false", [settings.service.snapshot("d1"), settings.service.snapshot(null)].map(t => t.entries.find(u => u.name.text === SettingsServiceTests.QUIET.text)?.value).join(","));
    Assert.areEqual(`${FailureCode.InvalidParams},${FailureCode.InvalidParams}`, [missing.code, scoped.code].join(","));
  }

  @TestMethod
  public async keepsOneSharedValueWhateverDeviceAWriteNames(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const changes: SettingValue[] = [];
    settings.service.onChanged(t => changes.push(t));

    settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND, null, "d1"), false));

    Assert.areEqual(false, settings.service.read(new SettingKey(SettingsServiceTests.SEND, null, "d2")));
    Assert.isNull(changes[0]?.key.device);
  }

  @TestMethod
  public async resolvesAScopeThroughItsEnclosingScopesThenTheApplication(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const conversation = new SettingScope(SettingsServiceTests.CONVERSATION, "c1");
    const project = new SettingScope(SettingsServiceTests.PROJECT, "p1");
    const read = (): string => String(settings.service.read(new SettingKey(SettingsServiceTests.SEND, conversation)));
    const results: string[] = [read()];

    settings.service.setScopeParent(conversation, project);
    settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND, project), false));
    results.push(read());
    settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND, conversation), true));
    results.push(read());
    settings.service.removeScope(conversation);
    results.push(read());
    settings.service.setScopeParent(conversation, null);
    results.push(read());

    Assert.areEqual("true,false,true,true,true", results.join(","));
  }

  @TestMethod
  public async stopsAtAScopeCycleAndSkipsScopesASettingDoesNotList(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const conversation = new SettingScope(SettingsServiceTests.CONVERSATION, "c1");
    const thread = new SettingScope(QualifiedName.parse("chat.thread"), "t1");
    settings.service.setScopeParent(conversation, thread);
    settings.service.setScopeParent(thread, conversation);
    settings.database.run("INSERT INTO setting_values (name, scope_name, scope_id, device, value) VALUES (?, ?, ?, ?, ?)", SettingsServiceTests.SEND.text, "chat.thread", "t1", "", "false");

    Assert.areEqual(true, settings.service.read(new SettingKey(SettingsServiceTests.SEND, conversation)));
  }

  @TestMethod
  public async refusesAnUnknownSettingAValueItsTypeRefusesAndAScopeItDoesNotList(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const unknown = QualifiedName.parse("chat.speed");

    const failures = [
      Assert.throws(() => settings.service.read(new SettingKey(unknown)), SettingException),
      Assert.throws(() => settings.service.readDevices(unknown), SettingException),
      Assert.throws(() => settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND), "yes")), SettingException),
      Assert.throws(() => settings.service.reset(new SettingKey(SettingsServiceTests.SEND, new SettingScope(QualifiedName.parse("chat.thread"), "t1"))), SettingException)
    ];

    Assert.areEqual("NotFound,NotFound,InvalidParams,InvalidParams", failures.map(t => t.code).join(","));
    Assert.areEqual("No setting named chat.speed is declared.", failures[0]?.message);
  }

  @TestMethod
  public async ignoresAndReportsOnceAStoredValueThatNoLongerFits(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const insert = (name: QualifiedName, device: string, value: string): void => {
      settings.database.run("INSERT INTO setting_values (name, scope_name, scope_id, device, value) VALUES (?, '', '', ?, ?)", name.text, device, value);
    };
    insert(SettingsServiceTests.SEND, "", "\"yes\"");
    insert(SettingsServiceTests.QUIET, "d1", "{not json");
    insert(SettingsServiceTests.QUIET, "d2", "true");

    const shared = settings.service.read(new SettingKey(SettingsServiceTests.SEND));
    settings.service.read(new SettingKey(SettingsServiceTests.SEND));
    const devices = [...settings.service.readDevices(SettingsServiceTests.QUIET).keys()];

    Assert.areEqual(true, shared);
    Assert.areEqual("d2", devices.join(","));
    Assert.areEqual(2, settings.diagnostics.text.split("\n").filter(t => t.length > 0).length);
    Assert.isTrue(settings.diagnostics.text.includes("The stored value of the setting chat.sendWithEnter for the scope \"\" and device \"\" no longer fits"));
  }

  @TestMethod
  public async stopsTellingAListenerOnceItIsDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(SettingsServiceTests.DEFINITIONS);
    const changes: SettingValue[] = [];
    const listening = settings.service.onChanged(t => changes.push(t));

    settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND), false));
    listening[Symbol.dispose]();
    settings.service.write(new SettingValue(new SettingKey(SettingsServiceTests.SEND), true));

    Assert.areEqual(1, changes.length);
    Assert.areEqual("chat.sendWithEnter", settings.service.define(SettingsServiceTests.SEND).name.text);
  }
}
