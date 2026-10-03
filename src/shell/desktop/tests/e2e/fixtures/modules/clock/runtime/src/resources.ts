/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly timeMethod: string = "clock.time";
  public static readonly recordMethod: string = "clock.record";
  public static readonly readingsMigration: string = "create-readings";
  public static readonly createReadingsStatement: string = "CREATE TABLE readings (time TEXT NOT NULL) STRICT";
  public static readonly insertReadingStatement: string = "INSERT INTO readings (time) VALUES (?)";
  public static readonly countReadingsStatement: string = "SELECT count(*) AS count FROM readings";
  public static readonly countColumn: string = "count";
  public static readonly tickedEvent: string = "clock.ticked";
  public static readonly alarmKind: string = "clock.alarm";
  public static readonly alarmTitle: string = "The clock started";
  public static readonly alarmText: string = "Its runtime part is running.";
  public static readonly syncKind: string = "clock.sync";
  public static readonly syncTitle: string = "Syncing the clock";
  public static readonly tickedKey: string = "ticked";
  public static readonly tickedTitle: string = "The clock ticked";
  public static readonly tickCommand: string = "clock.tick";
  public static readonly tickTitle: string = "Tick";
  public static readonly tickIcon: string = "timer";
  public static readonly tickKey: string = "Mod+Alt+T";
  public static readonly pauseCommand: string = "clock.pause";
  public static readonly pauseTitle: string = "Pause ticking";
  public static readonly tickStepSetting: string = "clock.tickStep";
  public static readonly failureMarker: string = "fail-activation";
  public static readonly failureMessage: string = "The clock fixture was asked to fail its activation.";
}
