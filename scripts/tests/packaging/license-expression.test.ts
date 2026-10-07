/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import LicenseExpression from "../../packaging/license-expression.ts";
import PackagingException from "../../packaging/packaging.exception.ts";

class LicenseExpressionTests {
  private static readonly ALLOWED: string = "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, or an OR expression with one of them";

  public static register(): void {
    test("each allowed license is taken as it is", () => {
      for (const identifier of ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "BlueOak-1.0.0", "Python-2.0"]) {
        const license = new LicenseExpression("fixture@1.0.0", identifier);

        assert.equal(license.chosen, identifier);
        assert.equal(license.expression, identifier);
        assert.equal(license.describe(), identifier);
      }
    });

    test("an OR expression chooses its first allowed license and records the choice", () => {
      const plain = new LicenseExpression("fixture@1.0.0", "GPL-3.0-only OR Apache-2.0 OR MIT");
      const grouped = new LicenseExpression("fixture@1.0.0", " (MIT OR CC0-1.0) ");

      assert.equal(plain.chosen, "Apache-2.0");
      assert.equal(plain.describe(), "Apache-2.0, chosen from \"GPL-3.0-only OR Apache-2.0 OR MIT\"");
      assert.equal(grouped.chosen, "MIT");
      assert.equal(grouped.describe(), "MIT, chosen from \" (MIT OR CC0-1.0) \"");
    });

    test("a license outside the list, an OR expression without an allowed one, AND, WITH, a nested group or a missing field fails and names the package", () => {
      for (const expression of ["GPL-3.0-only", "GPL-3.0-only OR CC-BY-4.0", "MIT AND ISC", "Apache-2.0 WITH LLVM-exception", "MIT OR (ISC AND BSD-3-Clause)", "(MIT) AND (ISC)",
        "Apache-2.0+", "mit", "SEE LICENSE IN LICENSE.md", ""])
        assert.throws(() => new LicenseExpression("fixture@1.0.0", expression),
          new PackagingException(`fixture@1.0.0 is licensed under "${expression}"; a third-party runtime package needs ${LicenseExpressionTests.ALLOWED}.`));
      for (const value of [undefined, null, { type: "MIT" }, ["MIT"]])
        assert.throws(() => new LicenseExpression("fixture@1.0.0", value),
          new PackagingException(`fixture@1.0.0 names no license in its package.json; a third-party runtime package needs ${LicenseExpressionTests.ALLOWED}.`));
    });
  }
}

LicenseExpressionTests.register();
