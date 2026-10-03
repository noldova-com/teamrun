/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandInfo, CommandList, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class CommandListTests {
  @TestMethod
  public keepsItsCommandsInOrderWithItsSequence(): void {
    const commands = [new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", null, null), new CommandInfo(QualifiedName.parse("notes.newNote"), "New note", null, null)];
    const list = new CommandList(commands, 7);
    commands.pop();

    const copy = CommandList.fromJson(JSON.parse(JSON.stringify(list.toJson())));

    Assert.areEqual("clock.tick,notes.newNote", copy.commands.map(t => t.name.text).join(","));
    Assert.areEqual(7, copy.sequence);
    Assert.areEqual("{\"commands\":[],\"sequence\":0}", JSON.stringify(new CommandList([], 0).toJson()));
  }

  @TestMethod
  public refusesASequenceThatIsNotAWholeNumberFromZero(): void {
    for (const sequence of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      Assert.areEqual("sequence", Assert.throws(() => new CommandList([], sequence), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheEntryThatIsInvalid(): void {
    Assert.areEqual("$.commands.1.title", Assert.throws(() => CommandList.fromJson({ commands: [{ name: "clock.tick", title: "Tick" }, { name: "clock.reset" }], sequence: 0 }), JsonException).path);
    Assert.areEqual("$.commands", Assert.throws(() => CommandList.fromJson({ sequence: 0 }), JsonException).path);
    Assert.areEqual("$.sequence", Assert.throws(() => CommandList.fromJson({ commands: [] }), JsonException).path);
    Assert.areEqual("$.sequence", Assert.throws(() => CommandList.fromJson({ commands: [], sequence: -1 }), JsonException).path);
  }
}
