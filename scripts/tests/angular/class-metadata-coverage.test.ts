/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ClassMetadataCoverage from "../../angular/class-metadata-coverage.ts";

class ClassMetadataCoverageTests {
  private static readonly HINT: string = " /* v8 ignore next */";
  private static readonly LINE_BREAK: string = "\n";
  private static readonly TABBED: string = [
    "var MenuComponent = class _MenuComponent {",
    "\tstatic ɵfac = function MenuComponent_Factory(t) { return new (t || _MenuComponent)(); };",
    "};",
    "(() => {",
    "\t(typeof ngDevMode === \"undefined\" || ngDevMode) && i04.ɵsetClassMetadata(MenuComponent, [{",
    "\t\ttype: Component,",
    "\t\targs: [{ selector: \"tr-menu\", providers: [{ provide: CdkMenuTrigger, useExisting: forwardRef(() => MenuComponent) }] }]",
    "\t}], () => [], null);",
    "})();",
    "(() => {",
    "\t(typeof ngDevMode === \"undefined\" || ngDevMode) && i04.ɵsetClassDebugInfo(MenuComponent, { className: \"MenuComponent\" });",
    "})();"
  ].join("\n");
  private static readonly SPACED: string = [
    "var MenuItemComponent = class _MenuItemComponent {",
    "};",
    "(() => {",
    "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i03.\\u0275setClassMetadata(MenuItemComponent, [{",
    "    type: Component,",
    "    args: [{ selector: \"button[tr-menu-item]\", template: `<span>",
    "})();",
    "</span>` }]",
    "  }], () => [], null);",
    "})();",
    "var SeparatorComponent = class _SeparatorComponent {",
    "};",
    "(() => {",
    "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i03.\\u0275setClassMetadata(SeparatorComponent, [{ type: Component }], null, null);",
    "})();"
  ].join("\n");
  private static readonly LOOKALIKES: string = [
    "function setClassMetadata(type) {",
    "  return type;",
    "}",
    "(() => {",
    "  if (typeof ngDevMode === \"undefined\" || ngDevMode)",
    "    setClassMetadata(Own);",
    "})();",
    "(() => {",
    "  (typeof ngDevMode === \"undefined\" || ngDevMode) && core.ɵsetClassMetadata(Own, [], null, null);",
    "})();",
    "  (() => {",
    "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(Nested, [], null, null);",
    "})();",
    "(() => {",
    "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(Unclosed, [], null, null);",
    "  });",
    "(() => {"
  ].join("\n");

  public static register(): void {
    test("the dev-only class-metadata call of each class is marked for coverage to skip, by a hint at the end of the line before it, moving no line or column", () => {
      const coverage = new ClassMetadataCoverage();

      const marked = coverage.transform(ClassMetadataCoverageTests.TABBED, "/bundle/menu.js");

      const before = ClassMetadataCoverageTests.TABBED.split(ClassMetadataCoverageTests.LINE_BREAK);
      const after = marked?.code.split(ClassMetadataCoverageTests.LINE_BREAK) ?? [];
      assert.equal(after.length, before.length);
      assert.deepEqual(after.map((line, index) => line === before[index] ? null : line), [
        null, null, `};${ClassMetadataCoverageTests.HINT}`, null, null, null, null, null, null, null, null, null
      ]);
      assert.equal(marked?.map, null);
      assert.equal(coverage.summary, "Coverage ignores 1 compiler-generated class-metadata calls for 1 classes, which run only in development mode.");
    });

    test("several classes in one file are marked in both spellings the bundlers emit, even with a template literal that holds a closing line", () => {
      const coverage = new ClassMetadataCoverage();

      const marked = coverage.transform(ClassMetadataCoverageTests.SPACED, "/bundle/item.js")?.code.split(ClassMetadataCoverageTests.LINE_BREAK) ?? [];

      assert.deepEqual([marked[1], marked[11]], [`};${ClassMetadataCoverageTests.HINT}`, `};${ClassMetadataCoverageTests.HINT}`]);
      assert.equal(marked.filter(t => t.endsWith(ClassMetadataCoverageTests.HINT)).length, 2);
      assert.equal(coverage.summary, "Coverage ignores 2 compiler-generated class-metadata calls for 2 classes, which run only in development mode.");
    });

    test("code that only looks like the metadata call is left untouched: own functions, own ngDevMode checks, other namespaces and unclosed or nested shapes", () => {
      const coverage = new ClassMetadataCoverage();

      const marked = coverage.transform(ClassMetadataCoverageTests.LOOKALIKES, "/bundle/own.js");

      assert.equal(marked, null);
      assert.equal(coverage.summary, "Coverage ignores 0 compiler-generated class-metadata calls for 0 classes, which run only in development mode.");
    });

    test("the summary counts each module once however often it is transformed, and every class once across modules", () => {
      const coverage = new ClassMetadataCoverage();

      coverage.transform(ClassMetadataCoverageTests.TABBED, "/bundle/menu.js");
      coverage.transform(ClassMetadataCoverageTests.TABBED, "/bundle/menu.js");
      coverage.transform(ClassMetadataCoverageTests.TABBED, "/bundle/other-spec.js");
      coverage.transform(ClassMetadataCoverageTests.SPACED, "/bundle/item.js");
      coverage.transform(ClassMetadataCoverageTests.LOOKALIKES, "/bundle/item.js");

      assert.equal(coverage.summary, "Coverage ignores 2 compiler-generated class-metadata calls for 1 classes, which run only in development mode.");
    });

    test("as a plugin it runs last, works with its hooks detached, and reports the summary when the run closes", () => {
      const plugin = new ClassMetadataCoverage();
      const { transform, configureVitest } = plugin;
      const logged: string[] = [];
      const listeners: (() => void)[] = [];

      transform(ClassMetadataCoverageTests.TABBED, "/bundle/menu.js");
      configureVitest({ vitest: { logger: { log: message => logged.push(message) }, onClose: listener => listeners.push(listener) } });
      const loggedBeforeClose = [...logged];
      listeners.forEach(t => t());

      assert.deepEqual([plugin.name, plugin.enforce], ["teamrun-class-metadata-coverage", "post"]);
      assert.deepEqual(loggedBeforeClose, []);
      assert.deepEqual(logged, ["Coverage ignores 1 compiler-generated class-metadata calls for 1 classes, which run only in development mode."]);
    });
  }
}

ClassMetadataCoverageTests.register();
