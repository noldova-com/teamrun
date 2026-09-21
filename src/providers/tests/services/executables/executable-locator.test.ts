/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ExecutableLocator, ExecutableSource } from "@noldova/teamrun-providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ExecutableLocatorTests {
  @TestMethod
  public locatesTheNativeGrokExecutableAndHonoursOverrides(): void {
    using directory = new TemporaryDirectory();
    const local = ExecutableLocatorTests.touch(directory.path, ".grok", "bin", "grok.exe");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "grok");
    const windows = new ExecutableLocator("win32", "x64", [], directory.path);
    Assert.areEqual(local, windows.locateGrok(null)?.path);
    Assert.areEqual(ExecutableSource.Override, windows.locateGrok(local)?.source);
    Assert.isNull(windows.locateGrok(directory.resolve("missing")));
    Assert.areEqual(onPath, new ExecutableLocator("linux", "arm64", [directory.resolve("bin")], directory.path).locateGrok(null)?.path);
    Assert.isNull(new ExecutableLocator("linux", "x64", [], directory.path).locateGrok(null));
  }

  @TestMethod
  public prefersTheNativeCodexBinaryBehindTheWindowsShim(): void {
    using directory = new TemporaryDirectory();
    const prefix = directory.resolve("npm");
    const shim = ExecutableLocatorTests.touch(prefix, "codex.cmd");
    const native = ExecutableLocatorTests.touch(prefix, "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe");
    const locator = new ExecutableLocator("win32", "x64", [directory.resolve("empty"), prefix], directory.resolve("home"));

    const located = locator.locateCodex(null);
    const unknownArchitecture = new ExecutableLocator("win32", "mips", [prefix], directory.path).locateCodex(null);

    Assert.areEqual(native, located?.path);
    Assert.areEqual(ExecutableSource.GlobalNpm, located?.source);
    Assert.areEqual(shim, unknownArchitecture?.path);
    Assert.areEqual(ExecutableSource.Path, unknownArchitecture?.source);
  }

  @TestMethod
  public searchesTheAlternativeNpmLayoutsOnOtherPlatforms(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("usr", "bin");
    ExecutableLocatorTests.touch(bin, "codex");
    const flat = ExecutableLocatorTests.touch(directory.resolve("usr", "lib"), "node_modules", "@openai", "codex-linux-x64", "vendor", "x86_64-unknown-linux-musl", "bin", "codex");
    const direct = ExecutableLocatorTests.touch(bin, "node_modules", "@openai", "codex", "vendor", "x86_64-unknown-linux-musl", "bin", "codex");
    const shimOnly = directory.resolve("shim-only");
    const shim = ExecutableLocatorTests.touch(shimOnly, "codex");

    const located = new ExecutableLocator("linux", "x64", [bin], directory.path).locateCodex(null);
    const shimLocated = new ExecutableLocator("linux", "x64", [shimOnly], directory.path).locateCodex(null);
    const missing = new ExecutableLocator("linux", "x64", [directory.resolve("nowhere")], directory.path).locateCodex(null);

    Assert.areEqual(direct, located?.path);
    Assert.isTrue(flat.length > 0);
    Assert.areEqual(shim, shimLocated?.path);
    Assert.isNull(missing);
  }

  @TestMethod
  public locatesClaudeInTheLocalBinThenOnThePath(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const local = ExecutableLocatorTests.touch(home, ".local", "bin", "claude.exe");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "claude.cmd");
    const posix = ExecutableLocatorTests.touch(directory.resolve("posix"), "claude");

    const fromLocal = new ExecutableLocator("win32", "x64", [directory.resolve("bin")], home).locateClaude(null);
    const fromPath = new ExecutableLocator("win32", "x64", [directory.resolve("bin")], directory.resolve("other")).locateClaude(null);
    const fromPosixPath = new ExecutableLocator("linux", "x64", [directory.resolve("posix")], directory.resolve("other")).locateClaude(null);
    const missing = new ExecutableLocator("linux", "x64", [], directory.resolve("other")).locateClaude(null);

    Assert.areEqual(local, fromLocal?.path);
    Assert.areEqual(ExecutableSource.LocalBin, fromLocal?.source);
    Assert.areEqual(onPath, fromPath?.path);
    Assert.areEqual(posix, fromPosixPath?.path);
    Assert.isNull(missing);
  }

  @TestMethod
  public honoursAnOverrideOnlyWhenItExists(): void {
    using directory = new TemporaryDirectory();
    const existing = ExecutableLocatorTests.touch(directory.path, "custom-codex.exe");
    const locator = new ExecutableLocator("win32", "x64", [], directory.path);

    Assert.areEqual(ExecutableSource.Override, locator.locateCodex(existing)?.source);
    Assert.areEqual(ExecutableSource.Override, locator.locateClaude(existing)?.source);
    Assert.isNull(locator.locateCodex(directory.resolve("missing.exe")));
    Assert.isNull(locator.locateClaude(directory.resolve("missing.exe")));
  }

  @TestMethod
  public readsTheProcessEnvironment(): void {
    const locator = ExecutableLocator.fromProcess();

    Assert.isInstanceOf(locator, ExecutableLocator);
    Assert.areEqual(0, ExecutableLocator.splitPath(undefined).length);
    Assert.areEqual("a,b", ExecutableLocator.splitPath(["a", " ", "b", ""].join(delimiter)).join(","));
  }

  private static touch(...segments: readonly string[]): string {
    const path = join(...segments);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "");

    return path;
  }
}
