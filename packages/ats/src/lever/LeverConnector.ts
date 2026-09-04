import type { Page } from "playwright";
import { MeshalError, ErrorCode, logger, type ATSType } from "@meshal/shared";
import { classifyField, valueForField, resolveAnswer } from "@meshal/browser";
import type { ATSConnector, ApplicationContext, StepResult, SubmissionSignals } from "../ConnectorContract.js";

/**
 * Phase 1 connector (Section 45). Lever's public apply form
 * (jobs.lever.co/{tenant}/{id}/apply) is a single-page form: name, email,
 * phone, resume upload, and a set of custom questions defined per posting.
 * No account/login is required — Lever accepts anonymous applications.
 */
export class LeverConnector implements ATSConnector {
  readonly atsType: ATSType = "lever";

  detect(url: string): boolean {
    return /(^https?:\/\/)?jobs\.lever\.co\//i.test(url) || /api\.lever\.co/i.test(url);
  }

  async open(page: Page, ctx: ApplicationContext): Promise<StepResult> {
    try {
      const applyUrl = ctx.jobUrl.endsWith("/apply") ? ctx.jobUrl : `${ctx.jobUrl.replace(/\/$/, "")}/apply`;
      await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return { ok: true, step: "open" };
    } catch (err) {
      throw new MeshalError(ErrorCode.NAVIGATION_TIMEOUT, `Failed to open Lever apply page: ${err}`, { url: ctx.jobUrl });
    }
  }

  /** Lever's public apply flow requires no account. */
  async authenticate(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    return { ok: true, step: "authenticate", details: { note: "Lever apply form does not require authentication." } };
  }

  async startApplication(_page: Page, _ctx: ApplicationContext): Promise<StepResult> {
    return { ok: true, step: "startApplication" };
  }

  async readCurrentStep(_page: Page): Promise<{ step: string; totalSteps?: number }> {
    return { step: "single_page_form", totalSteps: 1 };
  }

  async fillKnownFields(page: Page, ctx: ApplicationContext): Promise<StepResult> {
    const completed: string[] = [];
    const inputs = await page.$$("input, textarea, select");
    for (const input of inputs) {
      const type = await input.getAttribute("type");
      if (type === "file" || type === "hidden" || type === "submit") continue;

      const name = await input.getAttribute("name");
      const placeholder = await input.getAttribute("placeholder");
      const ariaLabel = await input.getAttribute("aria-label");
      const label = await this.findLabelText(page, input);

      const field = classifyField({ label, name, placeholder, ariaLabel, type });
      if (!field || field === "resume_upload" || field === "cover_letter") continue;

      const value = valueForField(field, ctx.candidate);
      if (!value) continue;

      try {
        const tag = await input.evaluate((el) => el.tagName.toLowerCase());
        if (tag === "select") {
          await input.selectOption({ label: value }).catch(() => input.selectOption(value).catch(() => undefined));
        } else if (field === "city") {
          await this.fillLocationAutocomplete(page, input, value);
        } else {
          await input.fill(value);
        }
        completed.push(field);
      } catch {
        // Non-fillable field (e.g. custom widget) — leave for answerQuestions/manual review.
      }
    }
    return { ok: true, step: "fillKnownFields", fieldsCompleted: completed };
  }

