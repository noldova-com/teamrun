/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackagingException from "./packaging.exception.ts";

export default class LicenseExpression {
  public static readonly ALLOWED: readonly string[] = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "BlueOak-1.0.0", "Python-2.0"];

  private static readonly GROUP: RegExp = /^\((.*)\)$/s;
  private static readonly ALTERNATIVE: RegExp = /\s+OR\s+/;
  private static readonly IDENTIFIER: RegExp = /^[A-Za-z0-9.-]+$/;

  public readonly expression: string;
  public readonly chosen: string;

  public constructor(packageId: string, expression: unknown) {
    if (typeof expression !== "string")
      throw new PackagingException(`${packageId} names no license in its package.json; a third-party runtime package needs ${LicenseExpression.describeAllowed()}.`);
    const trimmed = expression.trim();
    const identifiers = (LicenseExpression.GROUP.exec(trimmed)?.[1] ?? trimmed).trim().split(LicenseExpression.ALTERNATIVE);
    const chosen = identifiers.every(t => LicenseExpression.IDENTIFIER.test(t)) ? identifiers.find(t => LicenseExpression.ALLOWED.includes(t)) : undefined;
    if (chosen === undefined)
      throw new PackagingException(`${packageId} is licensed under "${expression}"; a third-party runtime package needs ${LicenseExpression.describeAllowed()}.`);

    this.expression = expression;
    this.chosen = chosen;
  }

  public describe(): string {
    return this.expression === this.chosen ? this.chosen : `${this.chosen}, chosen from "${this.expression}"`;
  }

  private static describeAllowed(): string {
    return `one of ${LicenseExpression.ALLOWED.join(", ")}, or an OR expression with one of them`;
  }
}
