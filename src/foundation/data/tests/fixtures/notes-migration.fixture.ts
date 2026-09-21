/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "@noldova/teamrun-foundation-data";

export class NotesMigration extends Migration {
  public constructor(id: string = "20260908130000_Notes") {
    super(id);
  }
}
