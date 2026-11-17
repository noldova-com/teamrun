/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

export class RecordedMcpServers {
  public static bearerOf(line: string): string {
    const [server] = JsonReader.parse(`{"servers":${line}}`).readObjectArray("servers");
    const [header] = server?.readObjectArray("headers") ?? [];
    return header?.readString("value").slice("Bearer ".length) ?? String.empty;
  }
}
