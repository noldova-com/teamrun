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
import { ProgramStatus } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ProgramStatusTests {
  @TestMethod
  public carriesTheProgramItsModuleItsProcessItsStartAndWhetherItHasExited(): void {
    const started = new Date("2026-10-06T08:00:00.250Z");
    const status = new ProgramStatus("git", "/usr/bin/git", 4210, started, true);
    started.setTime(0);

    const copy = ProgramStatus.fromJson(JSON.parse(JSON.stringify(status.toJson())));

    Assert.areEqual("{\"module\":\"git\",\"program\":\"/usr/bin/git\",\"processId\":4210,\"startedAt\":\"2026-10-06T08:00:00.250Z\",\"hasExited\":true}", JSON.stringify(status.toJson()));
    Assert.areEqual("git /usr/bin/git 4210 2026-10-06T08:00:00.250Z true", [copy.moduleId, copy.program, copy.processId, copy.started.toISOString(), copy.hasExited].join(" "));
  }

  @TestMethod
  public refusesABlankModuleOrProgramAProcessIdBelowOneAndAnInvalidStart(): void {
    const started = new Date();
    Assert.areEqual("module", Assert.throws(() => new ProgramStatus(" ", "/usr/bin/git", 1, started, false), ArgumentException).parameterName);
    Assert.areEqual("program", Assert.throws(() => new ProgramStatus("git", "", 1, started, false), ArgumentException).parameterName);
    for (const processId of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      Assert.areEqual("processId", Assert.throws(() => new ProgramStatus("git", "/usr/bin/git", processId, started, false), ArgumentException).parameterName);
    Assert.areEqual("startedAt", Assert.throws(() => new ProgramStatus("git", "/usr/bin/git", 1, new Date(Number.NaN), false), ArgumentException).parameterName);
  }

  @TestMethod
  public refusesAnUnknownFieldSoArgumentsAndEnvironmentNeverTravel(): void {
    const status = { module: "git", program: "/usr/bin/git", processId: 4210, startedAt: "2026-10-06T08:00:00.000Z", hasExited: false };

    Assert.areEqual("$.arguments", Assert.throws(() => ProgramStatus.fromJson({ ...status, arguments: ["--token", "secret"] }), JsonException).path);
    Assert.areEqual("$.environment", Assert.throws(() => ProgramStatus.fromJson({ ...status, environment: { TOKEN: "secret" } }), JsonException).path);
  }

  @TestMethod
  public namesTheFieldThatIsMissingOrInvalid(): void {
    const status = { module: "git", program: "/usr/bin/git", processId: 4210, startedAt: "2026-10-06T08:00:00.000Z", hasExited: false };

    Assert.areEqual("$.startedAt", Assert.throws(() => ProgramStatus.fromJson({ ...status, startedAt: "yesterday" }), JsonException).path);
    Assert.areEqual("$.processId", Assert.throws(() => ProgramStatus.fromJson({ ...status, processId: 0 }), JsonException).path);
    Assert.areEqual("$.hasExited", Assert.throws(() => ProgramStatus.fromJson({ module: "git", program: "/usr/bin/git", processId: 4210, startedAt: "2026-10-06T08:00:00.000Z" }), JsonException).path);
  }
}
