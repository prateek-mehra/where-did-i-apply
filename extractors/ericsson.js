(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /jobs\.ericsson\.com$/i.test(url.hostname);
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector(["[class*='position-title']", "h2", "h1"]);
    const locationText = generic.textFromSelector(["[class*='position-location']"]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: fallback.companyName || "Ericsson",
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "ericsson",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "ericsson", canHandle, extract });
})();
