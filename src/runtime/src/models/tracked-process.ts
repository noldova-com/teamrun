/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

export class TrackedProcess {
  public readonly processId: number;
  public readonly executable: string;
  public readonly runtimeProcessId: number;

  public constructor(processId: number, executable: string, runtimeProcessId: number) {
    this.processId = processId;
    this.executable = executable;
    this.runtimeProcessId = runtimeProcessId;
  }

  public static fromJson(value: JsonValue): TrackedProcess | null {
    try {
      const reader = JsonReader.fromValue(value);
      return new TrackedProcess(reader.readInteger("processId"), reader.readString("executable"), reader.readInteger("runtimeProcessId"));
    }
    catch {
      return null;
    }
  }

  public toJson(): JsonObject {
    return { processId: this.processId, executable: this.executable, runtimeProcessId: this.runtimeProcessId };
  }
}
