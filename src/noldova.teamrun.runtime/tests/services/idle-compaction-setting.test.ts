/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { IdleCompactionSetting } from "@noldova/teamrun.runtime";

import { DeclaredSettings } from "../fixtures/declared-settings.fixture.js";

@TestClass
export class IdleCompactionSettingTests {
  @TestMethod
  public readsOnByDefaultAndOffOnlyWhenThePersonTurnsItOffAtEachCall(): void {
    const settings = new DeclaredSettings();
    const read = IdleCompactionSetting.readerOf(settings);

    Assert.isTrue(read());
    settings.write("teamrun.idleCompaction", false);
    Assert.isFalse(read());
    settings.write("teamrun.idleCompaction", true);
    Assert.isTrue(read());
  }
}
