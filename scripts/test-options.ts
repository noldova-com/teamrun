/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestOptionsException } from "./test-options.exception.ts";

export class TestOptions {
  private static readonly DOCUMENTS: string = "documents";
  private static readonly ANGULAR: string = "angular";
  private static readonly FILTER: string = "--filter";
  private static readonly REPEAT: string = "--repeat";
  private static readonly RERUN_FAILED: string = "--rerun-failed";
  private static readonly SKIP_TEST_DETAILS: string = "--skip-test-details";
  private static readonly SKIP_COVERAGE_DETAILS: string = "--skip-coverage-details";
  private static readonly OPTION_PREFIX: string = "--";
  private static readonly COUNT: RegExp = /^[1-9]\d*$/;
  private static readonly DOCUMENTS_ALONE: string = "documents takes no other option.";
  private static readonly ANGULAR_ALONE: string = "angular takes no other option.";
  private static readonly FILTER_VALUE: string = "--filter takes a text that is not blank and does not start with --.";
  private static readonly REPEAT_VALUE: string = "--repeat takes a whole number from 1.";
  private static readonly REPEAT_ONCE: string = "--repeat may be given only once.";
  private static readonly RERUN_FAILED_ONCE: string = "--rerun-failed may be given only once.";

  public readonly isDocuments: boolean;
  public readonly isAngular: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;
  public readonly isRerunningFailed: boolean;
  public readonly skipsTestDetails: boolean;
  public readonly skipsCoverageDetails: boolean;

  private constructor(isDocuments: boolean, isAngular: boolean, filters: readonly string[], repeat: number, isRerunningFailed: boolean, skipsTestDetails: boolean,
    skipsCoverageDetails: boolean) {
    this.isDocuments = isDocuments;
    this.isAngular = isAngular;
    this.filters = filters;
    this.repeat = repeat;
    this.isRerunningFailed = isRerunningFailed;
    this.skipsTestDetails = skipsTestDetails;
    this.skipsCoverageDetails = skipsCoverageDetails;
  }

  public static parse(args: readonly string[]): TestOptions {
    if (args[0] === TestOptions.DOCUMENTS) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptions.DOCUMENTS_ALONE);
      return new TestOptions(true, false, [], 1, false, false, false);
    }
    if (args[0] === TestOptions.ANGULAR) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptions.ANGULAR_ALONE);
      return new TestOptions(false, true, [], 1, false, false, false);
    }

    const filters: string[] = [];
    let repeat: number | null = null;
    let isRerunningFailed = false;
    let skipsTestDetails = false;
    let skipsCoverageDetails = false;
    for (let index = 0; index < args.length; index++) {
      const option = args[index];
      if (option === TestOptions.RERUN_FAILED) {
        if (isRerunningFailed)
          throw new TestOptionsException(TestOptions.RERUN_FAILED_ONCE);
        isRerunningFailed = true;
      }
      else if (option === TestOptions.SKIP_TEST_DETAILS)
        skipsTestDetails = true;
      else if (option === TestOptions.SKIP_COVERAGE_DETAILS)
        skipsCoverageDetails = true;
      else if (option === TestOptions.FILTER)
        filters.push(TestOptions.readText(args[++index]));
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
    return new TestOptions(false, false, filters, repeat ?? 1, isRerunningFailed, skipsTestDetails, skipsCoverageDetails);
  }

  private static readText(value: string | undefined): string {
    if (value === undefined || value.trim() === "" || value.startsWith(TestOptions.OPTION_PREFIX))
      throw new TestOptionsException(TestOptions.FILTER_VALUE);
    return value;
  }
}
