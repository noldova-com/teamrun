/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliPart } from "@noldova/teamrun.cli";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";

@TestClass
export class CliPartTests {
  @TestMethod
  public async registersEachCommandUnderTheModulesIdAndHoldsNothingToRelease(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();

    Assert.areEqual([
      "listProjects", "openFolder", "forgetProject", "listChats", "newChat", "renameChat", "deleteChat", "moveChat", "search", "listMessages", "send", "cancel",
      "rewind", "listApprovals", "listProviders", "checkProvider", "addProvider", "removeProvider", "listModels", "liveCheck", "listTeammates"
    ].map(t => `teamrun.${t}`).join(","), [...context.commands.keys()].join(","));
    await new CliPart().deactivateAsync();
    Assert.areEqual(0, context.requests.length);
  }
}
