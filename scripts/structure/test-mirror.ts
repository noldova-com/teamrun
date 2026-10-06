/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export default class TestMirror {
  public static readonly SOURCE_FOLDER: string = "src";
  public static readonly TESTS_FOLDER: string = "tests";
  public static readonly TEST_SUFFIX: string = ".test.ts";
  public static readonly SPEC_SUFFIX: string = ".spec.ts";
  public static readonly SOURCE_EXTENSIONS: readonly string[] = [".ts", ".mts", ".cts"];
  public static readonly STYLE_EXTENSION: string = ".scss";
  private static readonly SCRIPTS_FOLDER: string = "scripts";
  private static readonly NESTED_SOURCE: string = "/src/";
  private static readonly ANGULAR_PACKAGE: RegExp = /^src\/(?:shell\/(?:ui|window)|modules\/[^/]+\/window)$/;
  private static readonly WORKFLOW_FOLDER: RegExp = /^src\/(?:shell\/desktop\/tests\/e2e|modules\/[^/]+\/e2e)\//;
  private static readonly DECLARATION: RegExp = /\.d\.[cm]?ts$/;

  public static findPackage(filePath: string): string[] {
    const index = filePath.indexOf(TestMirror.NESTED_SOURCE, TestMirror.SOURCE_FOLDER.length);
    return index < 0 ? [] : [filePath.slice(0, index)];
  }

  public static isAngularPackage(folder: string): boolean {
    return TestMirror.ANGULAR_PACKAGE.test(folder);
  }

  public static isWorkflow(filePath: string): boolean {
    return TestMirror.WORKFLOW_FOLDER.test(filePath);
  }

  public static isSource(filePath: string): boolean {
    return TestMirror.SOURCE_EXTENSIONS.includes(path.posix.extname(filePath)) && !TestMirror.DECLARATION.test(filePath);
  }

  public static suffixOf(folder: string): string {
    return TestMirror.isAngularPackage(folder) ? TestMirror.SPEC_SUFFIX : TestMirror.TEST_SUFFIX;
  }

  public static locate(filePath: string): string[] {
    const scripts = `${TestMirror.SCRIPTS_FOLDER}/`;
    const scriptTests = `${scripts}${TestMirror.TESTS_FOLDER}/`;
    if (filePath.startsWith(scripts))
      return filePath.startsWith(scriptTests) || !TestMirror.isSource(filePath)
        ? []
        : [`${scriptTests}${TestMirror.removeExtension(filePath.slice(scripts.length))}${TestMirror.TEST_SUFFIX}`];
    return TestMirror.findPackage(filePath).flatMap(t => {
      const isStyle = TestMirror.isAngularPackage(t) && path.posix.extname(filePath) === TestMirror.STYLE_EXTENSION;
      return TestMirror.isSource(filePath) || isStyle ? [TestMirror.mirrorOf(t, filePath)] : [];
    });
  }

  public static mirrorOf(folder: string, filePath: string): string {
    return `${folder}/${TestMirror.TESTS_FOLDER}/${TestMirror.removeExtension(filePath.slice(`${folder}/${TestMirror.SOURCE_FOLDER}/`.length))}${TestMirror.suffixOf(folder)}`;
  }

  private static removeExtension(filePath: string): string {
    return filePath.slice(0, -path.posix.extname(filePath).length);
  }
}
