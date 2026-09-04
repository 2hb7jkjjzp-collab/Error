import type { Page } from "playwright";
import { MeshalError, ErrorCode, type ATSType } from "@meshal/shared";
import type { ATSConnector, ApplicationContext, StepResult, SubmissionSignals } from "./ConnectorContract.js";

/**
 * A connector is NOT complete merely because a form opened (Section 45).
 * These stubs exist so the repository structure and ApplicationRouter
 * registration match the target architecture ahead of each connector's
 * scheduled phase, but every method honestly raises ATS_UNSUPPORTED instead
 * of pretending to submit a real application. Replace with a real
 * implementation (mirroring LeverConnector) when that phase starts.
 */
export class StubConnector implements ATSConnector {
  constructor(
    readonly atsType: ATSType,
    private readonly urlPattern: RegExp,
    private readonly phase: number
  ) {}

  detect(url: string): boolean {
    return this.urlPattern.test(url);
  }

  private notImplemented(step: string): never {
    throw new MeshalError(
      ErrorCode.ATS_UNSUPPORTED,
      `${this.atsType} connector is not yet implemented (Phase ${this.phase} of the connector roadmap). Step: ${step}.`,
      { ats_type: this.atsType, phase: this.phase, step }
    );
  }

  async open(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("open");
  }
  async authenticate(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("authenticate");
  }
  async startApplication(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("startApplication");
  }
  async readCurrentStep(_page: Page): Promise<{ step: string; totalSteps?: number }> {
    this.notImplemented("readCurrentStep");
  }
  async fillKnownFields(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("fillKnownFields");
  }
  async uploadResume(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("uploadResume");
  }
  async answerQuestions(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    this.notImplemented("answerQuestions");
  }
  async validateStep(_page: Page): Promise<StepResult> {
    this.notImplemented("validateStep");
  }
  async next(_page: Page): Promise<StepResult> {
    this.notImplemented("next");
  }
  async submit(_page: Page): Promise<StepResult> {
    this.notImplemented("submit");
  }
  async collectSubmissionSignals(_page: Page): Promise<SubmissionSignals> {
    this.notImplemented("collectSubmissionSignals");
  }
  async close(page: Page): Promise<void> {
    await page.close().catch(() => undefined);
  }
}

export const GreenhouseConnector = () => new StubConnector("greenhouse", /boards\.greenhouse\.io|job-boards\.greenhouse\.io/i, 2);
export const SmartRecruitersConnector = () => new StubConnector("smartrecruiters", /jobs\.smartrecruiters\.com/i, 3);
export const WorkdayConnector = () => new StubConnector("workday", /myworkdayjobs\.com/i, 4);
export const OracleConnector = () => new StubConnector("oracle", /oraclecloud\.com\/hcmUI|recruiting\.oraclecloud/i, 5);
export const SuccessFactorsConnector = () => new StubConnector("successfactors", /successfactors\.com|jobs\.sap\.com/i, 6);
