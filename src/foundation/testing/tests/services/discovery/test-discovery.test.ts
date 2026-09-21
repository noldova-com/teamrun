/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, Category, Skip, TestClass, TestData, TestDiscovery, TestingException, TestMethod, TestProject } from "@noldova/teamrun-foundation-testing";

import { CategorizedFixtureTests } from "../../fixtures/discovery/categorized-fixture.fixture.js";
import { DataFixtureTests } from "../../fixtures/discovery/data-fixture.fixture.js";
import { DerivedFixtureTests } from "../../fixtures/discovery/derived-fixture.fixture.js";
import { OrderedFixtureTests } from "../../fixtures/discovery/ordered-fixture.fixture.js";
import { StaticFixtureTests } from "../../fixtures/discovery/static-fixture.fixture.js";

@TestClass
export class TestDiscoveryTests {
  @TestMethod
  public rejectsAnEmptyFilePath(): void {
    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ OrderedFixtureTests }, " ", "TestPackage");
    }, ArgumentException);
  }

  @TestMethod
  public rejectsAnEmptyPackageName(): void {
    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ OrderedFixtureTests }, "inline://sample", " ");
    }, ArgumentException);
  }

  @TestMethod
  public rejectsAStaticTestMethod(): void {
    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ StaticFixtureTests }, "inline://sample", "TestPackage");
    }, TestingException);

    Assert.isTrue(failure.message.includes("improperlyMarked"));
  }

  @TestMethod
  public rejectsASubclassThatOnlyInheritsTheMark(): void {
    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ DerivedFixtureTests }, "inline://sample", "TestPackage");
    }, TestingException);

    Assert.isTrue(failure.message.includes("not marked with @TestClass"));
  }

  @TestMethod
  public carriesThePackageName(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ OrderedFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual<string | undefined>("TestPackage", discovered[0]?.packageName);
  }

  @TestMethod
  public ignoresExportsThatAreNeitherMarkedNorNamed(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ OrderedFixtureTests, unrelated: 42 }, "inline://sample", "TestPackage");

    Assert.areEqual(1, discovered.length);
  }

  @TestMethod
  public failsForAFileWithoutTestClasses(): void {
    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ unrelated: 42 }, "inline://empty", "TestPackage");
    }, TestingException);

    Assert.isTrue(failure.message.includes("inline://empty"));
  }

  @TestMethod
  public discoversMethodsInSortedOrder(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ OrderedFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual<string | undefined>("alpha", discovered[0]?.methods[0]?.methodName);
    Assert.areEqual<string | undefined>("zulu", discovered[0]?.methods[1]?.methodName);
  }

  @TestMethod
  public expandsTestDataInWrittenOrder(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ DataFixtureTests }, "inline://data", "TestPackage");
    const methods = discovered[0]?.methods ?? [];

    Assert.areEqual(3, methods.length);
    Assert.areEqual<string | undefined>("acceptsData", methods[0]?.methodName);
    Assert.areEqual<number | undefined>(0, methods[0]?.testDataIndex);
    Assert.areEqual<unknown>("first", methods[0]?.testData[0]);
    Assert.areEqual<number | undefined>(1, methods[1]?.testDataIndex);
    Assert.areEqual<unknown>("second", methods[1]?.testData[0]);
    Assert.areEqual<string | undefined>("ordinary", methods[2]?.methodName);
    Assert.isUndefined(methods[2]?.testDataIndex);
  }

  @TestMethod
  public combinesClassAndMethodCategories(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ CategorizedFixtureTests }, "inline://categories", "TestPackage");
    const testClass = discovered[0];

    Assert.areEqual<string | undefined>("class-first", testClass?.categories[0]);
    Assert.areEqual<string | undefined>("class-second", testClass?.categories[1]);
    Assert.areEqual(3, testClass?.methods.find(t => t.methodName === "categorized")?.categories.length);
    Assert.areEqual(2, testClass?.methods.find(t => t.methodName === "inherited")?.categories.length);
    Assert.areEqual<string | undefined>("method", testClass?.methods.find(t => t.methodName === "categorized")?.categories[2]);
  }

  @TestMethod
  public rejectsACategoryWithoutATestClassMark(): void {
    class Uncategorized { }
    Category("sample")(Uncategorized);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ Uncategorized }, "inline://unmarked-category", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsACategoryWithoutATestMethodMark(): void {
    class UnmarkedCategoryTests {
      public sample(): void { }
    }
    TestClass(UnmarkedCategoryTests);
    Category("sample")(UnmarkedCategoryTests.prototype.sample);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ UnmarkedCategoryTests }, "inline://unmarked-category", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsAStaticCategory(): void {
    class StaticCategoryTests {
      public sample(): void { }

      public static categorized(): void { }
    }
    TestClass(StaticCategoryTests);
    TestMethod(StaticCategoryTests.prototype.sample);
    Category("sample")(StaticCategoryTests.categorized);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ StaticCategoryTests }, "inline://static-category", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsACorruptCategoryMark(): void {
    class CorruptCategoryTests {
      public sample(): void { }
    }
    TestClass(CorruptCategoryTests);
    TestMethod(CorruptCategoryTests.prototype.sample);

    class Marked { }
    Category("valid")(Marked);
    const categoryMark = Object.getOwnPropertySymbols(Marked)[0];
    Assert.isDefined(categoryMark);
    Object.defineProperty(CorruptCategoryTests, categoryMark, { value: [] });

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ CorruptCategoryTests }, "inline://corrupt-category", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsASparseCategoryMark(): void {
    class SparseCategoryTests {
      public sample(): void { }
    }
    TestClass(SparseCategoryTests);
    TestMethod(SparseCategoryTests.prototype.sample);

    class Marked { }
    Category("valid")(Marked);
    const categoryMark = Object.getOwnPropertySymbols(Marked)[0];
    Assert.isDefined(categoryMark);
    Object.defineProperty(SparseCategoryTests, categoryMark, { value: new Array<string>(1) });

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ SparseCategoryTests }, "inline://sparse-category", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsTestDataWithoutATestMethodMark(): void {
    class UnmarkedDataTests {
      public sample(_value: string): void { }
    }
    TestClass(UnmarkedDataTests);
    TestData("value")(UnmarkedDataTests.prototype.sample);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ UnmarkedDataTests }, "inline://unmarked-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsAParameterizedMethodWithoutTestData(): void {
    class MissingDataTests {
      public sample(_value: string): void { }
    }
    TestClass(MissingDataTests);
    TestMethod(MissingDataTests.prototype.sample);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ MissingDataTests }, "inline://missing-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsTestDataWithTheWrongValueCount(): void {
    class MismatchedDataTests {
      public sample(_first: string, _second: number): void { }
    }
    TestClass(MismatchedDataTests);
    TestMethod(MismatchedDataTests.prototype.sample);
    TestData("first")(MismatchedDataTests.prototype.sample as (first: string) => void);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ MismatchedDataTests }, "inline://mismatched-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsAStaticTestDataMethod(): void {
    class StaticDataTests {
      public sample(): void { }

      public static data(_value: string): void { }
    }
    TestClass(StaticDataTests);
    TestMethod(StaticDataTests.prototype.sample);
    TestData("value")(StaticDataTests.data);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ StaticDataTests }, "inline://static-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsACorruptTestDataMark(): void {
    class CorruptDataTests {
      public sample(): void { }
    }
    TestClass(CorruptDataTests);
    TestMethod(CorruptDataTests.prototype.sample);

    const markedValue = (): void => { };
    TestData("valid")(markedValue);
    const testDataMark = Object.getOwnPropertySymbols(markedValue)[0];
    Assert.isDefined(testDataMark);
    Object.defineProperty(CorruptDataTests.prototype.sample, testDataMark, { value: [] });

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ CorruptDataTests }, "inline://corrupt-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public rejectsASparseTestDataMark(): void {
    class SparseDataTests {
      public sample(_value: string): void { }
    }
    TestClass(SparseDataTests);
    TestMethod(SparseDataTests.prototype.sample);

    const markedValue = (): void => { };
    TestData("valid")(markedValue);
    const testDataMark = Object.getOwnPropertySymbols(markedValue)[0];
    Assert.isDefined(testDataMark);
    Object.defineProperty(SparseDataTests.prototype.sample, testDataMark, { value: new Array<unknown>(1) });

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ SparseDataTests }, "inline://sparse-data", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public async discoversTestFilesBeneathARootDirectory(): Promise<void> {
    const rootDirectory = await this.createDiscoveryRootAsync();
    try {
      const discovered = await new TestDiscovery().discoverAsync([new TestProject("TestPackage", rootDirectory)]);

      Assert.areEqual(1, discovered.length);
      Assert.areEqual<string | undefined>("TestPackage", discovered[0]?.packageName);
      Assert.areEqual<string | undefined>("ValidFixtureTests", discovered[0]?.className);
      Assert.areEqual<string | undefined>("valid-fixture.test.js", discovered[0]?.filePath);
      Assert.areEqual(1, discovered[0]?.methods.length);
    }
    finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async ordersProjectsSharingAPackageNameByRoot(): Promise<void> {
    const rootDirectory = await this.createDiscoveryRootAsync();
    try {
      const discovered = await new TestDiscovery().discoverAsync([
        new TestProject("TestPackage", rootDirectory),
        new TestProject("TestPackage", rootDirectory),
      ]);

      Assert.areEqual(2, discovered.length);
    }
    finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public carriesAnExplicitPackageNameInsteadOfInferringItFromThePath(): void {
    const first = new TestProject("FirstPackage", "same/root");
    const second = new TestProject("SecondPackage", "same/root");

    Assert.areNotEqual(first.packageName, second.packageName);
  }

  @TestMethod
  public doesNotExecuteExportGetters(): void {
    const moduleExports: object = Object.create(null);
    Object.defineProperty(moduleExports, "ExplosiveTests", {
      enumerable: true,
      get: () => {
        throw new Error("The getter must not run during discovery.");
      },
    });

    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports(moduleExports, "inline://getter", "TestPackage");
    }, TestingException);

    Assert.isTrue(failure.message.includes("not marked with @TestClass"));
  }

  @TestMethod
  public ignoresUnmarkedInstanceAccessorsWithoutExecutingThem(): void {
    class AccessorTests {
      public get explosive(): never {
        throw new Error("The getter must not run during discovery.");
      }

      public sample(): void { }
    }
    TestClass(AccessorTests);
    TestMethod(AccessorTests.prototype.sample);

    const discovered = new TestDiscovery().discoverModuleExports({ AccessorTests }, "inline://getter", "TestPackage");

    Assert.areEqual(1, discovered[0]?.methods.length);
  }

  @TestMethod
  public rejectsTestMetadataOnAnAccessorWithoutExecutingIt(): void {
    class AccessorTests {
      public get explosive(): never {
        throw new Error("The getter must not run during discovery.");
      }

      public sample(): void { }
    }
    TestClass(AccessorTests);
    TestMethod(AccessorTests.prototype.sample);
    const descriptor = Object.getOwnPropertyDescriptor(AccessorTests.prototype, "explosive");
    Assert.isDefined(descriptor?.get);
    TestMethod(descriptor.get);

    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ AccessorTests }, "inline://getter", "TestPackage");
    }, TestingException);

    Assert.isTrue(failure.message.includes("cannot carry test metadata"));
  }

  @TestMethod
  public rejectsACorruptSkipMark(): void {
    class CorruptSkipTests {
      public sample(): void { }
    }
    TestClass(CorruptSkipTests);
    TestMethod(CorruptSkipTests.prototype.sample);

    const markedValue = (): void => { };
    Skip("valid")(markedValue);
    const skipMark = Object.getOwnPropertySymbols(markedValue)[0];
    Assert.isDefined(skipMark);
    Object.defineProperty(CorruptSkipTests, skipMark, { value: 1 });

    const failure = Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ CorruptSkipTests }, "inline://corrupt", "TestPackage");
    }, TestingException);
    Assert.areEqual("A skip mark must carry a non-whitespace string reason.", failure.message);
  }

  private async createDiscoveryRootAsync(): Promise<string> {
    const rootDirectory = await mkdtemp(join(import.meta.dirname, "discovery-"));
    await copyFile(
      join(import.meta.dirname, "..", "..", "fixtures", "valid-fixture.fixture.js"),
      join(rootDirectory, "valid-fixture.test.js"));

    return rootDirectory;
  }
}
