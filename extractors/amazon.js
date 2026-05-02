(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /(^|\.)amazon\.jobs$/i.test(url.hostname) && /\/jobs\//i.test(url.pathname);
  }

  function locationFromJobDetails() {
    const rows = Array.from(document.querySelectorAll("#job-detail-body .association"));

    for (const row of rows) {
      const label = row.querySelector('[aria-label="location"]');
      const value = row.querySelector(".association-content li");

      if (label && value) {
        return value.textContent;
      }
    }

    const dimensionsScript = Array.from(document.scripts)
      .map((script) => script.textContent || "")
      .find((text) => text.includes("dimension8"));
    const match = dimensionsScript && dimensionsScript.match(/"dimension8":"([^"]+)"/);
    return match ? match[1] : "";
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector(["#job-detail h1.title", "h1.title", "h1"]);
    const locationText = locationFromJobDetails();

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: "Amazon",
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "amazon",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "amazon", canHandle, extract });
})();
