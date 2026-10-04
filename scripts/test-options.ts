/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TestOptionsException from "./test-options.exception.ts";

export default class TestOptions {
  private static readonly DOCUMENTS: string = "documents";
  private static readonly FILTER: string = "--filter";
  private static readonly REPEAT: string = "--repeat";
  private static readonly OPTION_PREFIX: string = "--";
  private static readonly COUNT: RegExp = /^[1-9]\d*$/;
  private static readonly DOCUMENTS_ALONE: string = "documents takes no other option.";
  private static readonly FILTER_VALUE: string = "--filter takes a text that is not blank and does not start with --.";
  private static readonly REPEAT_VALUE: string = "--repeat takes a whole number from 1.";
  private static readonly REPEAT_ONCE: string = "--repeat may be given only once.";

  public readonly isDocuments: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;

  private constructor(isDocuments: boolean, filters: readonly string[], repeat: number) {
    this.isDocuments = isDocuments;
    this.filters = filters;
    this.repeat = repeat;
  }

  public static parse(args: readonly string[]): TestOptions {
    if (args.includes(TestOptions.DOCUMENTS)) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptions.DOCUMENTS_ALONE);
      return new TestOptions(true, [], 1);
    }

    const filters: string[] = [];
    let repeat: number | null = null;
    for (let index = 0; index < args.length; index += 2) {
      const option = args[index];
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
      else
        throw new TestOptionsException(`${JSON.stringify(option)} is not an option of npm test.`);
    }
    return new TestOptions(false, filters, repeat ?? 1);
  }
}
