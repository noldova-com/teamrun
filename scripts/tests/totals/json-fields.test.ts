/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import JsonFields from "../../totals/json-fields.ts";
import TotalsException from "../../totals/totals.exception.ts";

class JsonFieldsTests {
  public static register(): void {
    test("the fields of a JSON object are read by kind, nested objects name their place in the source", () => {
      const fields = JsonFields.parse(JSON.stringify({ count: 3, text: "a", texts: ["b", "c"], items: [{ name: "d" }], inner: { count: 0 }, empty: null }), "record.json");

      assert.equal(fields.count("count"), 3);
      assert.equal(fields.text("text"), "a");
      assert.deepEqual(fields.list("texts"), ["b", "c"]);
      assert.deepEqual(fields.texts("texts"), ["b", "c"]);
      assert.deepEqual(fields.objects("items").map(t => t.text("name")), ["d"]);
      assert.equal(fields.object("inner").count("count"), 0);
      assert.deepEqual([fields.has("inner"), fields.has("empty"), fields.has("missing")], [true, false, false]);
      assert.throws(() => fields.objects("items")[0]?.count("name"), new TotalsException("record.json, items 1, has no count name."));
      assert.throws(() => fields.object("inner").text("count"), new TotalsException("record.json, inner, has no text count."));
    });

    test("text that is not JSON, or JSON that is not an object, is refused with the source, keeping the parse error", () => {
      const notJson = (() => {
        try {
          JsonFields.parse("{", "record.json");
        }
        catch (error) {
          return error;
        }
        return null;
      })();

      assert.ok(notJson instanceof TotalsException);
      assert.equal(notJson.message, "record.json is not JSON.");
      assert.ok(notJson.cause instanceof SyntaxError);
      for (const text of ["null", "[]", "3"])
        assert.throws(() => JsonFields.parse(text, "record.json"), new TotalsException("record.json is not a JSON object."));
    });

    test("a field of the wrong kind is refused, and a count must be a whole number of at least zero", () => {
      const fields = JsonFields.parse(JSON.stringify({ negative: -1, fraction: 1.5, text: "3", number: 3, list: ["a", 1] }), "record.json");

      for (const name of ["negative", "fraction", "text", "missing"])
        assert.throws(() => fields.count(name), new TotalsException(`record.json has no count ${name}.`));
      assert.throws(() => fields.text("number"), new TotalsException("record.json has no text number."));
      assert.throws(() => fields.list("text"), new TotalsException("record.json has no list text."));
      assert.throws(() => fields.texts("list"), new TotalsException("record.json has a list list that is not all text."));
      assert.throws(() => fields.object("number"), new TotalsException("record.json, number, is not a JSON object."));
    });

    test("a number may be any finite number, and anything else is refused", () => {
      const fields = JsonFields.parse(JSON.stringify({ negative: -1, fraction: 1.25, text: "3", huge: 1e999 }), "record.json");

      assert.deepEqual([fields.number("negative"), fields.number("fraction")], [-1, 1.25]);
      for (const name of ["text", "huge", "missing"])
        assert.throws(() => fields.number(name), new TotalsException(`record.json has no number ${name}.`));
    });
  }
}

JsonFieldsTests.register();
