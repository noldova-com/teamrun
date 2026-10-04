/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { type IRuntimePart, type IRuntimePartContext, Migration, ProcessRequest, RuntimeCommand, type WorkItem } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public readonly migrations: readonly Migration[] = [new Migration(Resources.readingsMigration, [Resources.createReadingsStatement])];
  private ticks: number = 0;
  private readonly work: WorkItem[] = [];

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    if (existsSync(path.join(context.moduleFolder, Resources.failureMarker)))
      throw new Error(Resources.failureMessage);

    context.registerMethod(Resources.timeMethod, { handleAsync: async () => ({ time: new Date().toISOString() }) });
    const database = context.database;
    context.registerMethod(Resources.recordMethod, {
      handleAsync: async () => {
        database.run(Resources.insertReadingStatement, new Date().toISOString());
        return { readings: Number(database.read(Resources.countReadingsStatement)?.[Resources.countColumn]) };
      }
    });
    const ticked = context.declareEvent(Resources.tickedEvent);
    const tick = new RuntimeCommand(Resources.tickCommand, Resources.tickTitle, Resources.tickIcon, Resources.tickKey, {
      handleAsync: async () => {
        this.ticks += Number(context.settings.read(Resources.tickStepSetting));
        ticked.publish({ ticks: this.ticks });
        context.postNotification(new NotificationPost(
          QualifiedName.parse(Resources.alarmKind), Resources.tickedKey, Resources.tickedTitle, `Ticks: ${this.ticks}`, NotificationSeverity.Success, null, [], null));
        return { ticks: this.ticks };
      }
    });
    const pause: RuntimeCommand = new RuntimeCommand(Resources.pauseCommand, Resources.pauseTitle, null, null, {
      handleAsync: async () => {
        const isPaused = pause.info.isChecked !== true;
        pause.setChecked(isPaused);
        tick.setEnabled(!isPaused);
        return { isPaused };
      }
    }, false);
    context.registerCommand(tick);
    context.registerCommand(pause);
    context.registerCommand(new RuntimeCommand(Resources.beginWorkCommand, Resources.beginWorkTitle, null, null, {
      handleAsync: async () => {
        const folder = await context.getWorkFolderAsync();
        const work = context.beginWork(Resources.workDescription);
        context.log.write(Resources.workBegan);
        work.signal.addEventListener(Resources.abortEvent, () => {
          writeFileSync(path.join(folder, Resources.stoppedMarker), "");
          work[Symbol.dispose]();
        }, { once: true });
        this.work.push(work);
        return null;
      }
    }));
    context.registerCommand(new RuntimeCommand(Resources.startProgramCommand, Resources.startProgramTitle, null, null, {
      handleAsync: async () => {
        const owned = await context.startProcessAsync(new ProcessRequest(
          process.execPath, [Resources.evaluateArgument, Resources.programScript], await context.getWorkFolderAsync(), { [Resources.nodeVariable]: "1" }, []));
        for await (const line of createInterface({ input: owned.output }))
          return { processId: owned.processId, childProcessId: Number(line) };
        throw new Error(Resources.programEndedMessage);
      }
    }));
    context.registerCommand(new RuntimeCommand(Resources.finishWorkCommand, Resources.finishWorkTitle, null, null, {
      handleAsync: async () => {
        for (const work of this.work.splice(0))
          work[Symbol.dispose]();
        return null;
      }
    }));
    context.postNotification(new NotificationPost(
      QualifiedName.parse(Resources.alarmKind), null, Resources.alarmTitle, Resources.alarmText, NotificationSeverity.Info, null, [], null));
    context.postNotification(new NotificationPost(
      QualifiedName.parse(Resources.syncKind), null, Resources.syncTitle, null, NotificationSeverity.Info, null, [], NotificationPost.indeterminate));
  }

  public async deactivateAsync(): Promise<void> {
  }
}
