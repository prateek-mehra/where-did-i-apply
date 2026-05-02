(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /jobs\.sap\.com$/i.test(url.hostname);
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector([".heroJobTitle", ".jobs-ui-jobs-title", "h1"]);
    const locationText = generic.textFromSelector([
      ".data-location .jobLocation",
      ".data-location",
      ".jobLocation.job-location-inline"
    ]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: fallback.companyName || "SAP",
      location: constants.cleanText(locationText).replace(/^Location\s+/i, "") || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "sap",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "sap", canHandle, extract });
})();
