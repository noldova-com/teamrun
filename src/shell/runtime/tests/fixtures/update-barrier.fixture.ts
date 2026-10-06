/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert } from "@noldova/teamrun-foundation-testing";
import type { Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { Installation, ProcessPresence, SystemCommand, UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

import type { RawConnectionFixture } from "./raw-connection.fixture.js";

export class UpdateBarrierFixture {
  public static readonly PRESENCE: ProcessPresence = ProcessPresence.create(process.platform, new SystemCommand(), process.env);

  public static open(folder: string): Installation {
    return new Installation(path.join(folder, "installation"), t => UpdateBarrierFixture.PRESENCE.isRunningAsync(t));
  }

  public static async holdAsync(installation: Installation, processId: number = process.pid): Promise<void> {
    const [holder] = await UpdateBarrierFixture.PRESENCE.stampAsync([[processId, "desktop"]]);
    Assert.isDefined(holder);
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing).toJson()));
  }

  public static async readEventAsync(connection: RawConnectionFixture, name: QualifiedName): Promise<Event> {
    for (;;) {
      const event = await connection.readEventAsync();
      if (event.name.equals(name))
        return event;
    }
  }
}
