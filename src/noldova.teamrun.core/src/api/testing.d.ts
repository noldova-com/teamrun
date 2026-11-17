/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITimer } from "./index.js";

/**
 * One wait on a {@link ManualTimer}, which ends when the timer passes its deadline or its signal aborts.
 */
export declare class ManualDelay {
  /**
   * The timer's time at which the wait ends.
   */
  public readonly deadline: number;

  /**
   * Starts a wait that ends at the given time.
   * @param deadline The timer's time at which the wait ends.
   */
  public constructor(deadline: number);

  /**
   * Settles when the wait ends: resolved once it elapses, rejected once it is cancelled.
   */
  public get promise(): Promise<void>;

  /**
   * Ends the wait as elapsed.
   */
  public elapse(): void;

  /**
   * Ends the wait early.
   * @param reason What the wait rejects with.
   */
  public cancel(reason: unknown): void;
}

/**
 * A timer for tests, whose time moves only when the test advances it.
 */
export declare class ManualTimer implements ITimer {
  /**
   * How many waits haven't ended yet.
   */
  public get pending(): number;

  /**
   * How many waits have begun.
   */
  public get begun(): number;

  /**
   * Counts the waits that haven't ended and would end if the test advanced the timer by the given time, telling a short wait from a long one.
   * @param milliseconds How far the test would advance the timer.
   * @returns How many such waits there are.
   */
  public pendingWithin(milliseconds: number): number;

  /**
   * Settles when the next wait begins.
   */
  public get delayed(): Promise<void>;

  /**
   * Tells the timer's time.
   * @returns The milliseconds the test has advanced the timer, from zero.
   */
  public now(): number;

  /**
   * Waits until the test advances the timer by the given time.
   * @param milliseconds How long to wait, in the timer's time.
   * @param signal Ends the wait early, rejecting it with the signal's reason.
   */
  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void>;

  /**
   * Moves the timer's time forward, ending every wait whose deadline it reaches.
   * @param milliseconds How far to move the time.
   */
  public advance(milliseconds: number): void;

  /**
   * Moves the clock `now` tells and ends no wait, as when the system sleeps or its clock is set while a wait runs.
   * A wait counts only the time `advance` moves.
   * @param milliseconds How far to move the clock.
   */
  public jump(milliseconds: number): void;
}
