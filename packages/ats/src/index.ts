export * from "./ConnectorContract.js";
export * from "./ApplicationRouter.js";
export * from "./lever/LeverDiscoveryAdapter.js";
export * from "./lever/LeverConnector.js";
export * from "./StubConnector.js";

import { ApplicationRouter } from "./ApplicationRouter.js";
import { LeverConnector } from "./lever/LeverConnector.js";
import {
  GreenhouseConnector,
  SmartRecruitersConnector,
  WorkdayConnector,
  OracleConnector,
  SuccessFactorsConnector,
} from "./StubConnector.js";

/** Pre-wired router with every connector registered (Lever real, rest phased stubs). */
export function buildDefaultRouter(): ApplicationRouter {
  const router = new ApplicationRouter();
  router.register(new LeverConnector());
  router.register(GreenhouseConnector());
  router.register(SmartRecruitersConnector());
  router.register(WorkdayConnector());
  router.register(OracleConnector());
  router.register(SuccessFactorsConnector());
  return router;
}
