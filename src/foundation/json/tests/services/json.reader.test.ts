/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { JsonReader, JsonException } from "@noldova/teamrun-foundation-json";

@TestClass
export class JsonReaderTests {
  @TestMethod
  public parsesValidText(): void {
    const reader = JsonReader.parse("{\"name\":\"team run\"}");

    Assert.areEqual("team run", reader.readString("name"));
  }

  @TestMethod
  public rejectsInvalidTextAtTheRoot(): void {
    const exception = Assert.throws(() => JsonReader.parse("{not json"), JsonException);

    Assert.areEqual("$", exception.path);
    Assert.isTrue(exception.message.includes("not valid JSON"));
    Assert.isInstanceOf(exception.cause, SyntaxError);
  }

  @TestMethod
  public rejectsValuesThatAreNotObjects(): void {
    Assert.areEqual("$", Assert.throws(() => JsonReader.fromValue([1, 2]), JsonException).path);
    Assert.areEqual("$", Assert.throws(() => JsonReader.fromValue("text"), JsonException).path);
    Assert.areEqual("$", Assert.throws(() => JsonReader.fromValue(null), JsonException).path);
    Assert.areEqual("$.custom", Assert.throws(() => JsonReader.fromValue(42, "$.custom"), JsonException).path);
  }

  @TestMethod
  public narrowsNestedValuesAndDropsUndefinedMembers(): void {
    const json = JsonReader.toJsonValue({ a: [1, "two", true, null, { b: undefined, c: 3 }], d: undefined });

    Assert.areEqual("{\"a\":[1,\"two\",true,null,{\"c\":3}]}", JSON.stringify(json));
  }

  @TestMethod
  public preservesPrototypeNamedFieldsAsOrdinaryJsonData(): void {
    const text = '{"__proto__":{"marker":true},"constructor":"data","toString":null,"nested":[{"__proto__":null}]}';
    const reader = JsonReader.parse(text);

    Assert.areEqual(text, JSON.stringify(reader.toJson()));
    Assert.isTrue(reader.hasField("__proto__"));
    Assert.isTrue(reader.readObject("__proto__").readBoolean("marker"));
    Assert.areEqual("data", reader.readString("constructor"));
    Assert.isNull(reader.readValue("toString"));
    Assert.areEqual(Object.prototype, Object.getPrototypeOf(reader.toJson()));

    for (const nested of reader.readObjectArray("nested")) {
      Assert.isTrue(nested.hasField("__proto__"));
      Assert.isNull(nested.readValue("__proto__"));
      Assert.areEqual(Object.prototype, Object.getPrototypeOf(nested.toJson()));
    }
  }

  @TestMethod
  public rejectsAnObjectCycleAtTheReferencingField(): void {
    const value: { self?: unknown } = {};
    value.self = value;

    const exception = Assert.throws(() => JsonReader.fromValue(value, "$.payload"), JsonException);

    Assert.areEqual("$.payload.self", exception.path);
    Assert.areEqual("$.payload.self: Circular references cannot be carried as JSON.", exception.message);
  }

  @TestMethod
  public rejectsAnArrayCycleAtTheReferencingItem(): void {
    const value: unknown[] = [];
    value.push(value);

    const exception = Assert.throws(() => JsonReader.toJsonValue(value), JsonException);

    Assert.areEqual("$.0", exception.path);
    Assert.areEqual("$.0: Circular references cannot be carried as JSON.", exception.message);
  }

  @TestMethod
  public rejectsAnIndirectCycleThroughObjectsAndArrays(): void {
    const children: unknown[] = [];
    const value = { children };
    children.push({ parent: value });

    const exception = Assert.throws(() => JsonReader.fromValue(value), JsonException);

    Assert.areEqual("$.children.0.parent", exception.path);
  }

  @TestMethod
  public acceptsSharedObjectsAndArraysWithoutCycles(): void {
    const shared = { name: "shared" };
    const items = [shared];
    const reader = JsonReader.fromValue({ first: shared, second: shared, lists: [items, items] });

    Assert.areEqual('{"first":{"name":"shared"},"second":{"name":"shared"},"lists":[[{"name":"shared"}],[{"name":"shared"}]]}', JSON.stringify(reader.toJson()));
    Assert.isFalse(reader.readValue("first") === reader.readValue("second"));
  }

