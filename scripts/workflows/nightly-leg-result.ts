/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import NightlyFailure from "./nightly-failure.ts";
import NightlyResultException from "./nightly-result.exception.ts";

export default class NightlyLegResult {
  public readonly label: string;
  public readonly failures: readonly NightlyFailure[];

  public constructor(label: string, failures: readonly NightlyFailure[]) {
    this.label = label;
    this.failures = [...failures];
  }

  public static parse(text: string, source: string): NightlyLegResult {
    const malformed = (cause?: unknown): NightlyResultException => new NightlyResultException(`${source} is not a nightly job's result.`, cause === undefined ? undefined : { cause });
    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw malformed(error);
    }
    if (!NightlyLegResult.isRecord(value) || typeof value["label"] !== "string" || !Array.isArray(value["failures"]))
      throw malformed();
    const failures = value["failures"].map(t => {
      if (!NightlyLegResult.isRecord(t) || typeof t["name"] !== "string" || typeof t["message"] !== "string" || !Number.isInteger(t["count"]))
        throw malformed();
      return new NightlyFailure(t["name"], t["message"], Number(t["count"]));
    });
    return new NightlyLegResult(value["label"], failures);
  }

  public toJson(): string {
    return `${JSON.stringify({ label: this.label, failures: this.failures }, null, 2)}\n`;
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
