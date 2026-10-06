/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class SelectedTests {
  private static readonly NO_TESTS: string = "no tests";
  private static readonly ANGULAR_TESTS: string = "the Angular tests";
  private static readonly SCRIPT_TESTS: string = "the script tests";
  private static readonly LIST_SEPARATOR: string = ", ";
  private static readonly LAST_SEPARATOR: string = " and ";

  public static readonly PACKAGE_OPTION: string = "--package";
  public static readonly ANGULAR_OPTION: string = "--angular-tests";
  public static readonly SCRIPT_OPTION: string = "--script-tests";
  public static readonly CHECKS_ONLY_OPTION: string = "--checks-only";

  public readonly packages: readonly string[];
  public readonly runsAngularTests: boolean;
  public readonly runsScriptTests: boolean;

  public constructor(packages: readonly string[], runsAngularTests: boolean, runsScriptTests: boolean) {
    this.packages = [...new Set(packages)];
    this.runsAngularTests = runsAngularTests;
    this.runsScriptTests = runsScriptTests;
  }

  public get arguments(): readonly string[] {
    const selected = [
      ...this.packages.flatMap(t => [SelectedTests.PACKAGE_OPTION, t]),
      ...this.runsAngularTests ? [SelectedTests.ANGULAR_OPTION] : [],
      ...this.runsScriptTests ? [SelectedTests.SCRIPT_OPTION] : []
    ];
    return selected.length > 0 ? selected : [SelectedTests.CHECKS_ONLY_OPTION];
  }

  public get description(): string {
    const parts = [
      ...this.packages.length > 0 ? [`the package tests of ${SelectedTests.join(this.packages)}`] : [],
      ...this.runsAngularTests ? [SelectedTests.ANGULAR_TESTS] : [],
      ...this.runsScriptTests ? [SelectedTests.SCRIPT_TESTS] : []
    ];
    return parts.length > 0 ? SelectedTests.join(parts) : SelectedTests.NO_TESTS;
  }

  private static join(parts: readonly string[]): string {
    const last = parts.slice(-1).join(SelectedTests.LIST_SEPARATOR);
    return parts.length === 1 ? last : `${parts.slice(0, -1).join(SelectedTests.LIST_SEPARATOR)}${SelectedTests.LAST_SEPARATOR}${last}`;
  }
}
