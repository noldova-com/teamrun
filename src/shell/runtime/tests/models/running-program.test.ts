/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RunningProgram } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RunningProgramTests {
  @TestMethod
  public keepsTheModuleTheProgramItsProcessItsStartAndWhetherItExited(): void {
    const started = new Date(1_000);

    const program = new RunningProgram("git", "/usr/bin/git", 4_210, started);
    const exited = new RunningProgram("git", "/usr/bin/git", 4_210, started, true);

    Assert.areEqual("git", program.moduleId);
    Assert.areEqual("/usr/bin/git", program.program);
    Assert.areEqual(4_210, program.processId);
    Assert.areEqual(started, program.started);
    Assert.isFalse(program.hasExited);
    Assert.isTrue(exited.hasExited);
  }

  @TestMethod
  public reportsItsModuleProgramProcessStartAndWhetherItExited(): void {
    const status = new RunningProgram("git", "/usr/bin/git", 4_210, new Date(1_000), true).toStatus();

    Assert.areEqual("{\"module\":\"git\",\"program\":\"/usr/bin/git\",\"processId\":4210,\"startedAt\":\"1970-01-01T00:00:01.000Z\",\"hasExited\":true}", JSON.stringify(status.toJson()));
  }
}
