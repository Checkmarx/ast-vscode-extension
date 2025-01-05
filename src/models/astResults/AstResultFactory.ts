import { AstResult } from "./AstResult";
import { SastAstResult } from "./SastAstResult";
import { KicsAstResult } from "./KicsAstResult";
import { ScaAstResult } from "./ScaAstResult";
import { ScsAstResult } from "./ScsAstResult";
import { constants } from "../../utils/common/constants";

export class AstResultFactory {
  static createInstance(input: any): AstResult {
    switch (input.type) {
      case constants.sast:
        return new SastAstResult(input);
      case constants.kics:
        return new KicsAstResult(input);
      case constants.sca:
        return new ScaAstResult(input);
      case constants.scsSecretDetection:
        return new ScsAstResult(input);
      default:
    }
  }
}
