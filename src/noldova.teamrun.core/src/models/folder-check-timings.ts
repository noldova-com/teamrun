/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class FolderCheckTimings {
  public readonly deadline: number;
  public readonly listWait: number;

  public constructor(deadline: number, listWait: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(deadline, Resources.deadlineParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(listWait, Resources.listWaitParameterName);

    this.deadline = deadline;
    this.listWait = listWait;
  }

  public static createDefault(): FolderCheckTimings {
    return new FolderCheckTimings(Resources.folderCheckDeadline, Resources.projectListWait);
  }
}
