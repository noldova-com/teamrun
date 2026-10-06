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
  public static readonly beginWorkCommand: string = "clock.beginWork";
  public static readonly beginWorkTitle: string = "Begin work";
  public static readonly finishWorkCommand: string = "clock.finishWork";
  public static readonly finishWorkTitle: string = "Finish the work";
  public static readonly workDescription: string = "Counting the ticks";
  public static readonly workBegan: string = "The clock began counting.";
  public static readonly startProgramCommand: string = "clock.startProgram";
  public static readonly startProgramTitle: string = "Start a program";
  public static readonly stopProgramCommand: string = "clock.stopProgram";
  public static readonly stopProgramTitle: string = "Stop the programs";
  public static readonly nodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly evaluateArgument: string = "-e";
  public static readonly programScript: string = [
    "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", \"setInterval(() => undefined, 1000)\"],",
    "{ detached: process.platform === \"win32\", stdio: \"ignore\", windowsHide: true });",
    "process.stdout.write(String(child.pid) + \"\\n\");",
    "setInterval(() => undefined, 1000);"
  ].join(" ");
  public static readonly programEndedMessage: string = "The clock's program ended before it named its child.";
  public static readonly stoppedMarker: string = "stopped";
  public static readonly abortEvent: string = "abort";
  public static readonly failureMarker: string = "fail-activation";
  public static readonly failureMessage: string = "The clock fixture was asked to fail its activation.";
}
