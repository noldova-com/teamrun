/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestInfo } from "@playwright/test";

export default class CleanupSteps {
  private static readonly FILE: string = "cleanup-failure.txt";

  public static async collectFailuresAsync(steps: readonly (() => Promise<unknown>)[]): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const step of steps) {
      try {
        await step();
      }
      catch (error) {
        failures.push(error);
      }
    }
    return failures;
  }

  public static throwFailures(failures: readonly unknown[]): void {
    if (failures.length > 1)
      throw new AggregateError(failures, [`${failures.length} cleanup steps failed:`, ...failures.map(t => t instanceof Error ? t.message : String(t))].join("\n"));
    if (failures.length === 1)
      throw failures[0];
  }

  public static async attachAsync(testInfo: TestInfo, failures: readonly unknown[]): Promise<void> {
    if (failures.length > 0)
      await testInfo.attach(CleanupSteps.FILE, { body: failures.map(t => CleanupSteps.describe(t)).join("\n\n"), contentType: "text/plain" });
  }

  private static describe(failure: unknown): string {
    if (failure instanceof AggregateError)
      return failure.errors.map(t => CleanupSteps.describe(t)).join("\n\n");
    return failure instanceof Error && failure.stack !== undefined ? failure.stack : String(failure);
  }
}
