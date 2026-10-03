/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { type IRuntimePart, type IRuntimePartContext, Migration, RuntimeCommand } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public readonly migrations: readonly Migration[] = [new Migration(Resources.readingsMigration, [Resources.createReadingsStatement])];
  private ticks: number = 0;

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
    context.registerCommand(new RuntimeCommand(Resources.tickCommand, Resources.tickTitle, Resources.tickIcon, Resources.tickKey, {
      handleAsync: async () => {
        this.ticks++;
        ticked.publish({ ticks: this.ticks });
        return { ticks: this.ticks };
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