  @TestMethod
  public rejectsValuesJsonCannotCarry(): void {
    Assert.areEqual("$.a.0", Assert.throws(() => JsonReader.toJsonValue({ a: [Number.NaN] }), JsonException).path);
    Assert.areEqual("$.b", Assert.throws(() => JsonReader.toJsonValue({ b: Number.POSITIVE_INFINITY }), JsonException).path);
    Assert.areEqual("$.c", Assert.throws(() => JsonReader.toJsonValue({ c: (): void => undefined }), JsonException).path);
    Assert.areEqual("$.d", Assert.throws(() => JsonReader.toJsonValue({ d: Symbol("s") }), JsonException).path);
    Assert.areEqual("$.e", Assert.throws(() => JsonReader.toJsonValue({ e: 10n }), JsonException).path);
    Assert.areEqual("$", Assert.throws(() => JsonReader.toJsonValue(undefined), JsonException).path);
  }

  @TestMethod
  public reportsPresenceIncludingNull(): void {
    const reader = JsonReader.fromValue({ present: null });

    Assert.isTrue(reader.hasField("present"));
    Assert.isFalse(reader.hasField("absent"));
  }

  @TestMethod
  public readsRequiredStrings(): void {
    const reader = JsonReader.fromValue({ name: "value", empty: String.empty, count: 1, nothing: null });

    Assert.areEqual("value", reader.readString("name"));
    Assert.areEqual(String.empty, reader.readString("empty"));
    Assert.areEqual("$.count", Assert.throws(() => reader.readString("count"), JsonException).path);
    Assert.areEqual("$.nothing", Assert.throws(() => reader.readString("nothing"), JsonException).path);
    Assert.areEqual("$.missing", Assert.throws(() => reader.readString("missing"), JsonException).path);
  }

  @TestMethod
  public readsNonBlankStrings(): void {
    const reader = JsonReader.fromValue({ name: "value", empty: String.empty, blank: "  " });

    Assert.areEqual("value", reader.readNonBlankString("name"));
    Assert.isTrue(Assert.throws(() => reader.readNonBlankString("empty"), JsonException).message.includes("blank"));
    Assert.areEqual("$.blank", Assert.throws(() => reader.readNonBlankString("blank"), JsonException).path);
  }

  @TestMethod
  public distinguishesAbsentFromNullForStrings(): void {
    const reader = JsonReader.fromValue({ nothing: null, name: "value" });

    Assert.isUndefined(reader.readOptionalString("absent"));
    Assert.areEqual("value", reader.readOptionalString("name"));
    Assert.areEqual("$.nothing", Assert.throws(() => reader.readOptionalString("nothing"), JsonException).path);
    Assert.isNull(reader.readNullableString("nothing"));
    Assert.areEqual("value", reader.readNullableString("name"));
    Assert.areEqual("$.absent", Assert.throws(() => reader.readNullableString("absent"), JsonException).path);
  }

  @TestMethod
  public readsNumbersAndIntegers(): void {
    const reader = JsonReader.fromValue({ count: 3, ratio: 1.5, text: "3" });

    Assert.areEqual(3, reader.readNumber("count"));
    Assert.areEqual(1.5, reader.readNumber("ratio"));
    Assert.areEqual(3, reader.readInteger("count"));
    Assert.isTrue(Assert.throws(() => reader.readInteger("ratio"), JsonException).message.includes("integer"));
    Assert.areEqual("$.text", Assert.throws(() => reader.readNumber("text"), JsonException).path);
  }

  @TestMethod
  public readsBooleans(): void {
    const reader = JsonReader.fromValue({ yes: true, no: false, text: "true" });

    Assert.isTrue(reader.readBoolean("yes"));
    Assert.isFalse(reader.readBoolean("no"));
    Assert.isTrue(Assert.throws(() => reader.readBoolean("text"), JsonException).message.includes("boolean"));
  }

