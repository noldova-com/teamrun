/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TitleModelSetting } from "@noldova/teamrun.runtime";

import { DeclaredSettings } from "../fixtures/declared-settings.fixture.js";

@TestClass
export class TitleModelSettingTests {
  @TestMethod
  public readsTheChosenModelAtEachCallAndTheChatsOwnOnAValueThatIsNotAString(): void {
    const settings = new DeclaredSettings();
    const read = TitleModelSetting.readerOf(settings);

    Assert.areEqual(String.empty, read());
    settings.write("teamrun.titleModel", "provider/model");
    Assert.areEqual("provider/model", read());
    settings.write("teamrun.titleModel", 4);
    Assert.areEqual(String.empty, read());
  }
}
