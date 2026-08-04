import { expect } from "chai";
import { mapPackageManagerToRemediationFormat } from "../../realtimeScanners/scanners/packageManagerMapper";

describe("PackageManagerMapper", () => {
  describe("Gradle mapping", () => {
    it("maps lowercase gradle to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("gradle")).to.equal("mvn");
    });

    it("maps uppercase GRADLE to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("GRADLE")).to.equal("mvn");
    });

    it("maps mixed case Gradle to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("Gradle")).to.equal("mvn");
    });
  });

  describe("SBT mapping", () => {
    it("maps lowercase sbt to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("sbt")).to.equal("mvn");
    });

    it("maps uppercase SBT to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("SBT")).to.equal("mvn");
    });

    it("maps mixed case Sbt to mvn", () => {
      expect(mapPackageManagerToRemediationFormat("Sbt")).to.equal("mvn");
    });
  });

  describe("CocoaPods mapping", () => {
    it("maps lowercase cocoapods to swift", () => {
      expect(mapPackageManagerToRemediationFormat("cocoapods")).to.equal("swift");
    });

    it("maps uppercase COCOAPODS to swift", () => {
      expect(mapPackageManagerToRemediationFormat("COCOAPODS")).to.equal("swift");
    });

    it("maps mixed case CocoaPods to swift", () => {
      expect(mapPackageManagerToRemediationFormat("CocoaPods")).to.equal("swift");
    });
  });

  describe("Carthage mapping", () => {
    it("maps lowercase carthage to swift", () => {
      expect(mapPackageManagerToRemediationFormat("carthage")).to.equal("swift");
    });

    it("maps uppercase CARTHAGE to swift", () => {
      expect(mapPackageManagerToRemediationFormat("CARTHAGE")).to.equal("swift");
    });

    it("maps mixed case Carthage to swift", () => {
      expect(mapPackageManagerToRemediationFormat("Carthage")).to.equal("swift");
    });
  });

  describe("Pass-through package managers", () => {
    it("passes through npm unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("npm")).to.equal("npm");
    });

    it("passes through mvn unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("mvn")).to.equal("mvn");
    });

    it("passes through maven unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("maven")).to.equal("maven");
    });

    it("passes through pypi unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("pypi")).to.equal("pypi");
    });

    it("passes through go unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("go")).to.equal("go");
    });

    it("passes through nuget unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("nuget")).to.equal("nuget");
    });

    it("passes through swift unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("swift")).to.equal("swift");
    });
  });

  describe("Edge cases", () => {
    it("returns undefined for undefined input", () => {
      expect(mapPackageManagerToRemediationFormat(undefined)).to.be.undefined;
    });

    it("returns empty string for empty string input", () => {
      expect(mapPackageManagerToRemediationFormat("")).to.equal("");
    });

    it("passes through unknown package manager unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("unknown_manager")).to.equal("unknown_manager");
    });

    it("passes through uncommon package manager unchanged", () => {
      expect(mapPackageManagerToRemediationFormat("composer")).to.equal("composer");
    });
  });
});
