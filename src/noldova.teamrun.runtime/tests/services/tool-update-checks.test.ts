/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
import { RequestContext } from "@noldova/desktop.runtime";
import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
import { ProviderKindRegistry } from "@noldova/teamrun.core";
import { HostedMigrations, RuntimePart, ToolUpdateChecks } from "@noldova/teamrun.runtime";

import { CheckpointsModule } from "../fixtures/checkpoints-module.fixture.js";
import { DeclaredSettings } from "../fixtures/declared-settings.fixture.js";
import { GivenRegistries } from "../fixtures/given-registries.fixture.js";
import { InstalledAdapter } from "../fixtures/installed-adapter.fixture.js";
import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingInstallation } from "../fixtures/recording-installation.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class ToolUpdateChecksTests {
  private static readonly setting: string = "desktop.updateChecks";

  @TestMethod
  public followsTheChangesOfTheDevicesSettingChecksOnlyOnceUnderAtStartAndCountsAResetAsAutomatic(): void {
    const settings = ToolUpdateChecksTests.settingsOf("OnRequest");
    const checks = new ToolUpdateChecks(settings);
    let allowed = 0;
    checks.onAllowed(() => allowed++);
    const takes = (value: JsonValue): string => {
      ToolUpdateChecksTests.change(settings, value);
      return [checks.takeCheck(), checks.takeCheck()].join(",");
    };

    Assert.areEqual(ToolUpdateChecksTests.setting, settings.callsOf("onChanged").map(t => t[0]).join(","));
    Assert.isFalse(checks.takeCheck());
    Assert.areEqual("true,false", takes("AtStart"));
    Assert.areEqual("true,true", takes("Automatic"));
    Assert.areEqual("false,false", takes("OnRequest"));
    Assert.areEqual("false,false", takes("AtStart"));
    Assert.areEqual("true,true", takes(null));
    Assert.areEqual(3, allowed);
  }

  @TestMethod
  public takesTheValueReadGivesAtConstructionAndTheDefaultAsAutomatic(): void {
    const atStart = new ToolUpdateChecks(ToolUpdateChecksTests.settingsOf("AtStart"));
    const onRequest = new ToolUpdateChecks(ToolUpdateChecksTests.settingsOf("OnRequest"));
    const automatic = new ToolUpdateChecks(ToolUpdateChecksTests.settingsOf("Automatic"));
    const unreadable = new ToolUpdateChecks(ToolUpdateChecksTests.settingsOf(null));

    Assert.areEqual("true,false", [atStart.takeCheck(), atStart.takeCheck()].join(","));
    Assert.isFalse(onRequest.takeCheck());
    Assert.areEqual("true,true", [automatic.takeCheck(), automatic.takeCheck()].join(","));
    Assert.areEqual("true,true", [unreadable.takeCheck(), unreadable.takeCheck()].join(","));
  }

  @TestMethod
  public async listsTheInstallationsWithoutTheirLatestVersionsWhileTheSettingIsOnRequest(): Promise<void> {
    const checks = await ToolUpdateChecksTests.checksAsync("OnRequest", async listAsync => {
      await listAsync();
      await listAsync();
    });

    Assert.areEqual("false,false", checks);
  }

  @TestMethod
  public async checksTheLatestVersionsAtEveryListingWhileTheSettingIsTheDefault(): Promise<void> {
    const checks = await ToolUpdateChecksTests.checksAsync("Automatic", async listAsync => {
      await listAsync();
      await listAsync();
    });

    Assert.areEqual("true,true", checks);
  }

  @TestMethod
  public async checksTheLatestVersionsAtTheFirstListingOnlyWhenTheDeviceHoldsAtStart(): Promise<void> {
    const checks = await ToolUpdateChecksTests.checksAsync("AtStart", async listAsync => {
      await listAsync();
      await listAsync();
    });

    Assert.areEqual("true,false", checks);
  }

  @TestMethod
  public async readsTheLatestVersionsOfTheListedInstallationsWhenTheDevicesAutomaticArrivesAfterTheFirstListing(): Promise<void> {
    const checks = await ToolUpdateChecksTests.checksAsync("OnRequest", async (listAsync, changeAsync) => {
      await listAsync();
      await changeAsync("Automatic");
      await listAsync();
    });

    Assert.areEqual("false,true,true", checks);
  }

  private static async checksAsync(stored: JsonValue,
    act: (listAsync: () => Promise<void>, changeAsync: (value: JsonValue) => Promise<void>) => Promise<void>): Promise<string> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const settings = ToolUpdateChecksTests.settingsOf(stored);
    context.settings = settings;
    const installation = new RecordingInstallation();
    const registry = new ProviderKindRegistry();
    registry.register(new InstalledAdapter(installation));
    const part = new RuntimePart(new GivenRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    try {
      await act(async () => {
        await ToolUpdateChecksTests.listAsync(context);
        await installation.read;
      }, async value => {
        ToolUpdateChecksTests.change(settings, value);
        await installation.read;
      });
    }
    finally {
      await part.deactivateAsync();
    }
    return installation.checks.join(",");
  }

  private static settingsOf(stored: JsonValue): FakeModuleSettings {
    const declared = new DeclaredSettings();
    const settings = new FakeModuleSettings();
    settings.answer("read", (name, scope, device) => name === ToolUpdateChecksTests.setting ? stored : declared.read(name, scope, device));
    return settings;
  }

  private static change(settings: FakeModuleSettings, value: JsonValue): void {
    const key = new SettingKey(QualifiedName.parse(ToolUpdateChecksTests.setting), null, "device-1");
    settings.raiseChanged(ToolUpdateChecksTests.setting, new SettingChange(key, value, true));
  }

  private static async listAsync(context: RecordingPartContext): Promise<void> {
    const handler = context.methods.get("teamrun.providerKindInstallationList");
    if (Object.isUndefined(handler))
      throw new Error("The part did not register the installation list.");
    await handler.handleAsync(new RequestContext("tests", null, new AbortController().signal, 1));
  }
}
