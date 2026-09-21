/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { TestOutcome } from "../../enums/test-outcome.js";
import { TestingException } from "../../exceptions/testing-exception.js";
import { TestTimeoutException } from "../../exceptions/test-timeout-exception.js";
import type { DiscoveredTestClass } from "../../models/discovery/discovered-test-class.js";
import type { DiscoveredTestMethod } from "../../models/discovery/discovered-test-method.js";
import { TestClassResult } from "../../models/results/test-class-result.js";
import { TestMethodResult } from "../../models/results/test-method-result.js";
import { Resources } from "../../resources.js";

export class TestExecutor {
  private static readonly REJECTION_STORAGE: AsyncLocalStorage<unknown[]> = new AsyncLocalStorage<unknown[]>();
  private static readonly UNHANDLED_REJECTION_EVENT: string = "unhandledRejection";

  private static readonly ON_UNHANDLED_REJECTION = (t: unknown): void => {
    const rejections = TestExecutor.REJECTION_STORAGE.getStore();
    if (Object.isUndefined(rejections))
      throw t;

    rejections.push(t);
  };

  private readonly timeoutMilliseconds: number;

  public constructor(timeoutMilliseconds: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, "timeoutMilliseconds", Resources.timeoutInvalid);
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public async executeAsync(testClasses: readonly DiscoveredTestClass[]): Promise<TestClassResult[]> {
    const ownsRejectionListener = !process.listeners(TestExecutor.UNHANDLED_REJECTION_EVENT).includes(TestExecutor.ON_UNHANDLED_REJECTION);
    if (ownsRejectionListener)
      process.on(TestExecutor.UNHANDLED_REJECTION_EVENT, TestExecutor.ON_UNHANDLED_REJECTION);

    try {
      const classResults: TestClassResult[] = [];
      for (const testClass of testClasses) {
        const methodResults: TestMethodResult[] = [];
        for (const method of testClass.methods)
          methodResults.push(await this.executeMethodAsync(testClass, method));

        classResults.push(new TestClassResult(testClass.packageName, testClass.className, testClass.filePath, methodResults));
      }

      return classResults;
    }
    finally {
      if (ownsRejectionListener)
        process.off(TestExecutor.UNHANDLED_REJECTION_EVENT, TestExecutor.ON_UNHANDLED_REJECTION);
    }
  }

  private async executeMethodAsync(testClass: DiscoveredTestClass, method: DiscoveredTestMethod): Promise<TestMethodResult> {
    const skipReason = method.skipReason ?? testClass.skipReason;
    if (!Object.isUndefined(skipReason))
      return new TestMethodResult(
        testClass.packageName,
        testClass.className,
        method.methodName,
        method.testDataIndex,
        method.testData,
        TestOutcome.Skipped,
        0,
        undefined,
        skipReason);

    const start = performance.now();
    const unhandledRejections: unknown[] = [];
    let didFail = false;
    let failure: unknown;

    try {
      await TestExecutor.REJECTION_STORAGE.run(unhandledRejections, async () => {
        await this.invokeWithTimeoutAsync(testClass, method);
        await this.drainPendingRejectionsAsync();
      });

      if (unhandledRejections.length > 0) {
        didFail = true;
        failure = unhandledRejections[0];
      }
    }
    catch (error) {
      didFail = true;
      failure = error;
    }

    const durationMilliseconds = performance.now() - start;
    if (didFail)
      return new TestMethodResult(
        testClass.packageName,
        testClass.className,
        method.methodName,
        method.testDataIndex,
        method.testData,
        TestOutcome.Failed,
        durationMilliseconds,
        failure,
        undefined);

    return new TestMethodResult(
      testClass.packageName,
      testClass.className,
      method.methodName,
      method.testDataIndex,
      method.testData,
      TestOutcome.Passed,
      durationMilliseconds,
      undefined,
      undefined);
  }

  private async invokeWithTimeoutAsync(testClass: DiscoveredTestClass, method: DiscoveredTestMethod): Promise<void> {
    const instance: object = new testClass.testClassConstructor();
    const testMethod: unknown = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), method.methodName)?.value;
    if (typeof testMethod !== "function")
      throw new TestingException(Resources.methodNotCallable(method.methodName, testClass.className));

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new TestTimeoutException(this.timeoutMilliseconds)), this.timeoutMilliseconds);
    });

    try {
      await Promise.race([Promise.resolve(testMethod.call(instance, ...method.testData)), timeoutPromise]);
    }
    finally {
      if (!Object.isUndefined(timeoutHandle))
        clearTimeout(timeoutHandle);
    }
  }

  private async drainPendingRejectionsAsync(): Promise<void> {
    await new Promise<void>(t => setImmediate(t));
  }
}
