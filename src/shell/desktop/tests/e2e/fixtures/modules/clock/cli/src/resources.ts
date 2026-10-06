/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly showTimeCommand: string = "clock.showTime";
  public static readonly timeMethod: string = "clock.time";
  public static readonly timeField: string = "time";
  public static readonly prefixOption: string = "prefix";

  public static formatTime(prefix: string, time: string): string {
    return `${prefix} ${time}.`;
  }
}
