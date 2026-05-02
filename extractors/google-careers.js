(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /google\.com$/i.test(url.hostname) && /\/about\/careers\/applications\/jobs\/results\//i.test(url.pathname);
  }

  function currentJobId() {
    const match = location.pathname.match(/\/jobs\/results\/(\d+)/i);
    return match && match[1];
  }

  function jobRoot() {
    const id = currentJobId();
    return (
      (id && document.querySelector(`c-wiz[data-p*="${id}"]`)) ||
      document.querySelector("main") ||
      document
    );
  }

  function extract() {
    const fallback = generic.extract();
    const root = jobRoot();
    const roleName = generic.textFromSelector(["main h2"], root) ||
      (root.querySelector("[data-title]") && root.querySelector("[data-title]").getAttribute("data-title"));
    const companyName = generic.textFromSelector(["main .RP7SMd > span:last-child"], root) || "Google";
    const locationText = generic.textFromSelector(["main .pwO9Dc.vo5qdf .r0wTof", "main .pwO9Dc .r0wTof"], root);
    const detailText = generic.textFromSelector(["main"], root);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName) || fallback.companyName || "Google",
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${detailText}`),
      source: "google-careers",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "google-careers", canHandle, extract });
})();
