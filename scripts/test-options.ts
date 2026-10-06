/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SelectedTests from "./checks/selected-tests.ts";
import TestOptionsException from "./test-options.exception.ts";

export default class TestOptions {
  private static readonly DOCUMENTS: string = "documents";
  private static readonly FILTER: string = "--filter";
  private static readonly REPEAT: string = "--repeat";
  private static readonly OPTION_PREFIX: string = "--";
  private static readonly COUNT: RegExp = /^[1-9]\d*$/;
  private static readonly DOCUMENTS_ALONE: string = "documents takes no other option.";
  private static readonly FILTER_VALUE: string = "--filter takes a text that is not blank and does not start with --.";
  private static readonly PACKAGE_VALUE: string = "--package takes a package's name that is not blank and does not start with --.";
  private static readonly REPEAT_VALUE: string = "--repeat takes a whole number from 1.";
  private static readonly REPEAT_ONCE: string = "--repeat may be given only once.";
  private static readonly FILTER_OR_SELECTION: string = "--filter selects tests by name and takes no --package, --angular-tests, --script-tests or --checks-only.";
  private static readonly CHECKS_ONLY_ALONE: string = "--checks-only runs no tests, so it takes no --package, --angular-tests or --script-tests.";

  public readonly isDocuments: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;
  public readonly selection?: SelectedTests;

  private constructor(isDocuments: boolean, filters: readonly string[], repeat: number, selection?: SelectedTests) {
    this.isDocuments = isDocuments;
    this.filters = filters;
    this.repeat = repeat;
    if (selection !== undefined)
      this.selection = selection;
  }

  public static parse(args: readonly string[]): TestOptions {
    if (args[0] === TestOptions.DOCUMENTS) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptions.DOCUMENTS_ALONE);
      return new TestOptions(true, [], 1);
    }

    const filters: string[] = [];
    const packages: string[] = [];
    let repeat: number | null = null;
    let runsAngularTests = false;
    let runsScriptTests = false;
    let isChecksOnly = false;
    for (let index = 0; index < args.length; index++) {
      const option = args[index];
      if (option === SelectedTests.ANGULAR_OPTION)
        runsAngularTests = true;
      else if (option === SelectedTests.SCRIPT_OPTION)
        runsScriptTests = true;
      else if (option === SelectedTests.CHECKS_ONLY_OPTION)
        isChecksOnly = true;
      else if (option === TestOptions.FILTER)
        filters.push(TestOptions.readText(args[++index], TestOptions.FILTER_VALUE));
      else if (option === SelectedTests.PACKAGE_OPTION)
        packages.push(TestOptions.readText(args[++index], TestOptions.PACKAGE_VALUE));
      else if (option === TestOptions.REPEAT) {
        const value = args[++index] ?? "";
        if (repeat !== null)
          throw new TestOptionsException(TestOptions.REPEAT_ONCE);
        if (!TestOptions.COUNT.test(value))
          throw new TestOptionsException(TestOptions.REPEAT_VALUE);
        repeat = Number(value);
      }
      else
        throw new TestOptionsException(`${JSON.stringify(option)} is not an option of npm test.`);
    }

    const isSelected = packages.length > 0 || runsAngularTests || runsScriptTests;
    if (filters.length > 0 && (isSelected || isChecksOnly))
      throw new TestOptionsException(TestOptions.FILTER_OR_SELECTION);
    if (isChecksOnly && isSelected)
      throw new TestOptionsException(TestOptions.CHECKS_ONLY_ALONE);
    return isSelected || isChecksOnly
      ? new TestOptions(false, [], repeat ?? 1, new SelectedTests(packages, runsAngularTests, runsScriptTests))
      : new TestOptions(false, filters, repeat ?? 1);
  }

  private static readText(value: string | undefined, reason: string): string {
    if (value === undefined || value.trim() === "" || value.startsWith(TestOptions.OPTION_PREFIX))
      throw new TestOptionsException(reason);
    return value;
  }
}
