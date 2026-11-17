/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { CpuProfile } from "../cpu-profile.ts";
import { ProfileException } from "../profile.exception.ts";
import { ProfileGroup } from "../profile-group.ts";

const fixture = (): CpuProfile => CpuProfile.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "small.cpuprofile"), "utf8"));

describe("CpuProfile", () => {
  it("tells the span and the busy time, leaving out idle, program and root samples", () => {
    const profile = fixture();

    assert.deepEqual([profile.spanMilliseconds, profile.busyMilliseconds], [15, 7.5]);
  });

  it("gives each group the inclusive time of the samples in or under its functions, counting a sample once though both a function and its caller match", () => {
    const groups = ["keep", "highlight", "overlay", "lines=tokenizeLine2"].map(t => ProfileGroup.parse(t));

    assert.deepEqual([...fixture().inclusiveMillisecondsOf(groups)], [["keep", 3], ["highlight", 3.5], ["overlay", 0], ["lines", 1.5]]);
  });

  it("lists the functions with the most self time, without idle, program, garbage collection and root, each with its callers nearest first", () => {
    const top = fixture().topSelfTimes(3);

    assert.deepEqual(top.map(t => [t.node.label, t.milliseconds]), [["keep@app.js:10:4", 3], ["tokens@highlight.js:1:10", 2], ["tokenizeLine2@highlight.js:3:0", 1.5]]);
    assert.deepEqual(top[2]!.callers.map(t => t.functionName), ["tokens", "main", "(root)"]);
  });

  it("refuses a file that isn't a CPU profile, and a sample of a node it doesn't list", () => {
    assert.throws(() => CpuProfile.parse("{\"nodes\": []}"), ProfileException);
    assert.throws(() => CpuProfile.parse("{\"nodes\": [{\"id\": 1}], \"samples\": [], \"timeDeltas\": [], \"startTime\": 0, \"endTime\": 0}"), ProfileException);
    assert.throws(() => CpuProfile.parse("{\"nodes\": [], \"samples\": [7], \"timeDeltas\": [1], \"startTime\": 0, \"endTime\": 1}").busyMilliseconds, /node 7/);
  });
});

describe("ProfileGroup", () => {
  it("takes a known group by name or a named list of functions, and refuses anything else", () => {
    assert.deepEqual([...ProfileGroup.parse("overlay").functionNames], ["reposition", "show", "boundsFor"]);
    assert.deepEqual([...ProfileGroup.parse("mine=a+$b").functionNames], ["a", "$b"]);
    assert.throws(() => ProfileGroup.parse("unknown"), /neither a known group, keep, overlay, highlight/);
    assert.throws(() => ProfileGroup.parse("mine="), ProfileException);
  });
});
