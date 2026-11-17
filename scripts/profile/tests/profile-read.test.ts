/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";

import { ProfileRead } from "../profile-read.ts";

const profile = path.join(import.meta.dirname, "fixtures", "small.cpuprofile");

const runAsync = async (args: readonly string[]): Promise<[number, string]> => {
  const output = new PassThrough();
  let text = "";
  output.on("data", (data: Buffer) => text += data.toString());
  const code = await new ProfileRead(output).runAsync(args);
  return [code, text];
};

describe("ProfileRead", () => {
  it("prints the span, the busy time and each group's time, then the top self-time functions with their source, callers and callers' source", async () => {
    const [code, text] = await runAsync([profile, "--groups", "keep,highlight", "--top", "2"]);

    assert.equal(code, 0);
    assert.equal(text, [
      "small.cpuprofile: span 15 ms, busy 8 ms; keep 3 ms, highlight 4 ms",
      "3 ms keep@app.js:10:4",
      "   src:     keep(items);",
      "   <- main@app.js:9:0 <- (root)@:0:-1",
      "   parent src: function main(items) {",
      "2 ms tokens@highlight.js:1:10",
      "   src: ",
      "   <- main@app.js:9:0 <- (root)@:0:-1",
      "   parent src: function main(items) {",
      ""
    ].join("\n"));
  });

  it("prints the top eight without groups by default", async () => {
    const [code, text] = await runAsync([profile]);

    assert.equal(code, 0);
    assert.match(text, /^small\.cpuprofile: span 15 ms, busy 8 ms\n/);
    assert.equal(text.split("\n").filter(t => / ms \S+@/.test(t)).length, 4);
  });

  it("shows the usage for a missing profile, an unknown option or a count that isn't a number", async () => {
    for (const args of [[], ["--top", "2"], [profile, "--top", "two"], [profile, "--depth", "2"], [profile, "--groups"]])
      assert.deepEqual(await runAsync(args), [2, ProfileRead.USAGE]);
  });

  it("fails with the reason for a missing file, a file that isn't JSON and an unknown group", async () => {
    const missing = path.join(import.meta.dirname, "fixtures", "missing.cpuprofile");
    const source = path.join(import.meta.dirname, "fixtures", "sources", "app.js");

    const [missingCode, missingText] = await runAsync([missing]);
    const [sourceCode, sourceText] = await runAsync([source]);
    const [groupCode, groupText] = await runAsync([profile, "--groups", "nothing"]);

    assert.deepEqual([missingCode, sourceCode, groupCode], [1, 1, 1]);
    assert.match(missingText, /missing\.cpuprofile: ENOENT/);
    assert.match(sourceText, /app\.js: .*JSON/s);
    assert.match(groupText, /"nothing" is neither a known group/);
  });
});
