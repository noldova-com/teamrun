/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ChangeSelection from "./change-selection.ts";

export default class VerificationScope {
  private static readonly FULL_SUMMARY: string = "Full build and test verification selected.";
  private static readonly WITHOUT_UI_SUMMARY: string = "The builds and tests run; the UI workflows are not required.";
  private static readonly SKIPPED_SUMMARY: string = "Code builds and tests are not required; the document checks still run.";

  public readonly runCode: boolean;
  public readonly runUi: boolean;
  public readonly reason: string;
  public readonly selection: ChangeSelection;

  public constructor(runCode: boolean, runUi: boolean, reason: string, selection: ChangeSelection) {
    this.runCode = runCode;
    this.runUi = runCode && runUi;
    this.reason = reason;
    this.selection = selection;
  }

  public get summary(): string {
    const scope = this.runUi ? VerificationScope.FULL_SUMMARY : this.runCode ? VerificationScope.WITHOUT_UI_SUMMARY : VerificationScope.SKIPPED_SUMMARY;
    return `${scope} ${this.reason}`;
  }
}
