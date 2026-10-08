/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ModuleNameMatcher from "../../structure/module-name-matcher.ts";

class ModuleNameMatcherTests {
  public static register(): void {
    test("a literal names a module by its id, a name the id owns, its package, folder, selector or token", () => {
      const matcher = new ModuleNameMatcher(["git", "git-hub"]);

      assert.deepEqual(
        ["git", "git-hub.open", "@noldova/teamrun-modules-git-hub-window", "../modules/git-hub/x", "tr-git-panel", "--tr-git-hub-accent"].map(t => matcher.findInLiteral(t)),
        ['module "git"', 'module "git-hub"', 'the module package "@noldova/teamrun-modules-git-hub-window"', 'module "git-hub"', 'module "git"', 'module "git-hub"']);
    });

    test("words that only contain an id name no module", () => {
      const matcher = new ModuleNameMatcher(["git"]);

      assert.deepEqual(
        ["digit", "gitter", "git-", "github.open", "modules/gitter", "submodules/git", "attr-git", "tr-gitter", "Git"].map(t => matcher.findInLiteral(t)),
        [null, null, null, null, null, null, null, null, null]);
    });

    test("text lines are searched for the modules' packages, folders, selectors and tokens but not for bare ids", () => {
      const matcher = new ModuleNameMatcher(["notes"]);

      assert.equal(matcher.findInText("<tr-notes-list></tr-notes-list>"), 'module "notes"');
      assert.equal(matcher.findInText("  color: var(--tr-notes-accent);"), 'module "notes"');
      assert.equal(matcher.findInText("Take notes here."), null);
      assert.equal(matcher.findInText("import \"@noldova/teamrun-modules-notes-runtime\";"), 'the module package "@noldova/teamrun-modules-notes-runtime"');
      assert.equal(matcher.findInText("@noldova/teamrun-modules-notes-cli"), 'the module package "@noldova/teamrun-modules-notes-cli"');
      assert.equal(matcher.findInText("import \"@noldova/teamrun-shell-runtime\";"), null);
    });
  }
}

ModuleNameMatcherTests.register();
