/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
import type { IModuleSettings } from "@noldova/desktop.runtime";
import { ToolUpdateChecks } from "@noldova/teamrun.runtime";

@TestClass
export class ToolUpdateChecksTests {
  @TestMethod
  public runsWithoutAskingOnlyOnceTheDevicesUpdateChecksSettingIsKnownAndIsntOnRequest(): void {
    const names: string[] = [];
    let listener: (change: SettingChange) => void = () => undefined;
    const settings = { onChanged: (name: string, changed: (change: SettingChange) => void) => {
      names.push(name);
      listener = changed;
    } } as IModuleSettings;
    const checks = new ToolUpdateChecks(settings);
    const change = (value: JsonValue): boolean => {
      listener(new SettingChange(new SettingKey(QualifiedName.parse("desktop.updateChecks"), null, "device-1"), value, true));
      return checks.runWithoutAsking;
    };

    Assert.areEqual("desktop.updateChecks", names.join(","));
    Assert.isFalse(checks.runWithoutAsking);
    Assert.isTrue(change("Automatic"));
    Assert.isFalse(change("OnRequest"));
    Assert.isTrue(change("AtStart"));
    Assert.isFalse(change(null));
  }
}
