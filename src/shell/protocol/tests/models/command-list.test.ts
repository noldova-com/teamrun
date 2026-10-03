/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandInfo, CommandList, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class CommandListTests {
  @TestMethod
  public keepsItsCommandsInOrder(): void {
    const commands = [new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", null, null), new CommandInfo(QualifiedName.parse("notes.newNote"), "New note", null, null)];
    const list = new CommandList(commands);
    commands.pop();

    const copy = CommandList.fromJson(JSON.parse(JSON.stringify(list.toJson())));

    Assert.areEqual("clock.tick,notes.newNote", copy.commands.map(t => t.name.text).join(","));
  }

  @TestMethod
  public namesTheEntryThatIsInvalid(): void {
    Assert.areEqual("$.commands.1.title", Assert.throws(() => CommandList.fromJson({ commands: [{ name: "clock.tick", title: "Tick" }, { name: "clock.reset" }] }), JsonException).path);
    Assert.areEqual("$.commands", Assert.throws(() => CommandList.fromJson({}), JsonException).path);
  }
}