  @TestMethod
  public readsNullableIntegers(): void {
    const reader = JsonReader.fromValue({ line: 42, none: null, ratio: 1.5 });

    Assert.areEqual(42, reader.readNullableInteger("line"));
    Assert.isNull(reader.readNullableInteger("none"));
    Assert.areEqual("$.ratio", Assert.throws(() => reader.readNullableInteger("ratio"), JsonException).path);
    Assert.areEqual("$.absent", Assert.throws(() => reader.readNullableInteger("absent"), JsonException).path);
  }

  @TestMethod
  public readsStringArraysWithItemPaths(): void {
    const reader = JsonReader.fromValue({ items: ["a", "b"], empty: [], text: "a", mixed: ["a", null] });

    Assert.areEqual("a,b", reader.readStringArray("items").join(","));
    Assert.areEqual(0, reader.readStringArray("empty").length);
    Assert.isTrue(Assert.throws(() => reader.readStringArray("text"), JsonException).message.includes("array"));
    Assert.areEqual("$.mixed.1", Assert.throws(() => reader.readStringArray("mixed"), JsonException).path);
  }

  @TestMethod
  public readsObjectArraysWithItemPaths(): void {
    const reader = JsonReader.fromValue({ items: [{ name: "a" }, { name: "b" }], empty: [], text: "a", mixed: [{ name: "a" }, 1] });

    Assert.areEqual("b", reader.readObjectArray("items")[1]?.readString("name"));
    Assert.areEqual("$.items.1", reader.readObjectArray("items")[1]?.path);
    Assert.areEqual(0, reader.readObjectArray("empty").length);
    Assert.isTrue(Assert.throws(() => reader.readObjectArray("text"), JsonException).message.includes("array"));
    Assert.areEqual("$.mixed.1", Assert.throws(() => reader.readObjectArray("mixed"), JsonException).path);
  }

  @TestMethod
  public readsNullableObjects(): void {
    const reader = JsonReader.fromValue({ child: { name: "inner" }, none: null, text: "x" });

    Assert.areEqual("inner", reader.readNullableObject("child")?.readString("name"));
    Assert.isNull(reader.readNullableObject("none"));
    Assert.areEqual("$.text", Assert.throws(() => reader.readNullableObject("text"), JsonException).path);
  }

  @TestMethod
  public readsNestedObjectsWithTheirPath(): void {
    const reader = JsonReader.fromValue({ child: { name: "inner" }, list: [] });

    Assert.areEqual("$", reader.path);
    Assert.areEqual("$.child", reader.readObject("child").path);
    Assert.areEqual("inner", reader.readObject("child").readString("name"));
    Assert.areEqual("$.child.missing", Assert.throws(() => reader.readObject("child").readString("missing"), JsonException).path);
    Assert.areEqual("$.list", Assert.throws(() => reader.readObject("list"), JsonException).path);
  }

  @TestMethod
  public readsOneOfAcceptedValues(): void {
    const reader = JsonReader.fromValue({ kind: "request", other: "unknown" });

    Assert.areEqual("request", reader.readOneOf("kind", ["hello", "request"]));
    const exception = Assert.throws(() => reader.readOneOf("other", ["hello", "request"]), JsonException);
    Assert.areEqual("$.other", exception.path);
    Assert.isTrue(exception.message.includes("hello, request"));
  }

  @TestMethod
  public readsRawValuesIncludingNull(): void {
    const reader = JsonReader.fromValue({ nothing: null, payload: { deep: [1] } });

    Assert.isNull(reader.readValue("nothing"));
    Assert.areEqual("{\"deep\":[1]}", JSON.stringify(reader.readValue("payload")));
    Assert.areEqual("$.absent", Assert.throws(() => reader.readValue("absent"), JsonException).path);
  }

  @TestMethod
  public exposesTheNarrowedObject(): void {
    const reader = JsonReader.fromValue({ a: 1, b: undefined });

    Assert.areEqual("{\"a\":1}", JSON.stringify(reader.toJson()));
  }
}
