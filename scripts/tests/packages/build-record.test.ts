/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import BuildRecord from "../../packages/build-record.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class BuildRecordTests {
  public static register(): void {
    test("a written record matches only the same inputs and outputs", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = path.join(repository.directory, "_build", "records", "shell-ui.txt");
      const outputs = ["archive", "installed"];
      const record = new BuildRecord("inputs", outputs);
      outputs.push("changed after construction");

      assert.equal(await record.isRecordedAsync(file), false);
      await record.writeAsync(file);

      assert.equal(await readFile(file, "utf8"), "inputs inputs\noutput archive\noutput installed\n");
      assert.equal(record.inputs, "inputs");
      assert.deepEqual(record.outputs, ["archive", "installed"]);
      assert.equal(await new BuildRecord("inputs", ["archive", "installed"]).isRecordedAsync(file), true);
      for (const other of [new BuildRecord("other", ["archive", "installed"]), new BuildRecord("inputs", ["archive"]), new BuildRecord("inputs", ["installed", "archive"])])
        assert.equal(await other.isRecordedAsync(file), false);
    });
  }
}

BuildRecordTests.register();