  /**
   * Lever's "Current location" field is a Google Places-style autocomplete:
   * a plain fill() sets the text but never fires the real keystroke events
   * the widget listens for, so it never resolves a suggestion and Lever's
   * own validation still treats it as unset ("No location found"). Type it
   * as real keystrokes instead and accept the first suggestion that
   * appears; if no suggestion list shows up, the typed text is left as-is
   * (still better than an empty field).
   */
  private async fillLocationAutocomplete(
    page: Page,
    input: import("playwright").ElementHandle,
    value: string
  ): Promise<void> {
    await input.click({ clickCount: 3 }).catch(() => undefined);
    await input.fill("").catch(() => undefined);
    await input.type(value, { delay: 60 });

    // Lever's own location widget renders its suggestion list as plain
    // divs (confirmed from a captured DOM snapshot):
    //   <div class="dropdown-results ...">
    //     <div class="dropdown-location ..." id="location-0">Riyadh, SAU</div>
    //     ...
    //   </div>
    // Generic listbox/pac-container/dropdown-menu selectors never match
    // this, and a keyboard ArrowDown+Enter fallback actively clears the
    // field (the component only commits a value via a real click on one
    // of these divs) — so this needs a real click on the first result,
    // with a couple of widely-used autocomplete patterns kept as a
    // fallback for other tenants/ATS variants. The suggestion lookup is
    // network-backed and occasionally doesn't respond within a single
    // wait window, so retry a few times, re-nudging the input (which
    // re-triggers the widget's debounced lookup) between attempts rather
    // than giving up after one timeout.
    const suggestion = page
      .locator(
        [
          ".dropdown-results .dropdown-location",
          "[role='listbox'] [role='option']",
          ".pac-container .pac-item",
          "[data-qa='location-suggestion']",
        ].join(", ")
      )
      .first();

    let selected = false;
    const attemptLog: Array<{ attempt: number; result_count: number; no_results_shown: boolean; outcome: string }> = [];
    for (let attempt = 0; attempt < 4 && !selected; attempt++) {
      if (attempt > 0) {
        // Re-trigger the debounced lookup: remove and retype the last
        // character rather than retyping the whole value (avoids
        // re-collapsing an already-open dropdown via the triple-click/clear
        // path).
        await input.press("Backspace").catch(() => undefined);
        await input.type(value.slice(-1), { delay: 60 }).catch(() => undefined);
      }
      try {
        await suggestion.waitFor({ state: "visible", timeout: 6_000 });
        await suggestion.click();
        selected = true;
        attemptLog.push({ attempt, result_count: 1, no_results_shown: false, outcome: "clicked" });
      } catch {
        const resultCount = await page.locator(".dropdown-results .dropdown-location").count().catch(() => -1);
        const noResultsShown = await page
          .locator(".dropdown-no-results")
          .evaluate((el) => (el as HTMLElement).style.display !== "none")
          .catch(() => false);
        attemptLog.push({ attempt, result_count: resultCount, no_results_shown: noResultsShown, outcome: "timeout" });
        selected = false;
      }
    }

    const finalValue = await input.evaluate((el) => (el as HTMLInputElement).value).catch(() => "");
    logger.warn("lever_location_autocomplete_result", {
      typed_value: value,
      suggestion_clicked: selected,
      final_value: finalValue,
      attempts: JSON.stringify(attemptLog),
    });
  }

  private async findLabelText(page: Page, input: import("playwright").ElementHandle): Promise<string | null> {
    try {
      const id = await input.getAttribute("id");
      if (id) {
        const label = await page.$(`label[for="${id}"]`);
        if (label) return (await label.textContent())?.trim() ?? null;
      }
      const parentLabel = await input.evaluateHandle((el) => (el as HTMLElement).closest("label"));
      const text = await (parentLabel as any).evaluate((el: HTMLElement | null) => el?.textContent?.trim() ?? null);
      return text ?? null;
    } catch {
      return null;
    }
  }

  async uploadResume(page: Page, ctx: ApplicationContext): Promise<StepResult> {
    const fileInput = await page.$('input[type="file"][name="resume"]') ?? (await page.$('input[type="file"]'));
    if (!fileInput) {
      return { ok: false, step: "uploadResume", errorCode: ErrorCode.ENGINEERING_ERROR, errorMessage: "No resume upload field found on Lever apply form." };
    }
    try {
      await fileInput.setInputFiles(ctx.candidate.resume_path);
      return { ok: true, step: "uploadResume", fieldsCompleted: ["resume_upload"] };
    } catch (err) {
      throw new MeshalError(ErrorCode.ENGINEERING_ERROR, `Resume upload failed: ${err}`, { resume_path: ctx.candidate.resume_path });
    }
  }

  async answerQuestions(page: Page, ctx: ApplicationContext): Promise<StepResult> {
    const unanswered: string[] = [];
    const unansweredDetails: Array<{ question: string; outerHtml: string }> = [];
    const fieldsets = await page.$$(".application-question, [data-qa='application-question']");
    const targets = fieldsets.length > 0 ? fieldsets : await page.$$("fieldset");

    for (const fieldset of targets) {
      const questionText = (await fieldset.textContent())?.trim().slice(0, 300) ?? "";
      if (!questionText) continue;

      const input = await fieldset.$("input, textarea, select");
      if (!input) continue;
      const type = await input.getAttribute("type");
      if (type === "file") continue;

      // fillKnownFields() already ran and fills standard profile fields
      // (name, email, phone, location, LinkedIn, ...) by matching the same
      // DOM elements via FieldResolver. Lever wraps those in the same
      // .application-question containers as its custom questions, so
      // without this check every already-filled standard field gets
      // re-processed here, doesn't match any stored Q&A pattern, and is
      // wrongly reported as an unanswered "question".
      const currentValue = await input.evaluate((el) => (el as HTMLInputElement).value).catch(() => "");
      if (currentValue && currentValue.trim().length > 0) continue;
      if (type === "checkbox" || type === "radio") {
        const isChecked = await input.evaluate((el) => (el as HTMLInputElement).checked).catch(() => false);
        if (isChecked) continue;
      }

      const required = (await fieldset.evaluate((el) => el.querySelector("[required]") != null)) as boolean;
      const resolved = resolveAnswer(questionText, required, ctx.knownAnswers);

      if (!resolved.canAutoAnswer) {
        unanswered.push(questionText);
        unansweredDetails.push({ question: questionText, outerHtml: (await fieldset.evaluate((el) => el.outerHTML)).slice(0, 500) });
        continue;
      }
      if (resolved.answer == null) continue;

      try {
        const tag = await input.evaluate((el) => el.tagName.toLowerCase());
        if (tag === "select") {
          await input.selectOption({ label: resolved.answer }).catch(() => undefined);
        } else if (type === "radio" || type === "checkbox") {
          await input.check().catch(() => undefined);
        } else {
          await input.fill(resolved.answer);
        }
      } catch {
        unanswered.push(questionText);
        unansweredDetails.push({ question: questionText, outerHtml: (await fieldset.evaluate((el) => el.outerHTML)).slice(0, 500) });
      }
    }

    if (unanswered.length > 0) {
      return {
        ok: false,
        step: "answerQuestions",
        unansweredFields: unanswered,
        errorCode: ErrorCode.REQUIRED_UNKNOWN_FIELD,
        errorMessage: `${unanswered.length} required question(s) could not be auto-answered.`,
        details: { unanswered: unansweredDetails },
      };
    }
    return { ok: true, step: "answerQuestions" };
  }

