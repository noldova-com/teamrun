/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from "@noldova/teamrun-foundation-data";
import { SqlProvider } from "@noldova/teamrun-foundation-data-sql";

import { RecordingConnection } from "./recording-connection.fixture.js";

export class RecordingProvider extends SqlProvider {
  public override openConnection(dataSource: DataSource): RecordingConnection {
    return new RecordingConnection(dataSource);
  }
}
