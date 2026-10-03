/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type AngularProject from "../angular/angular-project.ts";
import ProcessException from "../processes/process.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class AngularTestCheck implements ICheck {
  private static readonly NO_REPORT: string = "The Angular tests passed but wrote no report of the spec files they ran.\n";

  private readonly project: AngularProject;

  public readonly title: string = "Angular tests and coverage";

  public constructor(project: AngularProject) {
    this.project = project;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      const run = await this.project.testAsync();
      if (!run.isSuccessful)
        return false;
      if (run.collected === null) {
        output.write(AngularTestCheck.NO_REPORT);
        return false;
      }
      const collected = new Set(run.collected);
      const missing = (await this.project.specFilesAsync()).filter(t => !collected.has(t));
      if (missing.length === 0)
        return true;
      output.write(`The Angular tests did not run ${missing.length} of the spec files under src/:\n${missing.map(t => `  ${t}\n`).join("")}`);
      return false;
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
