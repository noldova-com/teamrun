/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";

import {
  type DiscoveredTestClass, type DiscoveredTestMethod, type ITestProgressListener, TestClassResult, type TestMethodResult, TestTimeoutException
} from "@noldova/context.testing";

export class PackageTestProgress implements ITestProgressListener {
  private readonly listener: ITestProgressListener;
  private readonly progressFile: string | null;
  private testClass: DiscoveredTestClass | null = null;
  private methodResults: TestMethodResult[] = [];
  private hasTimedOut: boolean = false;
  private running: string | null = null;

  public constructor(listener: ITestProgressListener, progressFile: string | null = null) {
    this.listener = listener;
    this.progressFile = progressFile;
  }

  public get isStopping(): boolean {
    return this.hasTimedOut;
  }

  public onMethodStarted(testClass: DiscoveredTestClass, method: DiscoveredTestMethod): void {
    if (this.testClass !== testClass) {
      this.testClass = testClass;
      this.methodResults = [];
    }
    this.running = `${testClass.className}.${method.displayName}`;
    this.record(true);
    this.listener.onMethodStarted?.(testClass, method);
  }

  public onMethodCompleted(methodResult: TestMethodResult): void {
    this.methodResults.push(methodResult);
    if (methodResult.failure instanceof TestTimeoutException)
      this.hasTimedOut = true;
    this.record(false);
    this.listener.onMethodCompleted?.(methodResult);
  }

  public onClassCompleted(classResult: TestClassResult): void {
    this.testClass = null;
    this.methodResults = [];
    this.listener.onClassCompleted(classResult);
  }

  private record(isRunning: boolean): void {
    if (this.progressFile === null || this.running === null)
      return;
    try {
      writeFileSync(this.progressFile, JSON.stringify({ test: this.running, isRunning }));
    }
    catch {
      return;
    }
  }

  public complete(classResults: readonly TestClassResult[]): TestClassResult[] {
    if (this.testClass === null)
      return [...classResults];
    const stopped = new TestClassResult(this.testClass.packageName, this.testClass.className, this.testClass.filePath, this.methodResults);
    this.onClassCompleted(stopped);
    return [...classResults, stopped];
  }
}
