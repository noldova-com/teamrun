/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChildProgramHost, ProgramException } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";

const MISSING = path.join(path.dirname(process.execPath), "teamrun-missing-program");

@TestClass
export class ChildProgramHostTests {
  @TestMethod
  public async runsAProgramWithTheGivenEnvironmentAndReturnsItsOutput(): Promise<void> {
    const host = new ChildProgramHost(5000);

    const output = await host.runAsync(process.execPath, ["-e", "process.stdout.write(`${process.argv[1]} ${process.env.TRAY_ANSWER}`)", "(<true>,)"], { ...process.env, TRAY_ANSWER: "answered" });

    Assert.areEqual("(<true>,) answered", output);
  }

  @TestMethod
  public async failsWithTheProgramNamedWhenItFailsIsMissingOrRunsTooLong(): Promise<void> {
    const host = new ChildProgramHost(300);

    const failures = [
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "process.exit(3)"], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(MISSING, [], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env), ProgramException)
    ];

    Assert.isTrue(failures[0]?.message.startsWith(`${process.execPath} failed: `) === true, failures[0]?.message);
    Assert.isTrue(failures[1]?.message.startsWith(`${MISSING} failed: `) === true, failures[1]?.message);
    Assert.isTrue(failures.every(t => t.cause instanceof Error));
  }

  @TestMethod
  public async passesAStartedProgramsOutputOnAndTellsOnceWhenItEnds(): Promise<void> {
    const host = new ChildProgramHost(5000);
    const output: string[] = [];
    let exits = 0;

    host.start(process.execPath, ["-e", "process.stdout.write(process.env.TRAY_ANSWER ?? '')"], { ...process.env, TRAY_ANSWER: "NameOwnerChanged" }, t => output.push(t), () => exits++);

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual("NameOwnerChanged", output.join(""));
    Assert.areEqual(1, exits);
  }

  @TestMethod
  public async stopsAStartedProgramAndTellsOnceWhenOneIsMissing(): Promise<void> {
    const host = new ChildProgramHost(5000);
    let exits = 0;
    let missingExits = 0;
    host.start(MISSING, [], process.env, () => undefined, () => missingExits++);
    const running = host.start(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env, () => undefined, () => exits++);

    running.stop();

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual(1, exits);
    Assert.areEqual(1, missingExits);
  }
}
