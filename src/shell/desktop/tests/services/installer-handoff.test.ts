/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InstallerHandoff, UpdateHandoffException, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";

class InstallerHandoffFixture {
  public static readonly CONTENT: string = "TeamRun 1.3.0 installer";

  public readonly folder: string;
  public readonly protectedFolders: string[] = [];
  public readonly opened: string[] = [];
  public readonly closed: bigint[] = [];
  public readonly started: string[] = [];
  public hold: bigint | number = 7n;
  public start: (installer: string) => Promise<number> = () => Promise.resolve(4120);
  public readonly handoff: InstallerHandoff;

  private constructor(folder: string) {
    this.folder = folder;
    this.handoff = new InstallerHandoff(join(folder, "installation"), t => {
      this.protectedFolders.push(t);
      return Promise.resolve();
    }, {
      openFileForReading: t => {
        this.opened.push(t);
        return this.hold;
      },
      closeHandle: t => {
        this.closed.push(t);
      }
    }, t => {
      this.started.push(t);
      return this.start(t);
    });
  }

  public get download(): string {
    return join(this.folder, "cache", "pending", "TeamRun-windows-x64.exe");
  }

  public static async runAsync(run: (fixture: InstallerHandoffFixture) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-installer-handoff-"));
    try {
      const fixture = new InstallerHandoffFixture(folder);
      await mkdir(dirname(fixture.download), { recursive: true });
      await writeFile(fixture.download, InstallerHandoffFixture.CONTENT);
      await run(fixture);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  public record(sha512: string = createHash("sha512").update(InstallerHandoffFixture.CONTENT).digest("base64")): UpdateReadyRecord {
    return new UpdateReadyRecord("1.3.0", this.download, sha512, true);
  }
}

@TestClass
export class InstallerHandoffTests {
  @TestMethod
  public startsAHeldCheckedCopyInAFolderOfItsOwnAndKeepsHoldingItOnceStarted(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const processId = await fixture.handoff.handOffAsync(fixture.record());
      const copy = String(fixture.started[0]);

      Assert.areEqual(4120, processId);
      Assert.areEqual(join(fixture.folder, "installation", "handoff"), dirname(dirname(copy)));
      Assert.areEqual("TeamRun-windows-x64.exe", copy.slice(dirname(copy).length + 1));
      Assert.areEqual(InstallerHandoffFixture.CONTENT, await readFile(copy, "utf8"));
      Assert.areEqual(JSON.stringify([dirname(copy)]), JSON.stringify(fixture.protectedFolders));
      Assert.areEqual(JSON.stringify([copy]), JSON.stringify(fixture.opened));
      Assert.areEqual(0, fixture.closed.length);
      Assert.isTrue(existsSync(fixture.download));
    });
  }

  @TestMethod
  public refusesACopyItCannotHoldWithoutStartingIt(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      fixture.hold = 32;

      const failure = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);

      Assert.areEqual("The update's installer couldn't be held unchanged for its start (Windows error 32).", failure.message);
      Assert.areEqual(0, fixture.started.length);
      Assert.areEqual(0, fixture.closed.length);
    });
  }

  @TestMethod
  public letsGoOfACopyThatChangedOrThatTheStartRefuses(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const changed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record("b3RoZXI=")), UpdateHandoffException);
      const startsBefore = fixture.started.length;
      const refusal = new UpdateHandoffException("The update isn't signed by the publisher.");
      fixture.start = () => Promise.reject(refusal);
      const refused = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(0, startsBefore);
      Assert.areEqual(refusal, refused);
      Assert.areEqual(JSON.stringify(["7", "7"]), JSON.stringify(fixture.closed.map(String)));
      Assert.areEqual(2, (await readdir(join(fixture.folder, "installation", "handoff"))).length);
    });
  }

  @TestMethod
  public removesTheCopiesEarlierHandoffsLeftAndLogsOnesItCannotRemove(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const installation = join(fixture.folder, "installation");
      const handoff = join(installation, "handoff");
      await mkdir(join(handoff, "0123"), { recursive: true });
      await writeFile(join(handoff, "0123", "TeamRun-windows-x64.exe"), InstallerHandoffFixture.CONTENT);
      const lines: string[] = [];

      {
        using _rm = new FailingFileCallFixture("rm", handoff, "EBUSY");
        await InstallerHandoff.clearAsync(installation, t => lines.push(t));
      }
      const isKept = existsSync(handoff);
      await InstallerHandoff.clearAsync(installation, t => lines.push(t));
      await InstallerHandoff.clearAsync(installation, t => lines.push(t));

      Assert.isTrue(isKept);
      Assert.isFalse(existsSync(handoff));
      Assert.areEqual(1, lines.length);
      Assert.isTrue(lines[0]?.startsWith("The copy of an update's installer could not be removed, so it is removed at the next start: Error: EBUSY") === true, lines[0]);
    });
  }
}
