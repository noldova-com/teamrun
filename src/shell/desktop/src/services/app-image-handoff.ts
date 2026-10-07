/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { StaleUpdateException } from "../exceptions/stale-update.exception.js";
import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import type { AppImageReplacement } from "./app-image-replacement.js";
import { UpdateController } from "./update-controller.js";

export class AppImageHandoff implements IUpdateHandoff {
  private readonly replacement: Pick<AppImageReplacement, "replaceAsync"> | null;

  public constructor(replacement: Pick<AppImageReplacement, "replaceAsync"> | null) {
    this.replacement = replacement;
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<null> {
    if (Object.isNull(this.replacement))
      throw new UpdateHandoffException(Resources.notAnAppImage);
    if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new StaleUpdateException(Resources.updateChangedBeforeHandoff);
    await this.replacement.replaceAsync(record.file);
    return null;
  }

  public clearAsync(): Promise<void> {
    return Promise.resolve();
  }
}
