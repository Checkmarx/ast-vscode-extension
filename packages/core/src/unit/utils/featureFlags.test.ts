import { expect } from "chai";
import { DAST_ENABLED } from "../../utils/common/featureFlags";

describe("featureFlags", () => {
  const originalEnv = process.env.CX_FEATURE_FLAGS;

  function loadFeatureFlags() {
    delete require.cache[require.resolve("../../utils/common/featureFlags")];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../utils/common/featureFlags") as typeof import("../../utils/common/featureFlags");
  }

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CX_FEATURE_FLAGS;
    } else {
      process.env.CX_FEATURE_FLAGS = originalEnv;
    }
    delete require.cache[require.resolve("../../utils/common/featureFlags")];
  });

  it("should return false when feature flag is not set", () => {
    delete process.env.CX_FEATURE_FLAGS;
    const { isFeatureEnabled } = loadFeatureFlags();
    expect(isFeatureEnabled(DAST_ENABLED)).to.be.false;
  });

  it("should return true when feature flag is enabled", () => {
    process.env.CX_FEATURE_FLAGS = `${DAST_ENABLED},OTHER_FLAG`;
    const { isFeatureEnabled, getEnabledFeatures } = loadFeatureFlags();
    expect(isFeatureEnabled(DAST_ENABLED)).to.be.true;
    expect(getEnabledFeatures()).to.include(DAST_ENABLED);
    expect(getEnabledFeatures()).to.include("OTHER_FLAG");
  });

  it("should trim whitespace from flag names", () => {
    process.env.CX_FEATURE_FLAGS = ` ${DAST_ENABLED} , FLAG2 `;
    const { getEnabledFeatures } = loadFeatureFlags();
    expect(getEnabledFeatures()).to.deep.equal([DAST_ENABLED, "FLAG2"]);
  });

  it("should return empty array when no flags configured", () => {
    process.env.CX_FEATURE_FLAGS = "";
    const { getEnabledFeatures } = loadFeatureFlags();
    expect(getEnabledFeatures()).to.deep.equal([]);
  });
});
