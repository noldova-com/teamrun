/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TokenTotals {
  public static readonly zero: TokenTotals = new TokenTotals(0, 0, 0, 0, 0);

  public readonly inputTokens: number;
  public readonly outputTokens: number;
  public readonly cacheReadTokens: number | null;
  public readonly cacheWriteTokens: number | null;
  public readonly reasoningTokens: number | null;

  public constructor(inputTokens: number, outputTokens: number, cacheReadTokens: number | null = null, cacheWriteTokens: number | null = null,
    reasoningTokens: number | null = null) {
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
    this.cacheReadTokens = cacheReadTokens;
    this.cacheWriteTokens = cacheWriteTokens;
    this.reasoningTokens = reasoningTokens;
  }

  public since(before: TokenTotals): TokenTotals {
    return new TokenTotals(this.inputTokens - before.inputTokens, this.outputTokens - before.outputTokens,
      TokenTotals.growth(this.cacheReadTokens, before.cacheReadTokens), TokenTotals.growth(this.cacheWriteTokens, before.cacheWriteTokens),
      TokenTotals.growth(this.reasoningTokens, before.reasoningTokens));
  }

  public isAhead(before: TokenTotals): boolean {
    return this.inputTokens >= before.inputTokens && this.outputTokens >= before.outputTokens
      && (this.inputTokens > before.inputTokens || this.outputTokens > before.outputTokens);
  }

  private static growth(now: number | null, before: number | null): number | null {
    return Object.isNull(now) || Object.isNull(before) || now < before ? null : now - before;
  }
}
