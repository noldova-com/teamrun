/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type SelectedTests from "../checks/selected-tests.ts";

export default class ChangeSelection {
  private static readonly EVERY_UI_WORKFLOW: string = "every UI workflow";
  private static readonly NO_UI_WORKFLOW: string = "no UI workflow";

  public readonly reason: string;
  public readonly tests?: SelectedTests;
  public readonly uiWorkflows?: readonly string[];

  private constructor(reason: string, tests?: SelectedTests, uiWorkflows?: readonly string[]) {
    this.reason = reason;
    if (tests !== undefined)
      this.tests = tests;
    if (uiWorkflows !== undefined)
      this.uiWorkflows = uiWorkflows;
  }

  public static everything(reason: string): ChangeSelection {
    return new ChangeSelection(reason);
  }

  public static narrowed(tests: SelectedTests, uiWorkflows?: readonly string[]): ChangeSelection {
    return new ChangeSelection("", tests, uiWorkflows === undefined ? undefined : [...new Set(uiWorkflows)].sort());
  }

  public get isEverything(): boolean {
    return this.tests === undefined;
  }

  public get summary(): string {
    if (this.tests === undefined)
      return `Selection: everything. ${this.reason}`;
    const ui = this.uiWorkflows === undefined ? ChangeSelection.EVERY_UI_WORKFLOW
      : this.uiWorkflows.length === 0 ? ChangeSelection.NO_UI_WORKFLOW
        : `the UI workflows ${this.uiWorkflows.join(", ")}`;
    return `Selection: every check other than the tests, ${this.tests.description}, and ${ui}.`;
  }
}
