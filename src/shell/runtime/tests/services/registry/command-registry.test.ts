/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type CommandList, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { CommandRegistry, RegistrationException, RuntimeCommand } from "@noldova/teamrun-shell-runtime";

@TestClass
export class CommandRegistryTests {
  @TestMethod
  public listsAndFindsCommandsInRegistrationOrder(): void {
    const commands = new CommandRegistry();
    const tick = CommandRegistryTests.create("clock.tick");

    commands.register(tick);
    commands.register(CommandRegistryTests.create("clock.reset"));

    Assert.areEqual("clock.tick,clock.reset", commands.list.commands.map(t => t.name.text).join(","));
    Assert.areEqual(tick, commands.find(QualifiedName.parse("clock.tick")));
    Assert.isUndefined(commands.find(QualifiedName.parse("clock.stop")));
  }

  @TestMethod
  public refusesASecondCommandWithOneName(): void {
    const commands = new CommandRegistry();
    commands.register(CommandRegistryTests.create("clock.tick"));

    const exception = Assert.throws(() => commands.register(CommandRegistryTests.create("clock.tick")), RegistrationException);

    Assert.areEqual("The command clock.tick is already registered.", exception.message);
  }

  @TestMethod
  public removesACommandOnlyThroughItsOwnRegistration(): void {
    const commands = new CommandRegistry();
    const first = commands.register(CommandRegistryTests.create("clock.tick"));
    first[Symbol.dispose]();
    const second = CommandRegistryTests.create("clock.tick");
    commands.register(second);

    first[Symbol.dispose]();

    Assert.areEqual(second, commands.find(QualifiedName.parse("clock.tick")));
  }

  @TestMethod
  public reportsTheWholeListWithTheNextSequenceAfterEachChange(): void {
    const lists: CommandList[] = [];
    const commands = new CommandRegistry(t => lists.push(t));
    const tick = CommandRegistryTests.create("clock.tick");
    const pause = new RuntimeCommand("clock.pause", "Pause", null, null, { handleAsync: async () => null }, false);
    const initial = commands.list.sequence;

    const ticking = commands.register(tick);
    commands.register(pause);
    tick.setEnabled(false);
    pause.setChecked(true);
    ticking[Symbol.dispose]();
    tick.setEnabled(true);
    ticking[Symbol.dispose]();

    Assert.areEqual(0, initial);
    Assert.areEqual("1,2,3,4,5", lists.map(t => t.sequence).join(","));
    Assert.areEqual([
      "clock.tick",
      "clock.tick,clock.pause",
      "clock.tick:false,clock.pause",
      "clock.tick:false,clock.pause:true",
      "clock.pause:true"
    ].join("|"), lists.map(t => t.commands.map(u => [u.name.text, ...u.isEnabled ? [] : ["false"], ...u.isChecked === true ? ["true"] : []].join(":")).join(",")).join("|"));
    Assert.areEqual(5, commands.list.sequence);
  }

  private static create(name: string): RuntimeCommand {
    return new RuntimeCommand(name, "Title", null, null, { handleAsync: async () => null });
  }
}
