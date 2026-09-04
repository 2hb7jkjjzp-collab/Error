import type { ATSType } from "@meshal/shared";
import { MeshalError, ErrorCode } from "@meshal/shared";
import type { ATSConnector } from "./ConnectorContract.js";

/**
 * detect ATS -> choose dedicated connector -> generic fallback only if
 * necessary. The generic fallback is intentionally NOT implemented as a
 * catch-all Playwright script per Section 14 — an unrecognized ATS raises
 * ATS_UNSUPPORTED rather than attempting a blind, unreliable submission.
 */
export class ApplicationRouter {
  private connectors: ATSConnector[] = [];

  register(connector: ATSConnector): void {
    this.connectors.push(connector);
  }

  detectAts(url: string): ATSType {
    for (const c of this.connectors) {
      if (c.detect(url)) return c.atsType;
    }
    return "unknown";
  }

  route(url: string): ATSConnector {
    const connector = this.connectors.find((c) => c.detect(url));
    if (!connector) {
      throw new MeshalError(ErrorCode.ATS_UNSUPPORTED, `No connector registered for URL: ${url}`, { url });
    }
    return connector;
  }
}
