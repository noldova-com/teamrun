/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/teamrun.cli";

@TestClass
export class TeamRunCliApiTests {
  @TestMethod
  public exportsThePartAndItsException(): void {
    Assert.areEqual("CliException,CliPart,CliPartException", Object.keys(api).sort().join(","));
    Assert.isTrue(new api.CliPartException("teamrun.listChats") instanceof api.CliException);
    Assert.isTrue(new api.CliPartException("teamrun.listChats") instanceof Exception);
  }
}