  async validateStep(page: Page): Promise<StepResult> {
    // Identify WHICH fields are still empty (name/id/placeholder/nearby
    // label text), not just a count — a bare count gives no way to tell
    // which widget still needs handling (e.g. an autocomplete that never
    // resolved a suggestion vs. a genuinely unanswered custom field). Also
    // capture a trimmed outerHTML snapshot of each one so the actual DOM
    // structure (hidden companion inputs, widget classes, data attributes)
    // is visible in server logs without needing a live screenshot from the
    // person testing the flow.
    const stillRequired = await page.$$eval("[required]", (els) =>
      els
        .filter((el) => {
          const input = el as HTMLInputElement;
          return !input.value && input.type !== "file";
        })
        .map((el) => {
          const input = el as HTMLInputElement;
          const label = input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() : null;
          return {
            label: label || input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.name || input.id || "(unlabeled field)",
            tag: el.tagName.toLowerCase(),
            type: input.type ?? null,
            id: input.id ?? null,
            name: input.name ?? null,
            className: (el as HTMLElement).className || null,
            outerHtml: (el.outerHTML || "").slice(0, 500),
          };
        })
    );
    if (stillRequired.length > 0) {
      const labels = stillRequired.map((f) => f.label);
      return {
        ok: false,
        step: "validateStep",
        unansweredFields: labels,
        errorCode: ErrorCode.REQUIRED_UNKNOWN_FIELD,
        errorMessage: `${stillRequired.length} required field(s) still empty: ${labels.join(", ")}`,
        details: { fields: stillRequired },
      };
    }
    return { ok: true, step: "validateStep" };
  }

  /** Lever's apply form is single-page; next() is a no-op. */
  async next(_page: Page): Promise<StepResult> {
    return { ok: true, step: "next" };
  }

  async submit(page: Page): Promise<StepResult> {
    const submitButton = await page.$('button[type="submit"]') ?? (await page.$("button:has-text('Submit')"));
    if (!submitButton) {
      throw new MeshalError(ErrorCode.ENGINEERING_ERROR, "No submit button found on Lever apply form.");
    }
    try {
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined),
        submitButton.click(),
      ]);
      // Clicking submit is NOT proof of success — SubmissionVerificationAgent
      // independently checks collectSubmissionSignals() before anything is
      // marked SUBMITTED.
      return { ok: true, step: "submit" };
    } catch (err) {
      throw new MeshalError(ErrorCode.ATS_TEMPORARY_ERROR, `Submit click failed: ${err}`);
    }
  }

  async collectSubmissionSignals(page: Page): Promise<SubmissionSignals> {
    const url = page.url();
    const confirmationUrl = /confirmation|thanks|success/i.test(url) ? url : null;

    const bodyText = (await page.textContent("body").catch(() => null)) ?? "";
    const confirmationMatch = /(thank you for applying|application (has been )?submitted|we('| ha)ve received your application)/i.exec(bodyText);

    return {
      confirmationText: confirmationMatch ? confirmationMatch[0] : null,
      confirmationUrl,
      externalApplicationId: null, // Lever does not expose an application ID in the public flow
      screenshotPath: null, // set by caller after screenshot() with the evidence path
    };
  }

  async close(page: Page): Promise<void> {
    await page.close().catch(() => undefined);
  }
}
