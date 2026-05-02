(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /jobs\.lever\.co/i.test(url.hostname);
  }

  function companyFromPath() {
    return location.pathname.split("/").filter(Boolean)[0] || "";
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector([".posting-headline h2", ".posting-title h2", "h1"]);
    const companyName = generic.textFromSelector([".main-header-logo img[alt]", ".company-name"]) || companyFromPath();
    const locationText = generic.textFromSelector([".location", ".posting-categories .location"]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName) || fallback.companyName,
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "lever",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "lever", canHandle, extract });
})();
