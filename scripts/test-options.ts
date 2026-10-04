/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class TestOptions {
  private static readonly DOCUMENTS: string = "documents";
  private static readonly FILTER: string = "--filter";
  private static readonly REPEAT: string = "--repeat";
  private static readonly COUNT: RegExp = /^[1-9]\d*$/;

  public readonly isDocuments: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;

  private constructor(isDocuments: boolean, filters: readonly string[], repeat: number) {
    this.isDocuments = isDocuments;
    this.filters = filters;
    this.repeat = repeat;
  }

  public static parse(args: readonly string[]): TestOptions | null {
    if (args.length === 1 && args[0] === TestOptions.DOCUMENTS)
      return new TestOptions(true, [], 1);

    const filters: string[] = [];
    let repeat: number | null = null;
    for (let index = 0; index < args.length; index += 2) {
      const value = args[index + 1];
      if (value === undefined || value === "")
        return null;
      if (args[index] === TestOptions.FILTER)
        filters.push(value);
      else if (args[index] === TestOptions.REPEAT && repeat === null && TestOptions.COUNT.test(value))
        repeat = Number(value);
      else
        return null;
    }
    return new TestOptions(false, filters, repeat ?? 1);
  }
}
