/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { JsonFields } from "../json-fields.ts";

describe("JsonFields", () => {
  it("reads a field of a JSON object", () => {
    assert.equal(JsonFields.read({ name: "teamrun" }, "name"), "teamrun");
  });

  it("reads no field of a value that is not a JSON object", () => {
    for (const value of [null, undefined, "name", 1, true, ["teamrun"]])
      assert.equal(JsonFields.read(value, "name"), undefined);
  });

  it("reads a missing field as undefined", () => {
    assert.equal(JsonFields.read({}, "name"), undefined);
  });

  it("copies a JSON object's fields into a record", () => {
    assert.deepEqual(JsonFields.record({ name: "teamrun", count: 2 }), { name: "teamrun", count: 2 });
  });

  it("makes an empty record of a value that is not a JSON object", () => {
    for (const value of [null, undefined, "name", 1, true, ["teamrun"]])
      assert.deepEqual(JsonFields.record(value), {});
  });

  it("reads a field of the object it holds", () => {
    const fields = new JsonFields({ wanted: 3 }, "shard.json");
    assert.equal(fields.field("wanted"), 3);
    assert.equal(fields.field("failed"), undefined);
  });

  it("refuses a list in place of an object", () => {
    assert.throws(() => new JsonFields([], "shard.json"), /shard\.json is not a JSON object\./);
  });
});
