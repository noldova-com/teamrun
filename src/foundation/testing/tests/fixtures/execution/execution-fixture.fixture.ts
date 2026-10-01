/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AsyncResource } from "node:async_hooks";

import { Assert } from "@noldova/teamrun-foundation-testing";

export class ExecutionFixture {
  private static readonly OUTSIDE_TEST_EXECUTION: AsyncResource = new AsyncResource("outside-test-execution");

  private counter = 0;

  public increments(): void {
    this.counter++;
    Assert.areEqual(1, this.counter);
  }

  public incrementsAgain(): void {
    this.counter++;
    Assert.areEqual(1, this.counter);
  }

  public recordsExecution(events: string[], name: string): void {
    events.push("run:" + name);
  }

  public receivesData(value: string, expectedLength: number): void {
    this.counter++;
    Assert.areEqual(1, this.counter);
    Assert.areEqual(expectedLength, value.length);
  }

  public async receivesDataAsync(value: string): Promise<void> {
    await Promise.resolve();
    Assert.areEqual("async", value);
  }

  public failsOnAssertion(): void {
    Assert.areEqual(1, 2);
  }

  public throwsAnError(): void {
    throw new Error("boom");
  }

  public async resolvesLater(): Promise<void> {
    await new Promise<void>(t => {
      setTimeout(t, 5);
    });
  }

  public async rejects(): Promise<void> {
    throw new Error("rejected");
  }

  public leavesAStrayRejection(): void {
    void Promise.reject(new Error("stray"));
  }

  public async hangs(): Promise<void> {
    await new Promise<void>(() => { });
  }

  public emitUnhandledRejectionOutsideTestExecution(reason: unknown): void {
    ExecutionFixture.OUTSIDE_TEST_EXECUTION.runInAsyncScope(() => process.emit("unhandledRejection", reason, Promise.resolve()));
  }
}
