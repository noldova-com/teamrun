/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProductIdentity from "../../packages/product-identity.ts";
import PackageTarget from "../../packaging/package-target.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleaseNotes from "../../release/release-notes.ts";
import ReleaseVersion from "../../release/release-version.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";

class ReleaseNotesTests {
  private static readonly RUN: string = "https://github.com/fixtureworks/studio/actions/runs/7";
  private static readonly VERSION: ReleaseVersion = ReleaseVersion.parse("0.0.7", "RELEASE_VERSION");
  private static readonly PRODUCT: ProductIdentity = ProductIdentity.fromManifest(ProductIdentityFixture.manifest());
  private static readonly OPENING: string = "Fixture Studio 0.0.7 for Windows, Linux and macOS, each on x64 and ARM64. Its packages are unsigned.";
  private static readonly RUN_PARAGRAPH: string = `Each target's package passed its install check on that target's own runner in the run that built it: ${ReleaseNotesTests.RUN}`;

  public static register(): void {
    test("a release to the product's own repository names the supported targets and those a CI run alone accepted, and links its run", () => {
      const supported = [new PackageTarget("windows", "x64"), new PackageTarget("linux", "x64"), new PackageTarget("macos", "x64")];

      const notes = ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, supported, "fixtureworks/studio", ReleaseNotesTests.VERSION, ReleaseNotesTests.RUN);

      assert.equal(notes, [
        ReleaseNotesTests.OPENING,
        "Supported after their native acceptance: Windows x64, Linux x64, macOS x64. Accepted by a CI run only: Windows ARM64, macOS ARM64, Linux ARM64.",
        ReleaseNotesTests.RUN_PARAGRAPH
      ].join("\n\n"));
    });

    test("with every target supported no target is named as accepted by CI only, and with none every target is", () => {
      const all = ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, PackageTarget.listAll(), "fixtureworks/studio", ReleaseNotesTests.VERSION, ReleaseNotesTests.RUN);
      const none = ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, [], "fixtureworks/studio", ReleaseNotesTests.VERSION, ReleaseNotesTests.RUN);

      assert.equal(all.split("\n\n")[1], "Supported after their native acceptance: Windows x64, Windows ARM64, macOS x64, macOS ARM64, Linux x64, Linux ARM64.");
      assert.equal(none.split("\n\n")[1], "No target has passed its native acceptance yet, so every target was accepted by a CI run only.");
    });

    test("a release to the product's own repository written in another case is no test release", () => {
      const notes = ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, [], "FixtureWorks/Studio", ReleaseNotesTests.VERSION, ReleaseNotesTests.RUN);

      assert.equal(notes.split("\n\n")[0], ReleaseNotesTests.OPENING);
    });

    test("a release to any other repository opens by marking itself an unsigned test release that installations never update from", () => {
      const notes = ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, [], "fixtureworks/studio-trial", ReleaseNotesTests.VERSION, ReleaseNotesTests.RUN);

      assert.deepEqual(notes.split("\n\n").slice(0, 2), [
        "Unsigned test release of Fixture Studio, published in fixtureworks/studio-trial; an installed Fixture Studio never updates from it.",
        ReleaseNotesTests.OPENING
      ]);
    });

    test("a run address that is not an https address is refused", () => {
      for (const run of ["", "github.com/runs/7", "http://github.com/runs/7"])
        assert.throws(() => ReleaseNotes.compose(ReleaseNotesTests.PRODUCT, [], "fixtureworks/studio", ReleaseNotesTests.VERSION, run),
          new ReleaseException(`RELEASE_RUN_URL must be the https address of the run that built the release, not "${run}".`), run);
    });
  }
}

ReleaseNotesTests.register();
