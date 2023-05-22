import *  as prod from "./cx";
import *  as testEnv from "./cxMock";

export const cx =
  process.env.TEST && process.env.TEST === 'true' ? new testEnv.CxMock : new prod.Cx;