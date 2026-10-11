/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import AngularTestCheck from "../../checks/angular-test-check.ts";
import type FlakyRecord from "../../checks/flaky-record.ts";
import GateCheck from "../../checks/gate-check.ts";
import type ICheck from "../../checks/interfaces/i-check.ts";
import type IGateChecks from "../../checks/interfaces/i-gate-checks.ts";
import PackageTestCheck from "../../checks/package-test-check.ts";
import ScriptTestCheck from "../../checks/script-test-check.ts";
import TestPart from "../../test-part.ts";
import RecordedCheckFixture from "./recorded-check.fixture.ts";

export default class GateChecksFixture implements IGateChecks {
  private readonly failing: readonly string[];
  private readonly create: ((flaky: FlakyRecord | null) => readonly GateCheck[]) | null;

  public readonly runs: string[] = [];
  public readonly requests: (readonly string[] | undefined)[] = [];

  public constructor(failing: readonly string[] = [], create: ((flaky: FlakyRecord | null) => readonly GateCheck[]) | null = null) {
    this.failing = failing;
    this.create = create;
  }

  public createDocumentChecks(): readonly ICheck[] {
    return [new RecordedCheckFixture("Documents", this.runs)];
  }

  public createAsync(flaky: FlakyRecord | null, packages?: readonly string[]): Promise<readonly GateCheck[]> {
    this.requests.push(packages);
    if (this.create !== null)
      return Promise.resolve(this.create(flaky));
    const place = (title: string, part: string, runner: string | null): GateCheck => new GateCheck(new RecordedCheckFixture(title, this.runs, !this.failing.includes(title)), part, runner);
    return Promise.resolve([
      place("First check", TestPart.ANGULAR_AND_CHECKS, null),
      place("Package tests", TestPart.PACKAGES, PackageTestCheck.RUNNER),
      place("Middle check", TestPart.ANGULAR_AND_CHECKS, null),
      place("Script tests", TestPart.SCRIPTS, ScriptTestCheck.RUNNER),
      place("Angular tests", TestPart.ANGULAR_AND_CHECKS, AngularTestCheck.RUNNER),
      place("Last check", TestPart.ANGULAR_AND_CHECKS, null)
    ]);
  }
}
