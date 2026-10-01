/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type AngularProject from "../angular/angular-project.ts";
import type ICheck from "./interfaces/check.ts";

export default class AngularTestCheck implements ICheck {
  private readonly project: AngularProject;

  public readonly title: string = "Angular tests and coverage";

  public constructor(project: AngularProject) {
    this.project = project;
  }

  public runAsync(): Promise<boolean> {
    return this.project.testAsync();
  }
}
