/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import WindowImportCheck from "../../checks/window-import-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class WindowImportCheckTests {
  public static register(): void {
    test("the window side may import the protocol, the kit, foundation and its own files, and other parts are not checked", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/window/src/app/app.ts": "import { Envelope } from \"@noldova/teamrun-shell-protocol\";\nimport { Button } from \"@noldova/teamrun-shell-ui\";\nimport { Panel } from \"./panel.ts\";\n",
        "src/shell/ui/tests/app/button.spec.ts": "import { JsonReader } from \"@noldova/teamrun-foundation-json\";\n",
        "src/modules/notes/window/src/view.ts": "import { NotesRequest } from \"@noldova/teamrun-modules-notes-protocol\";\nimport \"../../protocol/src/index.ts\";\n",
        "src/shell/desktop/tests/e2e/fixtures/modules/clock/window/src/face.ts": "import { Window } from \"@noldova/teamrun-shell-window\";\n",
        "src/shell/desktop/src/main.ts": "import { app } from \"electron\";\nimport { Runtime } from \"@noldova/teamrun-shell-runtime\";\n",
        "src/foundation/core/src/core.ts": "import { app } from \"electron\";\n",
        "src/modules/notes/runtime/src/store.ts": "import { Host } from \"@noldova/teamrun-shell-runtime\";\n",
        "src/shell/window/src/app/app.component.html": "<p>runtime</p>\n"
      });
      const output = new TextOutputFixture();

      const check = WindowImportCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the imports of 4 script files of the window, the kit and modules' window parts.\n");
      assert.equal(check.title, "Window imports");
    });

    test("a runtime, desktop or command-line package or path, Electron or a Node.js module imported from the window side fails with its file and line", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/window/src/app/app.ts": [
          "import { Runtime } from \"@noldova/teamrun-shell-runtime\";",
          "import { Client } from \"@noldova/teamrun-shell-runtime/client\";",
          "import { Desktop } from \"@noldova/teamrun-shell-desktop\";",
          "import { Cli } from \"@noldova/teamrun-shell-cli\";",
          "import { ipcRenderer } from \"electron\";",
          "import \"../../../runtime/src/host.ts\";",
          "import { readFile } from \"node:fs/promises\";",
          ""
        ].join("\n"),
        "src/shell/ui/src/app/button.ts": "import \"../../../desktop/src/preload.ts\";\n",
        "src/modules/notes/window/src/view.ts": "import \"@noldova/teamrun-modules-notes-runtime\";\nimport \"../../cli/src/command.ts\";\n",
        "src/shell/desktop/tests/e2e/fixtures/modules/clock/window/src/face.ts": "import \"@noldova/teamrun-fixture-clock-runtime\";\nimport \"../../runtime/src/clock.ts\";\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await WindowImportCheckTests.createCheck(repository).runAsync(output), false);
      const rule = "; ARCHITECTURE.md section 2 keeps the window, the kit and modules' window parts browser-safe, so they import no runtime, desktop or command-line package, Electron or Node.js module, and reach the runtime through @noldova/teamrun-shell-protocol and the preload bridge.";
      const fixture = "src/shell/desktop/tests/e2e/fixtures/modules/clock/window/src/face.ts";
      assert.equal(output.text, [
        `src/modules/notes/window/src/view.ts:1: imports "@noldova/teamrun-modules-notes-runtime"${rule}`,
        `src/modules/notes/window/src/view.ts:2: imports "../../cli/src/command.ts"${rule}`,
        `${fixture}:1: imports "@noldova/teamrun-fixture-clock-runtime"${rule}`,
        `${fixture}:2: imports "../../runtime/src/clock.ts"${rule}`,
        `src/shell/ui/src/app/button.ts:1: imports "../../../desktop/src/preload.ts"${rule}`,
        `src/shell/window/src/app/app.ts:1: imports "@noldova/teamrun-shell-runtime"${rule}`,
        `src/shell/window/src/app/app.ts:2: imports "@noldova/teamrun-shell-runtime/client"${rule}`,
        `src/shell/window/src/app/app.ts:3: imports "@noldova/teamrun-shell-desktop"${rule}`,
        `src/shell/window/src/app/app.ts:4: imports "@noldova/teamrun-shell-cli"${rule}`,
        `src/shell/window/src/app/app.ts:5: imports "electron"${rule}`,
        `src/shell/window/src/app/app.ts:6: imports "../../../runtime/src/host.ts"${rule}`,
        `src/shell/window/src/app/app.ts:7: imports "node:fs/promises"${rule}`,
        "Checked the imports of 4 script files of the window, the kit and modules' window parts.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): WindowImportCheck {
    const directory = repository.directory;
    return new WindowImportCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))));
  }
}

WindowImportCheckTests.register();
