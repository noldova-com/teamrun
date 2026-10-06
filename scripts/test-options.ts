/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TestOptionsException from "./test-options.exception.ts";
import TestPart from "./test-part.ts";

export default class TestOptions {
  private static readonly DOCUMENTS: string = "documents";
  private static readonly FILTER: string = "--filter";
  private static readonly REPEAT: string = "--repeat";
  private static readonly PART: string = "--part";
  private static readonly RERUN_FAILED: string = "--rerun-failed";
  private static readonly OPTION_PREFIX: string = "--";
  private static readonly COUNT: RegExp = /^[1-9]\d*$/;
  private static readonly DOCUMENTS_ALONE: string = "documents takes no other option.";
  private static readonly FILTER_VALUE: string = "--filter takes a text that is not blank and does not start with --.";
  private static readonly REPEAT_VALUE: string = "--repeat takes a whole number from 1.";
  private static readonly REPEAT_ONCE: string = "--repeat may be given only once.";
  private static readonly PART_VALUE: string = `--part takes one of ${TestPart.ALL.join(", ")}.`;
  private static readonly PART_ONCE: string = "--part may be given only once.";
  private static readonly PART_OR_FILTER: string = "--part runs a whole part, so it takes no --filter.";
  private static readonly RERUN_FAILED_ONCE: string = "--rerun-failed may be given only once.";

  public readonly isDocuments: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;
  public readonly part: string | null;
  public readonly isRerunningFailed: boolean;

  private constructor(isDocuments: boolean, filters: readonly string[], repeat: number, part: string | null, isRerunningFailed: boolean) {
    this.isDocuments = isDocuments;
    this.filters = filters;
    this.repeat = repeat;
    this.part = part;
    this.isRerunningFailed = isRerunningFailed;
  }

  public static parse(args: readonly string[]): TestOptions {
    if (args[0] === TestOptions.DOCUMENTS) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptions.DOCUMENTS_ALONE);
      return new TestOptions(true, [], 1, null, false);
    }

    const filters: string[] = [];
    let repeat: number | null = null;
    let part: string | null = null;
    let isRerunningFailed = false;
    let index = 0;
    while (index < args.length) {
      const option = args[index];
      if (option === TestOptions.RERUN_FAILED) {
        if (isRerunningFailed)
          throw new TestOptionsException(TestOptions.RERUN_FAILED_ONCE);
        isRerunningFailed = true;
        index++;
        continue;
      }
      const value = args[index + 1] ?? "";
      if (option === TestOptions.FILTER) {
        if (value.trim() === "" || value.startsWith(TestOptions.OPTION_PREFIX))
          throw new TestOptionsException(TestOptions.FILTER_VALUE);
        filters.push(value);
      }
      else if (option === TestOptions.REPEAT) {
        if (repeat !== null)
          throw new TestOptionsException(TestOptions.REPEAT_ONCE);
        if (!TestOptions.COUNT.test(value))
          throw new TestOptionsException(TestOptions.REPEAT_VALUE);
        repeat = Number(value);
      }
      else if (option === TestOptions.PART) {
        if (part !== null)
          throw new TestOptionsException(TestOptions.PART_ONCE);
        if (!TestPart.ALL.includes(value))
          throw new TestOptionsException(TestOptions.PART_VALUE);
        part = value;
      }
      else
        throw new TestOptionsException(`${JSON.stringify(option)} is not an option of npm test.`);
      index += 2;
    }
    if (part !== null && filters.length > 0)
      throw new TestOptionsException(TestOptions.PART_OR_FILTER);
    return new TestOptions(false, filters, repeat ?? 1, part, isRerunningFailed);
  }
}
