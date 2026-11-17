/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallStaging } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class InstallStagingTests {
  @TestMethod
  public opensAFreshStagingFolderRemovingTheOnesAStoppedInstallLeftAndKeepingTheRest(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve(".teamrun-staging-left", "1.3.0"), { recursive: true });
    writeFileSync(directory.resolve(".teamrun-staging-file"), "left");
    mkdirSync(directory.resolve(".staging-other", "kept"), { recursive: true });
    mkdirSync(directory.resolve("1.3.0"));

    const staging = InstallStaging.open(directory.path);

    Assert.areEqual(directory.path, dirname(staging));
    Assert.isTrue(basename(staging).startsWith(".teamrun-staging-"), staging);
    Assert.areEqual([".staging-other", "1.3.0", basename(staging)].sort().join(","), readdirSync(directory.path).sort().join(","));
    Assert.isTrue(existsSync(directory.resolve(".staging-other", "kept")));
    Assert.areEqual(0, readdirSync(staging).length);
    writeFileSync(join(staging, "download"), "data");
    InstallStaging.close(staging);
    Assert.isFalse(existsSync(staging));
    Assert.areEqual(".staging-other,1.3.0", readdirSync(directory.path).sort().join(","));
  }

  @TestMethod
  public sweepsTheStagingFoldersAStoppedInstallLeftWithoutOpeningANewOneAndCreatesOneApart(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve(".teamrun-staging-left"));
    mkdirSync(directory.resolve(".staging-other"));
    mkdirSync(directory.resolve("1.3.0"));

    InstallStaging.sweep(directory.path);
    const swept = readdirSync(directory.path).sort().join(",");
    InstallStaging.sweep(directory.resolve("missing"));
    const staging = InstallStaging.create(directory.resolve("tools"));

    Assert.areEqual(".staging-other,1.3.0", swept);
    Assert.isFalse(existsSync(directory.resolve("missing")));
    Assert.areEqual(directory.resolve("tools"), dirname(staging));
    Assert.isTrue(basename(staging).startsWith(".teamrun-staging-") && existsSync(staging), staging);
  }

  @TestMethod
  public sweepsTheStagingFoldersAStoppedInstallLeftButThoseThatHoldWhatItKeeps(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve(".teamrun-staging-kept", "previous"), { recursive: true });
    mkdirSync(directory.resolve(".teamrun-staging-left", "download"), { recursive: true });
    mkdirSync(directory.resolve("1.3.0"));

    InstallStaging.sweepKeeping(directory.path, "previous");
    const swept = readdirSync(directory.path).sort().join(",");
    InstallStaging.sweepKeeping(directory.resolve("missing"), "previous");

    Assert.areEqual(".teamrun-staging-kept,1.3.0", swept);
    Assert.isTrue(existsSync(directory.resolve(".teamrun-staging-kept", "previous")));
    Assert.isFalse(existsSync(directory.resolve("missing")));
  }

  @TestMethod
  public tidiesEveryStagingFolderAfterAnInstallAndNeverThrowsWhenItCant(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve(".teamrun-staging-kept", "previous"), { recursive: true });
    mkdirSync(directory.resolve("1.3.0"));
    writeFileSync(directory.resolve("file"), "not a folder");

    InstallStaging.tidy(directory.path);
    const tidied = readdirSync(directory.path).sort().join(",");
    InstallStaging.tidy(directory.resolve("file"));
    const failure = Assert.throws(() => InstallStaging.sweep(directory.resolve("file")), Error);

    Assert.areEqual("1.3.0,file", tidied);
    Assert.areEqual("ENOTDIR", (failure as NodeJS.ErrnoException).code);
  }

  @TestMethod
  public throwsTheReasonForAFolderThatCantBeWrittenWithTheErrorAsItsCauseAndAnyOtherErrorAsItIs(): void {
    for (const code of ["EACCES", "EPERM", "EROFS"]) {
      const refused = Object.assign(new Error(code), { code });
      const failure = Assert.throws(() => InstallStaging.writing("unwritable", () => {
        throw refused;
      }), Error);
      Assert.areEqual("unwritable", failure.message, code);
      Assert.areEqual(refused, failure.cause, code);
    }
    const other = Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });

    Assert.areEqual(other, Assert.throws(() => InstallStaging.writing("unwritable", () => {
      throw other;
    }), Error));
    Assert.areEqual(7, InstallStaging.writing("unwritable", () => 7));
  }

  @TestMethod
  public createsTheFolderItStagesInWhenItIsMissing(): void {
    using directory = new TemporaryDirectory();

    const staging = InstallStaging.open(directory.resolve("tools", "claude"));

    Assert.areEqual(directory.resolve("tools", "claude"), dirname(staging));
    Assert.isTrue(existsSync(staging));
  }
}
