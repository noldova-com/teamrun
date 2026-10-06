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
import { ProgramStatus, ProgramStatusList } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ProgramStatusListTests {
  @TestMethod
  public keepsItsProgramsInOrderWithItsSequence(): void {
    const started = new Date("2026-10-06T08:00:00.000Z");
    const programs = [new ProgramStatus("git", "/usr/bin/git", 4210, started, false), new ProgramStatus("clock", "/usr/bin/node", 4300, started, true)];
    const list = new ProgramStatusList(programs, 5);
    programs.pop();

    const copy = ProgramStatusList.fromJson(JSON.parse(JSON.stringify(list.toJson())));

    Assert.areEqual("4210,4300", copy.programs.map(t => t.processId).join(","));
    Assert.areEqual(5, copy.sequence);
    Assert.areEqual("{\"programs\":[],\"sequence\":0}", JSON.stringify(new ProgramStatusList([], 0).toJson()));
  }

  @TestMethod
  public refusesASequenceThatIsNotAWholeNumberFromZero(): void {
    for (const sequence of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      Assert.areEqual("sequence", Assert.throws(() => new ProgramStatusList([], sequence), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheEntryOrFieldThatIsInvalidOrUnknown(): void {
    const program = { module: "git", program: "/usr/bin/git", processId: 4210, startedAt: "2026-10-06T08:00:00.000Z", hasExited: false };

    Assert.areEqual("$.programs.1.processId", Assert.throws(() => ProgramStatusList.fromJson({ programs: [program, { ...program, processId: -4 }], sequence: 1 }), JsonException).path);
    Assert.areEqual("$.programs", Assert.throws(() => ProgramStatusList.fromJson({ sequence: 0 }), JsonException).path);
    Assert.areEqual("$.sequence", Assert.throws(() => ProgramStatusList.fromJson({ programs: [], sequence: -1 }), JsonException).path);
    Assert.areEqual("$.count", Assert.throws(() => ProgramStatusList.fromJson({ programs: [], sequence: 0, count: 0 }), JsonException).path);
  }
}
