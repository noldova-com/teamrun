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
import { type IRuntimePart, type IRuntimePartContext, RuntimeCommand } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    if (existsSync(path.join(context.moduleFolder, Resources.failureMarker)))
      throw new Error(Resources.failureMessage);

    context.registerCommand(new RuntimeCommand(Resources.remindCommand, Resources.remindTitle, null, null, {
      handleAsync: async () => {
        context.postNotification(new NotificationPost(
          QualifiedName.parse(Resources.dueKind), null, Resources.dueTitle, Resources.dueText, NotificationSeverity.Info, null, [], null));
        return null;
      }
    }));
  }

  public async deactivateAsync(): Promise<void> {
  }
}
