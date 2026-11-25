/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPagePerformance {
  loaf: { duration: number; blocking: number; scripts: { invoker: string; fn: string; url: string; pos: number; duration: number }[] }[];
  events: { duration: number }[];
  keys: number[];
  frames: number[];
  sampling: boolean;
}

declare global {
  interface Window {
    __perf: IPagePerformance;
  }

  interface PerformanceObserverInit {
    durationThreshold?: number;
  }

  interface PerformanceScriptTiming extends PerformanceEntry {
    readonly invoker: string;
    readonly sourceFunctionName: string;
    readonly sourceURL: string;
    readonly sourceCharPosition: number;
  }

  interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
    readonly blockingDuration: number;
    readonly scripts: readonly PerformanceScriptTiming[];
  }

  var PerformanceLongAnimationFrameTiming: {
    prototype: PerformanceLongAnimationFrameTiming;
    new (): PerformanceLongAnimationFrameTiming;
  };
}
