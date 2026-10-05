/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PullRequestPool {
  private readonly limit: number;

  public constructor(limit: number) {
    this.limit = limit;
  }

  public async mapAsync<T, TResult>(items: readonly T[], work: (item: T) => Promise<TResult>): Promise<readonly TResult[]> {
    const results: TResult[] = [];
    const failures = new Map<number, unknown>();
    const entries = items.entries();
    const workAsync = async (): Promise<void> => {
      for (const [index, item] of entries) {
        try {
          results[index] = await work(item);
        }
        catch (error) {
          failures.set(index, error);
        }
      }
    };
    await Promise.all(Array.from({ length: this.limit }, workAsync));
    const errors = [...failures.entries()].sort((a, b) => a[0] - b[0]).map(t => t[1]);
    if (errors.length === 1)
      throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, `${errors.length} pull requests failed.`);
    return results;
  }
}
