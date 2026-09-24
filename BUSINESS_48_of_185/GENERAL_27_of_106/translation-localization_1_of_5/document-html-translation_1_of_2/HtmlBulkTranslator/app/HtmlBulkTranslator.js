/* ============================================================
   HtmlBulkTranslator - JS
   Uniconhub CMS html-tool.
   One tool instance = one HTML document. The document is
   translated into every configured language ONE AT A TIME
   (strictly sequential, never parallel).

   Pipeline (AI never writes full HTML):
     1. Extract translatable text (text nodes + title/alt/
        placeholder/aria-label/meta-description) from the
        source HTML into a JSON segment array. Free, exact.
     2. Per language, one AI call (chunked if huge) that
        returns translated JSON segments with the same ids.
     3. The tool rebuilds each language HTML by walking the
        original DOM and swapping the text in place - the
        markup is copied, not regenerated.

   Everything is stored in tool.setValue() = the one CMS
   object this tool instance lives on.

   Entry point: tool.onReady
   ============================================================ */
(function () {
  "use strict";

  /* ---- SDK handle + fallback shim ---- */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var fallbackValue = null;
    tool = {
      onReady: function (cb) { cb(fallbackValue, {}); },
      getValue: function () { return fallbackValue; },
      setValue: function (value) { fallbackValue = value; },
      onValueChange: function () {}, getFields: function () { return {}; },
      watchField: function () {}, setField: function () {}, setFields: function () {},
      onFieldsChange: function () {},
      param: function (name, defaultValue) { return defaultValue; },
      isReadOnly: function () { return false; },
      onReadonlyChange: function () {}, getUser: function () { return null; },
      onUserChange: function () {}, reportValid: function () {},
      notify: function (message, severity) { try { console.log("notify:", message); } catch (e) {} },
      resize: function () {}, declareOutput: function () {}, declareParams: function () {},
      reportMissingParams: function () {},
      getPermittedUsers: function () { return []; }, onPermittedUsersChange: function () {},
      requestAI: function (prompt, context, cb) { cb("requestAI not available", null); },
      requestSave: function (cb) { cb("requestSave not available", false); }
    };
  }

  /* ---- Constants ---- */
  var HBT_SKIP_TAGS = {
    script: 1, style: 1, noscript: 1, template: 1, svg: 1, math: 1,
    iframe: 1, object: 1, embed: 1, code: 1, kbd: 1, samp: 1, textarea: 1
  };
  var HBT_TRANSLATABLE_ATTRIBUTES = ["title", "alt", "placeholder", "aria-label"];
  var HBT_MAX_CHUNK_CHARS = 150000;
  var HBT_IDENTITY_POLL_DELAYS = [400, 1200, 2600, 5000];
  var HBT_QUICK_LANGUAGES = [
    "English", "French", "German", "Spanish", "Italian", "Portuguese", "Dutch",
    "Turkish", "Arabic", "Russian", "Ukrainian", "Polish", "Greek", "Swedish",
    "Chinese (Simplified)", "Japanese", "Korean", "Hindi", "Hebrew", "Persian"
  ];
  var HBT_SAMPLE_DOCUMENT_HTML = [
    '<div class="hero">',
    '  <h1>Welcome to GreenLeaf Gardens</h1>',
    '  <p>Organic produce delivered fresh to your door every week.</p>',
    '  <a href="/order" title="Start your order">Order Now</a>',
    '  <img src="banner.jpg" alt="A basket of fresh vegetables">',
    '</div>',
    '<section class="features">',
    '  <h2>Why choose us</h2>',
    '  <ul>',
    '    <li>Certified organic since 2008</li>',
    '    <li>Free delivery on orders over $50</li>',
    '    <li>Cancel or pause your plan anytime</li>',
    '  </ul>',
    '  <p>Join more than 12,000 happy customers.</p>',
    '  <button type="button">Subscribe today</button>',
    '  <form>',
    '    <input type="text" placeholder="Enter your email address">',
    '    <button type="submit">Sign Up</button>',
    '  </form>',
    '</section>'
  ].join("\n");

  /* ---- State ---- */
  var DB = null;                 // normalized saved value
  var _extraction = null;        // { segments, stats, dedupeOn } for DB.source.html
  var _running = false;
  var _cancelRequested = false;
  var _queue = [];               // languages still to translate in the current run
  var _runStatusText = "";
  var _user = null;
  var _noIdentity = false;
  var _readOnly = false;
  var _identityPollAttempts = 0;
  var _lastStagedJson = "";
  var _persistTimer = null;
  var _warnedRequestSave = false;
  var _resetArmed = false;
  var _resetArmTimer = null;

  /* ============================================================
     Helpers
     ============================================================ */
  function el(id) { return document.getElementById(id); }
  function escHtml(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function nowISO() { return new Date().toISOString(); }
  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function formatShortDateTime(isoText) {
    if (!isoText) return "";
    try {
      var date = new Date(isoText);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function slugifyText(text) {
    var normalized = String(text == null ? "" : text).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    var slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug.slice(0, 60) || "document";
  }
  function notify(message, severity) {
    try { if (typeof tool.notify === "function") tool.notify(message, severity || "info"); } catch (e) {}
  }
  function resizeTool() { try { if (typeof tool.resize === "function") tool.resize(); } catch (e) {} }
  function hasUserApi() { return typeof tool.getUser === "function"; }
  function getUserSafe() {
    try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; }
  }
  function getRolesList() {
    var user = getUserSafe();
    if (!user) return [];
    if (user.roles && user.roles.length) return user.roles;
    var effectiveAccess = user.effectiveAccess || {};
    var roles = [];
    if (effectiveAccess.isManager) roles.push("admin");
    if (effectiveAccess.isEditor) roles.push("editor");
    if (effectiveAccess.isViewer) roles.push("viewer");
    return roles;
  }
  function canWrite() {
    if (_readOnly) return false;
    if (_noIdentity) return true; // host enforces real permissions server-side
    if (!_user) return false;
    var roles = getRolesList();
    var writeRoles = ["admin", "owner", "developer", "user-manager", "editor"];
    for (var i = 0; i < writeRoles.length; i++) {
      if (roles.indexOf(writeRoles[i]) > -1) return true;
    }
    var effectiveAccess = _user.effectiveAccess || {};
    if (effectiveAccess.isEditor || effectiveAccess.isManager) return true;
    return false;
  }
  function aiServiceEnabled() {
    return tool.param("allowAi", "") === "yes" && typeof tool.requestAI === "function";
  }

  /* ============================================================
     Database normalization
     ============================================================ */
  function normalizeDatabase(value) {
    var input = (value && typeof value === "object") ? value : {};
    var sourceInput = (input.source && typeof input.source === "object") ? input.source : {};
    var languagesInput = Array.isArray(input.languages) ? input.languages : [];
    var languages = [];
    languagesInput.forEach(function (language) {
      if (typeof language !== "string") return;
      var trimmed = language.trim();
      if (!trimmed) return;
      var alreadyPresent = languages.some(function (existing) {
        return existing.toLowerCase() === trimmed.toLowerCase();
      });
      if (!alreadyPresent) languages.push(trimmed);
    });
    var translationsInput = (input.translations && typeof input.translations === "object") ? input.translations : {};
    var translations = {};
    languages.forEach(function (language) {
      var translation = translationsInput[language];
      if (!translation || typeof translation !== "object") {
        translations[language] = { status: "pending", html: "", error: "", updatedAt: "", missingCount: 0 };
        return;
      }
      var status = translation.status;
      if (status === "translating") status = "pending"; // stale state after a crash
      if (status !== "done" && status !== "failed" && status !== "pending") status = "pending";
      translations[language] = {
        status: status,
        html: typeof translation.html === "string" ? translation.html : "",
        error: typeof translation.error === "string" ? translation.error : "",
        updatedAt: typeof translation.updatedAt === "string" ? translation.updatedAt : "",
        missingCount: typeof translation.missingCount === "number" ? translation.missingCount : 0
      };
    });
    return {
      version: 1,
      source: {
        html: typeof sourceInput.html === "string" ? sourceInput.html : "",
        fileName: typeof sourceInput.fileName === "string" ? sourceInput.fileName : "",
        updatedAt: typeof sourceInput.updatedAt === "string" ? sourceInput.updatedAt : ""
      },
      languages: languages,
      translations: translations,
      flags: (input.flags && typeof input.flags === "object") ? input.flags : {},
      updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : ""
    };
  }

  function translationStatusOf(language) {
    var translation = DB.translations[language];
    var status = translation ? translation.status : "pending";
    if (status === "translating" && !_running) return "pending";
    return status;
  }

  function countLanguagesByStatus(status) {
    var count = 0;
    DB.languages.forEach(function (language) {
      if (translationStatusOf(language) === status) count++;
    });
    return count;
  }

  /* ============================================================
     Persistence (tool.setValue + requestSave)
     ============================================================ */
  function requestParentSave() {
    if (_readOnly || !canWrite()) return;
    if (typeof tool.requestSave !== "function") { setSaveState("staged"); return; }
    try {
      tool.requestSave(function (saveError, saveOk) {
        if (saveError || !saveOk) {
          if (!_warnedRequestSave) {
            _warnedRequestSave = true;
            notify("Auto-save needs allowRequestSave: yes in the field settings - remember to save the parent form", "warning");
          }
          setSaveState("staged");
        } else {
          setSaveState("synced");
        }
      });
    } catch (e) { setSaveState("staged"); }
  }

  function persistNow() {
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
    DB.updatedAt = nowISO();
    var stagedJson = JSON.stringify(DB);
    if (stagedJson === _lastStagedJson) return;
    _lastStagedJson = stagedJson;
    try { tool.setValue(JSON.parse(stagedJson)); } catch (e) {}
    requestParentSave();
  }

  function persistLater(delayMs) {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(persistNow, delayMs || 500);
  }

  function setSaveState(saveState) {
    var badge = el("hbtSaveState");
    if (!badge) return;
    badge.classList.add("hbt-save-visible");
    badge.classList.toggle("hbt-save-staged", saveState === "staged");
    badge.textContent = saveState === "staged" ? "◌ staged - save the form" : "✓ synced";
  }

  /* ============================================================
     Extraction: HTML -> JSON segments (in the tool, no AI)
     ============================================================ */
  function isTranslatableCore(text) {
    if (!text) return false;
    return /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(text);
  }

  function splitWhitespaceAroundCore(rawValue) {
    var leadingWhitespace = rawValue.match(/^\s*/)[0];
    var trailingWhitespace = rawValue.match(/\s*$/)[0];
    var core = rawValue.slice(leadingWhitespace.length, rawValue.length - trailingWhitespace.length);
    return { leading: leadingWhitespace, core: core, trailing: trailingWhitespace };
  }

  function parseSourceHtml(sourceHtml) {
    var trimmed = String(sourceHtml || "").trim();
    var looksLikeFullDocument = /<!doctype/i.test(sourceHtml) || /<html[\s>]/i.test(sourceHtml) ||
      /<head[\s>]/i.test(sourceHtml) || /<body[\s>]/i.test(sourceHtml);
    if (looksLikeFullDocument) {
      var parsedDocument = new DOMParser().parseFromString(sourceHtml, "text/html");
      return {
        root: parsedDocument.documentElement,
        serialize: function () {
          var html = parsedDocument.documentElement.outerHTML;
          if (/<!doctype/i.test(sourceHtml)) html = "<!DOCTYPE html>\n" + html;
          return html;
        }
      };
    }
    var fragmentTemplate = document.createElement("template");
    fragmentTemplate.innerHTML = sourceHtml;
    return {
      root: fragmentTemplate.content,
      serialize: function () { return fragmentTemplate.innerHTML; }
    };
  }

  function walkDomNodes(node, onElement, onText) {
    if (node.nodeType === 3) { onText(node); return; }
    if (node.nodeType === 11) { // DocumentFragment root (fragment-mode parsing)
      var fragmentChildren = node.childNodes;
      for (var f = 0; f < fragmentChildren.length; f++) {
        walkDomNodes(fragmentChildren[f], onElement, onText);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    var tagName = node.nodeName ? node.nodeName.toLowerCase() : "";
    if (HBT_SKIP_TAGS[tagName]) return;
    if (node.getAttribute && node.getAttribute("translate") === "no") return;
    onElement(node);
    var children = node.childNodes;
    for (var i = 0; i < children.length; i++) walkDomNodes(children[i], onElement, onText);
  }

  function extractSegmentsFromHtml(sourceHtml) {
    var parsed = parseSourceHtml(sourceHtml);
    var dedupeOn = tool.param("deduplicateTexts", "yes") !== "no";
    var segments = [];
    var seenKeys = {};
    var occurrenceCounter = 0;
    var stats = { textOccurrences: 0, attributeOccurrences: 0, totalCharacters: 0 };

    function recordCore(rawValue, keyPrefix, statCounter) {
      var parts = splitWhitespaceAroundCore(rawValue);
      if (!isTranslatableCore(parts.core)) return;
      var baseKey = keyPrefix + parts.core;
      var key = dedupeOn ? baseKey : baseKey + "|" + (occurrenceCounter++);
      if (dedupeOn && seenKeys.hasOwnProperty(key)) { statCounter(); return; }
      segments.push({ id: "s" + (segments.length + 1), key: key, text: parts.core });
      seenKeys[key] = segments.length - 1;
      stats.totalCharacters += parts.core.length;
      statCounter();
    }

    function onElement(node) {
      var tagName = node.nodeName ? node.nodeName.toLowerCase() : "";
      if (tagName === "meta" && node.getAttribute("name") === "description") {
        var description = node.getAttribute("content");
        if (description) recordCore(description, "m|desc|", function () { stats.attributeOccurrences++; });
      }
      if (tagName === "input") {
        var inputType = (node.getAttribute("type") || "text").toLowerCase();
        if (inputType === "button" || inputType === "submit" || inputType === "reset") {
          var inputValue = node.getAttribute("value");
          if (inputValue) recordCore(inputValue, "a|value|", function () { stats.attributeOccurrences++; });
        }
      }
      for (var a = 0; a < HBT_TRANSLATABLE_ATTRIBUTES.length; a++) {
        var attributeName = HBT_TRANSLATABLE_ATTRIBUTES[a];
        var attributeValue = node.getAttribute(attributeName);
        if (!attributeValue) continue;
        recordCore(attributeValue, "a|" + attributeName + "|", function () { stats.attributeOccurrences++; });
      }
    }

    function onText(textNode) {
      recordCore(textNode.nodeValue || "", "t|", function () { stats.textOccurrences++; });
    }

    walkDomNodes(parsed.root, onElement, onText);
    return { segments: segments, stats: stats, dedupeOn: dedupeOn };
  }

  /* ============================================================
     AI translation of one language (sequential chunks)
     ============================================================ */
  function buildSegmentChunks(segments) {
    var chunks = [];
    var currentChunk = [];
    var currentSize = 0;
    for (var i = 0; i < segments.length; i++) {
      var itemText = JSON.stringify({ id: segments[i].id, text: segments[i].text });
      var itemSize = itemText.length + 1;
      if (currentChunk.length && currentSize + itemSize > HBT_MAX_CHUNK_CHARS) {
        chunks.push("[" + currentChunk.join(",") + "]");
        currentChunk = [];
        currentSize = 0;
      }
      currentChunk.push(itemText);
      currentSize += itemSize;
    }
    if (currentChunk.length) chunks.push("[" + currentChunk.join(",") + "]");
    return chunks;
  }

  function buildTranslationPrompt(language, payloadJson) {
    var instructionLines = [];
    instructionLines.push("You are a professional website translator.");
    instructionLines.push("Target language: " + language + ".");
    instructionLines.push("Translate the \"text\" value of EVERY object in the JSON array below into " + language + ".");
    instructionLines.push("RULES:");
    instructionLines.push("- Return ONLY a valid JSON array with exactly the same ids, in the same order, for example [{\"id\":\"s1\",\"text\":\"...\"}].");
    instructionLines.push("- No explanations, no markdown, nothing outside the JSON array.");
    instructionLines.push("- Do NOT translate: HTML entities, code, URLs, email addresses, numbers, and placeholders such as {{name}}, {name}, %s, [amount].");
    instructionLines.push("- Preserve the tone and meaning. Use natural " + language + ".");
    var translationInstructions = tool.param("translationInstructions", "").trim();
    if (translationInstructions) instructionLines.push("EXTRA INSTRUCTIONS: " + translationInstructions);
    var protectedTerms = tool.param("protectedTerms", "").trim();
    if (protectedTerms) instructionLines.push("NEVER TRANSLATE THESE TERMS, keep them exactly as they are: " + protectedTerms);
    return instructionLines.join("\n") + "\nJSON ARRAY:\n" + payloadJson;
  }

  function parseAiTranslationArray(responseText) {
    if (!responseText) return null;
    var text = String(responseText).trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    var startIndex = text.indexOf("[");
    var endIndex = text.lastIndexOf("]");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
    var jsonText = text.slice(startIndex, endIndex + 1).replace(/,\s*([\]}])/g, "$1");
    try {
      var parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(function (item) {
        return item && typeof item.id === "string" && typeof item.text === "string";
      });
    } catch (e) { return null; }
  }

  function translateOneLanguage(language, callback) {
    var chunks = buildSegmentChunks(_extraction.segments);
    var translatedById = {};
    var chunkIndex = 0;

    function translateNextChunk() {
      if (_cancelRequested) { callback("__cancelled__", null); return; }
      if (chunkIndex >= chunks.length) {
        var applyData = buildApplyData(translatedById);
        var result = buildTranslatedHtml(DB.source.html, applyData.maps, applyData.queues);
        callback(null, result);
        return;
      }
      var chunkJson = chunks[chunkIndex];
      chunkIndex++;
      updateRunStatus("Translating " + language + " - part " + chunkIndex + " of " + chunks.length +
        " (" + countItemsInChunkJson(chunkJson) + " texts)");
      tool.requestAI(buildTranslationPrompt(language, chunkJson), "", function (aiError, responseText) {
        if (aiError && !responseText) { callback("AI error: " + aiError, null); return; }
        var parsed = parseAiTranslationArray(responseText);
        if (!parsed || !parsed.length) {
          callback("The AI response for " + language + " did not contain any translations", null);
          return;
        }
        parsed.forEach(function (item) {
          translatedById[item.id] = item.text;
        });
        translateNextChunk();
      });
    }

    translateNextChunk();
  }

  function countItemsInChunkJson(chunkJson) {
    try { return JSON.parse(chunkJson).length; } catch (e) { return 0; }
  }

  function buildApplyData(translatedById) {
    var applyMaps = {};
    var applyQueues = {};
    for (var i = 0; i < _extraction.segments.length; i++) {
      var segment = _extraction.segments[i];
      var translated = translatedById[segment.id];
      if (typeof translated !== "string" || translated.length === 0) continue;
      if (_extraction.dedupeOn) {
        applyMaps[segment.key] = translated;
      } else {
        if (!applyQueues[segment.key]) applyQueues[segment.key] = [];
        applyQueues[segment.key].push(translated);
      }
    }
    return { maps: applyMaps, queues: applyQueues };
  }

  /* ============================================================
     Rebuild: JSON translations -> translated HTML (in the tool)
     ============================================================ */
  function buildTranslatedHtml(sourceHtml, applyMaps, applyQueues) {
    var parsed = parseSourceHtml(sourceHtml);
    var dedupeOn = _extraction.dedupeOn;
    var missingCount = 0;
    var occurrenceCounter = 0;

    function lookupTranslated(key) {
      if (dedupeOn) {
        if (applyMaps && applyMaps.hasOwnProperty(key)) {
          var mapped = applyMaps[key];
          if (typeof mapped === "string" && mapped.length > 0) return mapped;
        }
        return null;
      }
      if (applyQueues && applyQueues[key] && applyQueues[key].length) {
        var queued = applyQueues[key].shift();
        if (typeof queued === "string" && queued.length > 0) return queued;
      }
      return null;
    }

    function replaceCore(rawValue, keyPrefix, setter) {
      var parts = splitWhitespaceAroundCore(rawValue);
      if (!isTranslatableCore(parts.core)) return;
      var baseKey = keyPrefix + parts.core;
      var key = dedupeOn ? baseKey : baseKey + "|" + (occurrenceCounter++);
      var translated = lookupTranslated(key);
      if (translated === null) { missingCount++; return; }
      setter(parts.leading + translated + parts.trailing);
    }

    function onElement(node) {
      var tagName = node.nodeName ? node.nodeName.toLowerCase() : "";
      if (tagName === "meta" && node.getAttribute("name") === "description") {
        var description = node.getAttribute("content");
        if (description) {
          replaceCore(description, "m|desc|", function (newValue) { node.setAttribute("content", newValue); });
        }
      }
      if (tagName === "input") {
        var inputType = (node.getAttribute("type") || "text").toLowerCase();
        if (inputType === "button" || inputType === "submit" || inputType === "reset") {
          var inputValue = node.getAttribute("value");
          if (inputValue) {
            replaceCore(inputValue, "a|value|", function (newValue) { node.setAttribute("value", newValue); });
          }
        }
      }
      for (var a = 0; a < HBT_TRANSLATABLE_ATTRIBUTES.length; a++) {
        var attributeName = HBT_TRANSLATABLE_ATTRIBUTES[a];
        var attributeValue = node.getAttribute(attributeName);
        if (!attributeValue) continue;
        replaceCore(attributeValue, "a|" + attributeName + "|", function (newValue) {
          node.setAttribute(attributeName, newValue);
        });
      }
    }

    function onText(textNode) {
      var rawValue = textNode.nodeValue || "";
      replaceCore(rawValue, "t|", function (newValue) { textNode.nodeValue = newValue; });
    }

    walkDomNodes(parsed.root, onElement, onText);
    return { html: parsed.serialize(), missingCount: missingCount };
  }

  /* ============================================================
     Run queue - one language at a time, strictly sequential
     ============================================================ */
  function startTranslationQueue(languagesToProcess) {
    if (_running) return;
    var sourceHtml = DB.source.html.trim();
    if (!sourceHtml) { notify("Paste or load the HTML document first", "warning"); return; }
    if (!languagesToProcess.length) { notify("Add at least one target language", "warning"); return; }
    if (!aiServiceEnabled()) {
      notify("The AI service is not enabled for this tool (allowAi must be yes)", "error");
      return;
    }
    var extraction = extractSegmentsFromHtml(DB.source.html);
    if (!extraction.segments.length) { notify("No translatable text found in the document", "warning"); return; }
    _extraction = extraction;
    _queue = languagesToProcess.slice();
    languagesToProcess.forEach(function (language) {
      var translation = DB.translations[language] || {};
      translation.status = "pending";
      translation.error = "";
      DB.translations[language] = translation;
    });
    _cancelRequested = false;
    _running = true;
    _runStatusText = "";
    persistNow();
    renderTranslationList();
    renderRunControls();
    resizeTool();
    processNextLanguage();
  }

  function processNextLanguage() {
    if (!_running) return;
    if (_cancelRequested || !_queue.length) { finishTranslationRun(); return; }
    var language = _queue[0];
    var translation = DB.translations[language] || {};
    if (translation.status === "done") { _queue.shift(); processNextLanguage(); return; }
    translation.status = "translating";
    translation.error = "";
    DB.translations[language] = translation;
    renderTranslationList();
    renderRunControls();
    translateOneLanguage(language, function (translateError, result) {
      if (translateError === "__cancelled__") {
        var cancelledTranslation = DB.translations[language] || {};
        cancelledTranslation.status = "pending";
        DB.translations[language] = cancelledTranslation;
        finishTranslationRun();
        return;
      }
      var finishedTranslation = DB.translations[language] || {};
      if (translateError) {
        finishedTranslation.status = "failed";
        finishedTranslation.error = translateError;
        DB.translations[language] = finishedTranslation;
        persistNow();
        notify(language + " failed: " + translateError, "error");
      } else {
        finishedTranslation.status = "done";
        finishedTranslation.html = result.html;
        finishedTranslation.missingCount = result.missingCount;
        finishedTranslation.updatedAt = nowISO();
        DB.translations[language] = finishedTranslation;
        persistNow();
        if (result.missingCount > 0) {
          notify(language + " translated - " + result.missingCount + " texts stayed in the original language", "warning");
        } else {
          notify(language + " translated", "success");
        }
      }
      _queue.shift();
      renderTranslationList();
      renderResultsPanel();
      renderRunControls();
      resizeTool();
      processNextLanguage();
    });
  }

  function finishTranslationRun() {
    var wasRunning = _running;
    _running = false;
    _queue = [];
    _runStatusText = "";
    renderRunControls();
    renderTranslationList();
    renderResultsPanel();
    if (wasRunning && !_cancelRequested) {
      var doneCount = countLanguagesByStatus("done");
      var failedCount = countLanguagesByStatus("failed");
      if (failedCount > 0) {
        notify("Translation run finished: " + doneCount + " done, " + failedCount + " failed", "warning");
      } else {
        notify("All languages translated", "success");
      }
    }
    _cancelRequested = false;
  }

  function updateRunStatus(text) {
    _runStatusText = text;
    var statusEl = el("hbtRunStatus");
    if (statusEl) statusEl.textContent = text;
  }

  /* ============================================================
     Identity + read-only
     ============================================================ */
  function renderUserBadge() {
    var badge = el("hbtRoleBadge");
    if (!badge) return;
    var label = "View only";
    if (_noIdentity) label = "CMS session";
    else {
      var roles = getRolesList();
      if (roles.indexOf("admin") > -1 || roles.indexOf("owner") > -1 ||
          roles.indexOf("developer") > -1 || roles.indexOf("user-manager") > -1) label = "Admin";
      else if (roles.indexOf("editor") > -1) label = "Editor";
      else if (roles.indexOf("viewer") > -1) label = "Viewer";
    }
    badge.textContent = label;
  }

  function initIdentity() {
    if (!hasUserApi()) {
      _noIdentity = true;
      _user = null;
      renderUserBadge();
      applyReadOnlyState();
      return;
    }
    _user = getUserSafe();
    renderUserBadge();
    applyReadOnlyState();
    if (!_user || !getRolesList().length) pollIdentity();
    if (typeof tool.onUserChange === "function") {
      tool.onUserChange(function (user) {
        _user = user || getUserSafe();
        _noIdentity = false;
        renderUserBadge();
        applyReadOnlyState();
        renderRunControls();
      });
    }
  }

  function pollIdentity() {
    if (_identityPollAttempts >= HBT_IDENTITY_POLL_DELAYS.length) {
      if (!_user) _noIdentity = true;
      renderUserBadge();
      applyReadOnlyState();
      renderRunControls();
      return;
    }
    var delay = HBT_IDENTITY_POLL_DELAYS[_identityPollAttempts];
    _identityPollAttempts++;
    setTimeout(function () {
      var user = getUserSafe();
      if (user && getRolesList().length) {
        _user = user;
        renderUserBadge();
        applyReadOnlyState();
        renderRunControls();
        return;
      }
      pollIdentity();
    }, delay);
  }

  function applyReadOnlyState() {
    var locked = !canWrite();
    var appRoot = el("hbtApp");
    if (appRoot) appRoot.classList.toggle("hbt-locked", locked);
    var editableIds = [
      "hbtSourceInput", "hbtLangInput",
      "hbtBtnLoadFile", "hbtBtnSample", "hbtBtnClearSource", "hbtBtnExtract",
      "hbtBtnAddLang", "hbtBtnStart", "hbtBtnCancel", "hbtBtnRetry", "hbtBtnReset",
      "hbtBtnDownloadAll"
    ];
    for (var i = 0; i < editableIds.length; i++) {
      var node = el(editableIds[i]);
      if (!node) continue;
      if (editableIds[i] === "hbtSourceInput" || editableIds[i] === "hbtLangInput") {
        node.readOnly = locked;
      } else {
        node.disabled = locked;
      }
    }
    renderRunControls();
  }

  /* ============================================================
     Rendering
     ============================================================ */
  function renderAll() {
    renderSourcePanel();
    renderLanguagesPanel();
    renderTranslationList();
    renderResultsPanel();
    renderRunControls();
    renderUserBadge();
    applyReadOnlyState();
    resizeTool();
  }

  function renderSourcePanel() {
    var textarea = el("hbtSourceInput");
    if (textarea && document.activeElement !== textarea) textarea.value = DB.source.html;
    renderSourceMeta();
    renderExtractionInfo();
    renderSizeEstimate();
  }

  function renderSourceMeta() {
    var meta = el("hbtSourceMeta");
    if (!meta) return;
    var fileName = DB.source.fileName || "pasted document";
    meta.textContent = fileName + " - " + formatBytes(DB.source.html.length);
  }

  function renderExtractionInfo() {
    var info = el("hbtExtractInfo");
    if (!info) return;
    if (!_extraction) { info.textContent = "Texts not extracted yet"; return; }
    var occurrenceTotal = _extraction.stats.textOccurrences + _extraction.stats.attributeOccurrences;
    info.textContent = _extraction.segments.length + " unique texts (" + occurrenceTotal +
      " occurrences) - " + _extraction.stats.totalCharacters + " characters";
  }

  function renderSizeEstimate() {
    var estimate = el("hbtSizeEstimate");
    if (!estimate) return;
    var estimatedBytes = JSON.stringify({ source: DB.source.html }).length;
    var doneTranslations = 0;
    DB.languages.forEach(function (language) {
      var translation = DB.translations[language];
      if (translation && translation.status === "done" && typeof translation.html === "string") {
        estimatedBytes += translation.html.length + 140;
        doneTranslations++;
      }
    });
    var remaining = DB.languages.length - doneTranslations;
    if (remaining > 0 && DB.source.html) {
      estimatedBytes += Math.round(DB.source.html.length * 1.05) * remaining;
    }
    estimate.textContent = "Estimated stored size: " + formatBytes(estimatedBytes) + " of ~1,024 KB";
    estimate.classList.toggle("hbt-warn", estimatedBytes > 870000);
    if (estimatedBytes > 870000) {
      estimate.textContent += " - warning: near the Firestore 1 MB limit, fewer languages or a shorter document is safer";
    }
  }

  function renderLanguagesPanel() {
    var quickContainer = el("hbtLangQuick");
    if (quickContainer) {
      var quickChips = HBT_QUICK_LANGUAGES.map(function (language) {
        var active = DB.languages.some(function (existing) {
          return existing.toLowerCase() === language.toLowerCase();
        });
        return '<button type="button" class="hbt-quick-chip' + (active ? " hbt-quick-on" : "") +
          '" data-act="toggle-quick-language" data-language="' + escHtml(language) + '">' + escHtml(language) + "</button>";
      });
      quickContainer.innerHTML = quickChips.join("");
    }
    var chipsContainer = el("hbtLangChips");
    if (chipsContainer) {
      if (!DB.languages.length) {
        chipsContainer.innerHTML = '<span class="hbt-lang-empty">No languages added yet. Use the quick picks or type one above.</span>';
      } else {
        chipsContainer.innerHTML = DB.languages.map(function (language) {
          return '<span class="hbt-lang-chip">' + escHtml(language) +
            '<button type="button" class="hbt-chip-remove" data-act="remove-language" data-language="' +
            escHtml(language) + '" title="Remove ' + escHtml(language) + '">×</button></span>';
        }).join("");
      }
    }
    var count = el("hbtLangCount");
    if (count) count.textContent = DB.languages.length + " language" + (DB.languages.length === 1 ? "" : "s");
  }

  function languageRowHtml(language) {
    var translation = DB.translations[language] || {};
    var status = translationStatusOf(language);
    var rowClass = "hbt-lang-row";
    var statusIcon = "⏳";
    var statusText = "Waiting";
    if (status === "translating") {
      rowClass += " hbt-row-translating";
      statusIcon = '<span class="hbt-spinner"></span>';
      statusText = _runStatusText || "Translating...";
    } else if (status === "done") {
      rowClass += " hbt-row-done";
      statusIcon = '<span class="hbt-st-done">✓</span>';
      var detailParts = ["Done", "updated " + formatShortDateTime(translation.updatedAt)];
      detailParts.push(formatBytes(translation.html.length));
      if (translation.missingCount > 0) detailParts.push(translation.missingCount + " texts unchanged");
      statusText = detailParts.join(" - ");
    } else if (status === "failed") {
      rowClass += " hbt-row-failed";
      statusIcon = '<span class="hbt-st-failed">✕</span>';
      statusText = "Failed: " + (translation.error || "unknown error");
    }
    var actions = "";
    if (status === "done") {
      actions += '<button type="button" class="hbt-btn hbt-btn-outline" data-act="view-result" data-language="' +
        escHtml(language) + '">View ↓</button>';
    } else if (status === "failed") {
      actions += '<button type="button" class="hbt-btn hbt-btn-outline" data-act="retry-language" data-language="' +
        escHtml(language) + '">↻ Retry</button>';
    }
    return '<div class="' + rowClass + '">' +
      '<span class="hbt-lang-status">' + statusIcon + "</span>" +
      '<span class="hbt-lang-name">' + escHtml(language) + "</span>" +
      '<span class="hbt-lang-state">' + escHtml(statusText) + "</span>" +
      '<span class="hbt-lang-actions">' + actions + "</span></div>";
  }

  function renderTranslationList() {
    var container = el("hbtLangList");
    if (!container) return;
    if (!DB.languages.length) {
      container.innerHTML = '<div class="hbt-results-empty">Add target languages above to see the progress list here.</div>';
      return;
    }
    container.innerHTML = DB.languages.map(languageRowHtml).join("");
  }

  function resultCardHtml(language) {
    var translation = DB.translations[language];
    var metaParts = [formatBytes(translation.html.length)];
    if (translation.missingCount > 0) {
      metaParts.push('<span class="hbt-missing-note">' + translation.missingCount + " texts unchanged</span>");
    }
    metaParts.push("updated " + formatShortDateTime(translation.updatedAt));
    return '<div class="hbt-result" data-lang="' + escHtml(language) + '">' +
      '<div class="hbt-result-head">' +
      '<span class="hbt-lang-name">' + escHtml(language) + "</span>" +
      '<span class="hbt-result-meta">' + metaParts.join(" - ") + "</span>" +
      '<button type="button" class="hbt-btn hbt-btn-outline" data-act="copy-result" data-language="' + escHtml(language) + '">Copy HTML</button>' +
      '<button type="button" class="hbt-btn hbt-btn-outline" data-act="download-result" data-language="' + escHtml(language) + '">⬇ .html</button>' +
      "</div>" +
      '<details class="hbt-preview-wrap"><summary>Preview</summary>' +
      '<iframe class="hbt-preview-frame" data-lang="' + escHtml(language) + '" sandbox="allow-scripts"></iframe>' +
      "</details></div>";
  }

  function renderResultsPanel() {
    var container = el("hbtResults");
    if (!container) return;
    var doneLanguages = DB.languages.filter(function (language) {
      return translationStatusOf(language) === "done";
    });
    var meta = el("hbtResultsMeta");
    if (meta) meta.textContent = doneLanguages.length + " of " + DB.languages.length + " languages translated";
    if (!doneLanguages.length) {
      container.innerHTML = '<div class="hbt-results-empty">No translations yet. Start the translation run above - each finished language appears here with a preview and download.</div>';
      return;
    }
    container.innerHTML = doneLanguages.map(resultCardHtml).join("");
    var frames = container.querySelectorAll(".hbt-preview-frame");
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      var language = frame.getAttribute("data-lang");
      var translation = DB.translations[language];
      if (translation && translation.html) frame.srcdoc = translation.html;
    }
  }

  function renderRunControls() {
    var startButton = el("hbtBtnStart");
    var cancelButton = el("hbtBtnCancel");
    var retryButton = el("hbtBtnRetry");
    var resetButton = el("hbtBtnReset");
    var totalLanguages = DB.languages.length;
    var doneCount = countLanguagesByStatus("done");
    var failedCount = countLanguagesByStatus("failed");
    var finishedCount = doneCount + failedCount;
    if (startButton) {
      startButton.disabled = _running || !canWrite() || !DB.languages.length || !DB.source.html.trim();
    }
    if (cancelButton) cancelButton.disabled = !_running;
    if (retryButton) retryButton.disabled = _running || failedCount === 0;
    if (resetButton) resetButton.disabled = _running || finishedCount === 0;
    var progressFill = el("hbtProgressFill");
    if (progressFill) {
      progressFill.style.width = totalLanguages ? Math.round(finishedCount * 100 / totalLanguages) + "%" : "0%";
    }
    var runStatus = el("hbtRunStatus");
    if (runStatus && !_running) {
      runStatus.textContent = totalLanguages
        ? doneCount + " of " + totalLanguages + " languages done" + (failedCount ? " - " + failedCount + " failed" : "")
        : "";
    }
    if (_running) updateRunStatus(_runStatusText);
  }

  /* ============================================================
     Language list editing
     ============================================================ */
  function addLanguage(rawLanguage) {
    var language = String(rawLanguage || "").trim();
    if (!language) return;
    var duplicate = DB.languages.some(function (existing) {
      return existing.toLowerCase() === language.toLowerCase();
    });
    if (duplicate) { notify(language + " is already in the list", "info"); return; }
    DB.languages.push(language);
    if (!DB.translations[language]) {
      DB.translations[language] = { status: "pending", html: "", error: "", updatedAt: "", missingCount: 0 };
    }
    persistLater(200);
    renderLanguagesPanel();
    renderTranslationList();
    renderResultsPanel();
    renderRunControls();
    resizeTool();
  }

  function removeLanguage(language) {
    DB.languages = DB.languages.filter(function (existing) { return existing !== language; });
    delete DB.translations[language];
    persistLater(200);
    renderLanguagesPanel();
    renderTranslationList();
    renderResultsPanel();
    renderRunControls();
    resizeTool();
  }

  function addLanguageFromInput() {
    var input = el("hbtLangInput");
    if (!input) return;
    addLanguage(input.value);
    input.value = "";
    input.focus();
  }

  /* ============================================================
     Source document actions
     ============================================================ */
  function loadSourceFromFile() {
    if (typeof tool.requestUpload !== "function") {
      notify("File upload is not enabled for this tool (allowUpload must be yes) - paste the HTML instead", "warning");
      return;
    }
    tool.requestUpload(".html,.htm", function (uploadError, file) {
      if (uploadError || !file) { notify("Upload failed: " + (uploadError || "no file"), "warning"); return; }
      if (typeof tool.requestFileContent !== "function") {
        notify("File text extraction is not enabled for this tool (allowFileContent must be yes) - paste the HTML instead", "warning");
        return;
      }
      tool.requestFileContent(file.url, function (contentError, content) {
        if (contentError || content == null) {
          notify("Could not read the file content: " + (contentError || "empty"), "warning");
          return;
        }
        DB.source.html = String(content);
        DB.source.fileName = file.name || "";
        DB.source.updatedAt = nowISO();
        _extraction = null;
        persistLater(300);
        renderSourcePanel();
        renderRunControls();
        resizeTool();
        notify("Loaded " + (file.name || "file") + " - " + formatBytes(DB.source.html.length), "success");
      });
    });
  }

  function loadSampleDocument() {
    DB.source.html = HBT_SAMPLE_DOCUMENT_HTML;
    DB.source.fileName = "sample-page.html";
    DB.source.updatedAt = nowISO();
    _extraction = null;
    persistLater(200);
    renderSourcePanel();
    renderRunControls();
    resizeTool();
    notify("Sample document loaded", "info");
  }

  function clearSourceDocument() {
    DB.source.html = "";
    DB.source.fileName = "";
    DB.source.updatedAt = nowISO();
    _extraction = null;
    persistLater(200);
    renderSourcePanel();
    renderRunControls();
    resizeTool();
    notify("Source document cleared", "info");
  }

  function runExtraction() {
    if (!DB.source.html.trim()) { notify("No HTML to extract from", "warning"); return; }
    _extraction = extractSegmentsFromHtml(DB.source.html);
    renderExtractionInfo();
    if (!_extraction.segments.length) {
      notify("No translatable text found in the document", "warning");
    } else {
      notify("Found " + _extraction.segments.length + " unique texts", "success");
    }
  }

  /* ============================================================
     Results actions
     ============================================================ */
  function buildTranslatedFileName(language) {
    var baseName = DB.source.fileName || "translated-document";
    baseName = baseName.replace(/\.html?$/i, "");
    return slugifyText(baseName) + "-" + slugifyText(language) + ".html";
  }

  function downloadTextFile(fileName, content, mimeType) {
    try {
      var blob = new Blob([content], { type: mimeType || "text/html" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    } catch (e) {
      notify("Download failed: " + e.message, "error");
    }
  }

  function downloadResult(language) {
    var translation = DB.translations[language];
    if (!translation || translation.status !== "done") return;
    downloadTextFile(buildTranslatedFileName(language), translation.html, "text/html");
  }

  function downloadAllZip() {
    var doneLanguages = DB.languages.filter(function (language) {
      return translationStatusOf(language) === "done";
    });
    if (!doneLanguages.length) { notify("No finished translations to download", "warning"); return; }
    if (typeof window.JSZip === "function") {
      var zip = new window.JSZip();
      doneLanguages.forEach(function (language) {
        var translation = DB.translations[language];
        zip.file(buildTranslatedFileName(language), translation.html);
      });
      var zipBaseName = slugifyText(DB.source.fileName || "translated-document");
      zip.generateAsync({ type: "blob" }).then(function (blob) {
        try {
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = zipBaseName + "-translations.zip";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        } catch (e) {
          downloadAllSequential(doneLanguages);
        }
      }).catch(function () { downloadAllSequential(doneLanguages); });
      return;
    }
    downloadAllSequential(doneLanguages);
  }

  function downloadAllSequential(doneLanguages) {
    var index = 0;
    function downloadNext() {
      if (index >= doneLanguages.length) return;
      var language = doneLanguages[index++];
      var translation = DB.translations[language];
      downloadTextFile(buildTranslatedFileName(language), translation.html, "text/html");
      setTimeout(downloadNext, 450);
    }
    downloadNext();
  }

  function copyTextToClipboard(text, description) {
    var success = function () { notify((description || "Content") + " copied to clipboard", "success"); };
    try {
      var helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      var copied = document.execCommand("copy");
      document.body.removeChild(helper);
      if (copied) { success(); return; }
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(success, function () { openCopyModal(text); });
    } else {
      openCopyModal(text);
    }
  }

  function openCopyModal(text) {
    var overlay = el("hbtCopyOverlay");
    var textarea = el("hbtCopyText");
    if (!overlay || !textarea) return;
    textarea.value = text;
    overlay.style.display = "flex";
    textarea.focus();
    textarea.select();
  }

  function closeCopyModal() {
    var overlay = el("hbtCopyOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function scrollToResult(language) {
    var resultsContainer = el("hbtResults");
    if (!resultsContainer) return;
    var cards = resultsContainer.querySelectorAll(".hbt-result");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-lang") !== language) continue;
      var details = cards[i].querySelector("details");
      if (details) details.open = true;
      cards[i].scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }

  function confirmResetTranslations() {
    var resetButton = el("hbtBtnReset");
    if (!_resetArmed) {
      _resetArmed = true;
      if (resetButton) resetButton.textContent = "Confirm reset?";
      if (_resetArmTimer) clearTimeout(_resetArmTimer);
      _resetArmTimer = setTimeout(function () {
        _resetArmed = false;
        if (resetButton) resetButton.textContent = "Reset results";
      }, 3000);
      return;
    }
    _resetArmed = false;
    if (_resetArmTimer) clearTimeout(_resetArmTimer);
    if (resetButton) resetButton.textContent = "Reset results";
    DB.translations = {};
    DB.languages.forEach(function (language) {
      DB.translations[language] = { status: "pending", html: "", error: "", updatedAt: "", missingCount: 0 };
    });
    persistNow();
    renderAll();
    notify("All translation results were removed", "info");
  }

  /* ============================================================
     Declarations + events
     ============================================================ */
  function declareDeclarations() {
    try {
      if (typeof tool.declareParams === "function") {
        tool.declareParams([
          { name: "allowAi", label: "Allow AI Service", type: "toggle", default: "yes", severity: "mandatory",
            hint: "Must be yes so this tool can call the CMS AI service for translations." },
          { name: "allowUpload", label: "Allow File Upload", type: "toggle", default: "yes", severity: "goodToHave",
            hint: "Enables the Load .html file button (host file picker)." },
          { name: "allowFileContent", label: "Allow File Text Extraction", type: "toggle", default: "yes", severity: "goodToHave",
            hint: "Enables reading the text of an uploaded .html file." },
          { name: "allowRequestSave", label: "Allow Auto Save Requests", type: "toggle", default: "yes", severity: "goodToHave",
            hint: "Lets the tool commit each completed language immediately instead of waiting for the parent Save button." },
          { name: "defaultLanguages", label: "Default Languages", type: "text",
            default: "French, German, Spanish, Turkish", severity: "goodToHave",
            hint: "Comma-separated languages seeded the first time this tool is used." },
          { name: "translationInstructions", label: "Translation Instructions", type: "text", default: "", severity: "optional",
            hint: "Extra rules for the AI translator, e.g. tone, formality, terminology." },
          { name: "protectedTerms", label: "Protected Terms", type: "text", default: "", severity: "optional",
            hint: "Comma-separated words that must never be translated (brand names, product names)." },
          { name: "deduplicateTexts", label: "Deduplicate Repeated Texts", type: "toggle", default: "yes", severity: "optional",
            hint: "When yes, each repeated text is translated once and reused everywhere (cheaper). When no, every occurrence is translated separately with its own context." }
        ]);
      }
      if (typeof tool.declareOutput === "function") {
        tool.declareOutput({
          type: "object",
          properties: {
            version: { type: "number" },
            source: {
              type: "object",
              properties: {
                html: { type: "string" },
                fileName: { type: "string" },
                updatedAt: { type: "string" }
              }
            },
            languages: { type: "array", items: { type: "string" } },
            translations: { type: "object" },
            flags: { type: "object" },
            updatedAt: { type: "string" }
          }
        });
      }
    } catch (e) {}
  }

  function reportRequiredParams() {
    try {
      if (typeof tool.reportMissingParams !== "function") return;
      var allowAiSetting = tool.param("allowAi", "");
      if (allowAiSetting !== "yes") {
        tool.reportMissingParams([{
          name: "allowAi",
          label: "Allow AI Service",
          type: "toggle",
          default: "yes",
          hint: "Must be yes so this tool can call the CMS AI service for translations.",
          reason: "Translations are produced by the CMS AI service and cannot run without it.",
          severity: "mandatory"
        }], "This tool needs the AI service enabled before it can translate documents.");
      }
    } catch (e) {}
  }

  function seedDefaultLanguagesIfNeeded() {
    if (DB.languages.length) return;
    if (DB.flags.languagesSeeded) return;
    var defaultLanguages = tool.param("defaultLanguages", "French, German, Spanish, Turkish");
    var seededAny = false;
    String(defaultLanguages).split(",").forEach(function (part) {
      var language = part.trim();
      if (language) { DB.languages.push(language); seededAny = true; }
    });
    DB.flags.languagesSeeded = true;
    if (seededAny) {
      DB.languages.forEach(function (language) {
        if (!DB.translations[language]) {
          DB.translations[language] = { status: "pending", html: "", error: "", updatedAt: "", missingCount: 0 };
        }
      });
      persistLater(0);
    }
  }

  function bindEvents() {
    function wire(buttonId, eventName, handler) {
      var node = el(buttonId);
      if (node && node.addEventListener) node.addEventListener(eventName, handler);
    }
    wire("hbtBtnLoadFile", "click", loadSourceFromFile);
    wire("hbtBtnSample", "click", loadSampleDocument);
    wire("hbtBtnClearSource", "click", clearSourceDocument);
    wire("hbtBtnExtract", "click", runExtraction);
    wire("hbtBtnStart", "click", function () {
      startTranslationQueue(DB.languages.filter(function (language) {
        return translationStatusOf(language) !== "done";
      }));
    });
    wire("hbtBtnRetry", "click", function () {
      startTranslationQueue(DB.languages.filter(function (language) {
        return translationStatusOf(language) === "failed";
      }));
    });
    wire("hbtBtnReset", "click", confirmResetTranslations);
    wire("hbtBtnCancel", "click", function () {
      if (_running) {
        _cancelRequested = true;
        updateRunStatus("Cancelling after the current step...");
      }
    });
    wire("hbtBtnAddLang", "click", addLanguageFromInput);
    wire("hbtLangInput", "keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addLanguageFromInput();
      }
    });
    wire("hbtSourceInput", "input", function () {
      var textarea = el("hbtSourceInput");
      DB.source.html = textarea ? textarea.value : "";
      DB.source.updatedAt = nowISO();
      _extraction = null;
      renderExtractionInfo();
      renderSizeEstimate();
      renderRunControls();
      persistLater(1200);
    });
    wire("hbtBtnDownloadAll", "click", downloadAllZip);
    wire("hbtCopyClose", "click", closeCopyModal);
    wire("hbtCopyDone", "click", closeCopyModal);

    document.addEventListener("click", function (event) {
      var target = event.target;
      var actionNode = target && target.closest ? target.closest("[data-act]") : null;
      if (!actionNode) return;
      var action = actionNode.getAttribute("data-act");
      var language = actionNode.getAttribute("data-language") || "";
      if (!canWrite() && (action === "remove-language" || action === "toggle-quick-language" ||
          action === "retry-language")) return;
      if (action === "toggle-quick-language") {
        var active = DB.languages.some(function (existing) {
          return existing.toLowerCase() === language.toLowerCase();
        });
        if (active) removeLanguage(language); else addLanguage(language);
      } else if (action === "remove-language") {
        removeLanguage(language);
      } else if (action === "retry-language") {
        startTranslationQueue([language]);
      } else if (action === "view-result") {
        scrollToResult(language);
      } else if (action === "copy-result") {
        var copyTranslation = DB.translations[language];
        if (copyTranslation && copyTranslation.html) {
          copyTextToClipboard(copyTranslation.html, "HTML for " + language);
        }
      } else if (action === "download-result") {
        downloadResult(language);
      }
    });

    var copyOverlay = el("hbtCopyOverlay");
    if (copyOverlay) {
      copyOverlay.addEventListener("click", function (event) {
        if (event.target === copyOverlay) closeCopyModal();
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeCopyModal();
    });
  }

  function onValueFromOutside(incomingValue) {
    var incomingJson = JSON.stringify(incomingValue);
    if (incomingJson === _lastStagedJson) return; // echo of our own staging
    if (_running) {
      _cancelRequested = true;
      notify("The saved value was changed from outside - the translation run was stopped", "warning");
    }
    DB = normalizeDatabase(incomingValue);
    _extraction = null;
    renderAll();
  }

  /* ============================================================
     Entry point
     ============================================================ */
  tool.onReady(function (initialValue) {
    declareDeclarations();
    reportRequiredParams();
    DB = normalizeDatabase(initialValue);
    _readOnly = typeof tool.isReadOnly === "function" ? !!tool.isReadOnly() : false;
    seedDefaultLanguagesIfNeeded();
    bindEvents();
    renderAll();
    initIdentity();
    if (typeof tool.onValueChange === "function") tool.onValueChange(onValueFromOutside);
    if (typeof tool.onReadonlyChange === "function") {
      tool.onReadonlyChange(function (readOnlyFlag) {
        _readOnly = !!readOnlyFlag;
        applyReadOnlyState();
      });
    }
    if (typeof tool.reportValid === "function") tool.reportValid(true, "");
  });
})();
