import * as prod from "./cx";
import * as testEnv from "./cxMock";
 
//prettier-ignore
export const cx =
  process.env.TEST && process.env.TEST === "true"
    ? new testEnv.CxMock
    : process.env.TEST === "uiEndToEnd"
    ? new prod.Cx
    : new prod.Cx;