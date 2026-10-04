/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly dueKind: string = "reminder.due";
  public static readonly dueTitle: string = "Time for a break";
  public static readonly dueText: string = "The reminder's runtime part posted this.";
  public static readonly remindCommand: string = "reminder.remind";
  public static readonly remindTitle: string = "Remind me";
  public static readonly failureMarker: string = "fail-activation";
  public static readonly failureMessage: string = "The reminder fixture was asked to fail its activation.";
}
