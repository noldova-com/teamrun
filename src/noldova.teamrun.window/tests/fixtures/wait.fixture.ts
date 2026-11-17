/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Wait {
  private static readonly POLL_INTERVAL: number = 1;
  private static readonly TIMEOUT: number = 1_000;
  private static readonly SETTLE_TIMEOUT: number = 10_000;

  public static until<T>(check: () => T | Promise<T>, options: { readonly timeout?: number } = {}): Promise<T> {
    return vi.waitFor(check, { timeout: options.timeout ?? Wait.TIMEOUT, interval: Wait.POLL_INTERVAL });
  }

  public static async settled<T>(work: Promise<T>, what: string, options: { readonly timeout?: number } = {}): Promise<T> {
    const timeout = options.timeout ?? Wait.SETTLE_TIMEOUT;
    const failure = new Error(`${what} did not happen within ${timeout} ms.`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(failure), timeout);
    });
    try {
      return await Promise.race([work, bound]);
    }
    finally {
      clearTimeout(timer);
    }
  }
}
