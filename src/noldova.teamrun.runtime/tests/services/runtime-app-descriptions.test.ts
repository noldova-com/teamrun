/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeAppDescriptions } from "@noldova/teamrun.runtime";

import { FakeComputerUseApps } from "../fixtures/fake-computer-use-apps.fixture.js";

@TestClass
export class RuntimeAppDescriptionsTests {
  @TestMethod
  public async namesAnAppWithItsIconsPngAsBase64AndPassesTheSignalOn(): Promise<void> {
    const apps = new FakeComputerUseApps();
    apps.descriptions.set("com.example.paint", { name: "Paint", icon: Uint8Array.of(0x89, 0x50, 0x4e, 0x47) });
    const controller = new AbortController();

    const look = await new RuntimeAppDescriptions(() => apps).describeAsync("com.example.paint", controller.signal);

    Assert.areEqual(JSON.stringify(["Paint", "iVBORw=="]), JSON.stringify([look?.name, look?.icon]));
    Assert.isTrue(apps.signals[0] === controller.signal);
  }

  @TestMethod
  public async givesAnAppWithoutAnIconNoIconAndAnAppComputerUseDoesNotDescribeNoLook(): Promise<void> {
    const apps = new FakeComputerUseApps();
    apps.descriptions.set("com.example.notes", { name: "Notes", icon: null });
    const descriptions = new RuntimeAppDescriptions(() => apps);

    const notes = await descriptions.describeAsync("com.example.notes");
    const absent = await descriptions.describeAsync("com.example.absent");

    Assert.areEqual(JSON.stringify(["Notes", null]), JSON.stringify([notes?.name, notes?.icon]));
    Assert.isNull(absent);
    Assert.isFalse(apps.signals.some(t => t.aborted));
  }

  @TestMethod
  public async findsTheAppsServiceForEachDescriptionAndGivesNoLookWhileThereIsNone(): Promise<void> {
    const apps = new FakeComputerUseApps();
    apps.descriptions.set("com.example.notes", { name: "Notes", icon: null });
    let found: FakeComputerUseApps | null = null;
    const descriptions = new RuntimeAppDescriptions(() => found);

    const before = await descriptions.describeAsync("com.example.notes");
    found = apps;
    const after = await descriptions.describeAsync("com.example.notes");

    Assert.isNull(before);
    Assert.areEqual("Notes", after?.name);
    Assert.areEqual("com.example.notes", apps.described.join(","));
  }

  @TestMethod
  public isAppsTakesOnlyAServiceWithADescribeMethod(): void {
    Assert.isTrue(RuntimeAppDescriptions.isApps(new FakeComputerUseApps()));
    Assert.isFalse(RuntimeAppDescriptions.isApps({}));
    Assert.isFalse(RuntimeAppDescriptions.isApps({ describeAsync: "Notes" }));
  }
}
