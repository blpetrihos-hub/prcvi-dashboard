/**
 * Visit mailer for the resume site and the PRCVI dashboard.
 *
 * Paste this into the existing personal Gmail Apps Script project
 * (not blpetrihos@wm.edu). Deploy -> Manage deployments -> Edit -> New version.
 * Same web app URL stays valid.
 * Execute as: Me. Who has access: Anyone.
 *
 * Keep this project on personal Gmail so MailApp can deliver.
 * Notices go to blpetrihos@wm.edu.
 */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var cache = CacheService.getScriptCache();
  var stamp = String(p.site || "") + "|" + String(p.ip || "") + "|" + String(p.page || "");
  if (stamp !== "||" && cache.get(stamp)) {
    return ContentService.createTextOutput("ok");
  }
  if (stamp !== "||") {
    cache.put(stamp, "1", 600);
  }

  p = enrichGeo_(p);

  var site = siteLabel_(p);
  var city = p.city || "unknown";
  var country = p.country || "unknown";
  var referrer = p.ref || "(none / typed or bookmark)";
  var body = [
    "Someone opened " + site.noun + ".",
    "",
    "When: " + new Date().toString(),
    "City: " + city,
    "Region: " + (p.region || ""),
    "Country: " + country,
    "IP: " + (p.ip || ""),
    "Network: " + (p.isp || ""),
    "Page: " + (p.page || ""),
    "Came from: " + referrer,
    "Timezone: " + (p.tz || ""),
    "Language: " + (p.lang || ""),
    "Browser: " + (p.ua || "")
  ].join("\n");

  MailApp.sendEmail({
    to: "blpetrihos@wm.edu",
    subject: site.subject + ": " + city + ", " + country,
    body: body
  });

  return ContentService.createTextOutput("ok");
}

function siteLabel_(p) {
  var site = String(p.site || "").toLowerCase();
  var page = String(p.page || "").toLowerCase();
  if (site === "prcvi" || page.indexOf("prcvi-dashboard") !== -1) {
    return { noun: "the PRCVI dashboard", subject: "PRCVI dashboard visit" };
  }
  return { noun: "the resume site", subject: "Resume site visit" };
}

function isBadCity_(city) {
  city = String(city || "").trim();
  return !city || /^unknown$/i.test(city) || /^district\s+\d+$/i.test(city);
}

function enrichGeo_(p) {
  if (isBadCity_(p.city) && campusCity_(p)) {
    p.city = campusCity_(p);
    if (!p.region) p.region = "Virginia";
    if (!p.country || p.country === "unknown") p.country = "United States";
  }

  var ip = String(p.ip || "");
  var needCity = isBadCity_(p.city);
  var needCountry = !p.country || p.country === "unknown";
  if (!ip || (!needCity && !needCountry && p.region && p.isp)) {
    return p;
  }

  var g = lookupIp_(ip);
  if (!g) {
    if (needCity && campusCity_(p)) {
      p.city = campusCity_(p);
    }
    return p;
  }
  if (needCity && !isBadCity_(g.city)) p.city = g.city;
  if (!p.region) p.region = g.region || p.region;
  if (needCountry) p.country = g.country || p.country;
  if (!p.isp) p.isp = g.isp || p.isp;
  if (isBadCity_(p.city) && campusCity_(p)) {
    p.city = campusCity_(p);
  }
  return p;
}

function campusCity_(p) {
  var ip = String(p.ip || "");
  var isp = String(p.isp || "");
  var postal = String(p.postal || "");
  if (/^128\.239\./.test(ip) || /william and mary/i.test(isp) || /^2318[567]$/.test(postal)) {
    return "Williamsburg";
  }
  return "";
}

function lookupIp_(ip) {
  var urls = [
    "https://get.geojs.io/v1/ip/geo/" + encodeURIComponent(ip) + ".json",
    "https://ipwho.is/" + encodeURIComponent(ip),
    "https://ipapi.co/" + encodeURIComponent(ip) + "/json/"
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var resp = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) {
        continue;
      }
      var g = JSON.parse(resp.getContentText());
      if (!g || g.success === false || g.error) {
        continue;
      }
      var city = g.city || "";
      if (isBadCity_(city)) {
        continue;
      }
      return {
        city: city,
        region: g.region || "",
        country: g.country_name || g.country || "",
        isp: (g.connection && g.connection.isp) || g.organization_name || g.org || ""
      };
    } catch (err) {}
  }
  return null;
}
