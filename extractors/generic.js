(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;

  function textFromSelector(selectors, root) {
    const scope = root || document;

    for (const selector of selectors) {
      const node = scope.querySelector(selector);
      const text = node && constants.cleanText(node.textContent || node.getAttribute("content"));

      if (text) {
        return text;
      }
    }

    return "";
  }

  function getMetaContent(names) {
    for (const name of names) {
      const selector = [
        `meta[name="${name}"]`,
        `meta[property="${name}"]`,
        `meta[itemprop="${name}"]`
      ].join(",");
      const node = document.querySelector(selector);
      const content = node && constants.cleanText(node.getAttribute("content"));

      if (content) {
        return content;
      }
    }

    return "";
  }

  function parseJsonLd() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        const flattened = items.flatMap((item) => item && item["@graph"] ? item["@graph"] : item);
        const posting = flattened.find((item) => {
          const type = item && item["@type"];
          return Array.isArray(type) ? type.includes("JobPosting") : type === "JobPosting";
        });

        if (posting) {
          return posting;
        }
      } catch (error) {
        // Invalid JSON-LD is common enough on the open web; ignore and continue.
      }
    }

    return null;
  }

  function locationFromJsonLd(posting) {
    if (!posting || !posting.jobLocation) {
      return "";
    }

    const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];

    return locations
      .map((location) => {
        const address = location.address || location;

        if (typeof address === "string") {
          return address;
        }

        return [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry
        ].filter(Boolean).join(", ");
      })
      .filter(Boolean)
      .join(" / ");
  }

  function companyFromJsonLd(posting) {
    if (!posting || !posting.hiringOrganization) {
      return "";
    }

    if (typeof posting.hiringOrganization === "string") {
      return posting.hiringOrganization;
    }

    return posting.hiringOrganization.name || "";
  }

  function extractCompanyFromTitle(title, roleName) {
    const cleanTitle = constants.cleanText(title);

    if (!cleanTitle) {
      return "";
    }

    const separators = [" at ", " | ", " - ", " · ", " — "];

    for (const separator of separators) {
      if (cleanTitle.includes(separator)) {
        const parts = cleanTitle.split(separator).map(constants.cleanText).filter(Boolean);
        const likelyCompany = parts.find((part) => part !== roleName && !/job|career|opening/i.test(part));

        if (likelyCompany) {
          return likelyCompany;
        }
      }
    }

    return "";
  }

  function isWeakRoleName(text) {
    return !text || /^(job details|apply for this job|careers?|jobs search results)$/i.test(constants.cleanText(text));
  }

  function pageLooksLikeJob() {
    if (constants.isNonJobUrl(location.href)) {
      return false;
    }

    const urlLooksRight = constants.isJobLikeUrl(location.href);
    const text = constants.cleanText(document.body && document.body.innerText).toLowerCase();
    const hasJobWords = /\b(job description|responsibilities|qualifications|requirements|about the role|about this job)\b/.test(text);
    const hasTitle = Boolean(document.querySelector("h1"));

    return urlLooksRight || (hasTitle && hasJobWords);
  }

  function extract() {
    const jsonLd = parseJsonLd();
    const title = document.title;
    const pageText = document.body ? document.body.innerText : "";

    const selectorRoleName = textFromSelector([
          '[data-testid*="job-title" i]',
          '[class*="job-title" i]',
          '[class*="position-title" i]',
          '[class*="posting-headline" i] h1',
          "h1"
        ]);
    const metaRoleName = getMetaContent(["og:title", "twitter:title"]);
    const roleName = constants.cleanText(
      (jsonLd && jsonLd.title) ||
        (isWeakRoleName(selectorRoleName) ? "" : selectorRoleName) ||
        metaRoleName
    );

    const companyName = constants.cleanText(
      companyFromJsonLd(jsonLd) ||
        textFromSelector([
          '[data-testid*="company" i]',
          '[class*="company-name" i]',
          '[class*="employer" i]',
          '[class*="organization" i]'
        ]) ||
        getMetaContent(["og:site_name"]) ||
        extractCompanyFromTitle(title, roleName)
    );

    const locationText = constants.cleanText(
      locationFromJsonLd(jsonLd) ||
        textFromSelector([
          '[data-testid*="location" i]',
          '[class*="job-location" i]',
          '[class*="location" i]',
          '[class*="posting-categories" i]'
        ])
    );

    return {
      roleName,
      companyName,
      jobLink: location.href,
      location: locationText || "NA",
      jobType: constants.inferJobType(`${locationText} ${pageText}`),
      source: "generic",
      detectedAt: new Date().toISOString(),
      isJobPage: pageLooksLikeJob()
    };
  }

  globalThis.WdiaGenericExtractor = {
    extract,
    getMetaContent,
    textFromSelector
  };
})();
