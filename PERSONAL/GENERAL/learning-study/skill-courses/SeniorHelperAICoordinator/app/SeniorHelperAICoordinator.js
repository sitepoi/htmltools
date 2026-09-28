/* Senior Helper AI Coordinator - the post-course AI companion for older adults.
   Chat with AI + guided question builders for everyday tasks, with safety rules always visible. */

(function () {
  "use strict";

  var CHAT_SESSION_TYPE = "ai-chat-sessions-uniconbaseapps";
  var INSTANCE_PREFIX = "seniorhelper_";
  var VALUE_VERSION = 1;
  var TEXT_SCALES = ["normal", "large", "extra"];

  var QUICK_START_PROMPTS = [
    { label: "Write a thank-you note", categoryKey: "free-question", prompt: "Please help me write a thank-you note. Ask me one short question at a time until you know who it is for and what they did, then write the note." },
    { label: "Plan tonight's dinner", categoryKey: "free-question", prompt: "Please help me plan tonight's dinner. Ask me one question at a time about what I like and what I have at home, then suggest one simple dinner and a short shopping list." },
    { label: "Explain a paper for me", categoryKey: "free-question", prompt: "Please help me understand a difficult letter. Ask me to paste or describe the letter, then explain it in plain words and tell me what I need to do." },
    { label: "A message for my grandson", categoryKey: "free-question", prompt: "Please help me write a warm message for my grandson. Ask me one question at a time about the occasion and what he loves, then write a short, cheerful message." },
    { label: "Check a message for scams", categoryKey: "safety-check", prompt: "SCAM ANALYSIS TASK. Please help me check whether a message or call is a scam. Ask me to paste the message or describe the call, then say clearly whether it looks like a scam and exactly what to do." },
    { label: "Check a health claim", categoryKey: "pharmacy-help", prompt: "HEALTH CLAIM CHECK TASK. Please help me check a health claim I heard. Ask me to tell you the claim, then say how likely it is to be true or false, what reliable official sources say, and how I can verify it." },
    { label: "Something I find difficult", categoryKey: "free-question", prompt: "I want to make one thing in my life easier with your help. Ask me one question at a time about what I find difficult, then suggest two practical ways AI can help me with it this week." },
    { label: "Prepare for my doctor visit", categoryKey: "doctor-visit", prompt: "I am visiting my doctor soon. Help me prepare: ask me one question at a time about how I feel and what worries me, then give me five clear questions to ask during the visit." },
    { label: "Start my life story", categoryKey: "free-question", prompt: "I want to start writing my life story. Interview me one question at a time, starting with my childhood home. After each answer, ask the next question." }
  ];

  var SENIOR_SYSTEM_PROMPT =
    "You are a patient, kind AI helper for an older adult who is learning to use AI. " +
    "Rules you must follow: use plain everyday words; keep sentences short; " +
    "put each idea in its own short paragraph; explain any uncommon word the first time you use it; " +
    "be warm and encouraging; never ask for personal details such as passwords, card numbers, or ID numbers; " +
    "for health, money, or legal matters give ideas and questions to ask a professional, " +
    "but never decisions, diagnoses, or guarantees, and gently remind the person to check with their doctor, bank, or family; " +
    "if anything sounds like a scam, say so clearly. " +
    "For food questions, explain ingredients and common effects in plain words and help check for allergens, " +
    "and remind the person that halal status is confirmed by an official certification label, not by you. " +
    "For medicines, explain labels and prepare questions for the pharmacist, but never change doses or make medical decisions. " +
    "When someone shares a health claim, say how reliable it seems, point to official sources such as MedlinePlus or WHO, " +
    "and warn about miracle-cure and secret-formula language. " +
    "If the person writes in another language or asks for a translation, answer in their language when asked and keep the same plain, warm style. " +
    "For doctor visits, help prepare question lists and plain summaries, but never give medical decisions. " +
    "Answer in plain text, no tables unless asked, no jargon.";

  var CATEGORY_DEFINITIONS = [
    {
      categoryKey: "free-question",
      title: "My own question",
      hint: "Ask anything, in your own words. You do not need to fill anything in - just type your question in the box below.",
      fields: []
    },
    {
      categoryKey: "write-letter",
      title: "Write a letter or email",
      hint: "Tap your answers - the helper writes the letter for you.",
      fields: [
        { fieldKey: "recipient", label: "Who is it for?", kind: "chips", options: ["my landlord", "my doctor's office", "the internet company", "my bank or insurance", "a government office", "a family member", "a friend", "another office"] },
        { fieldKey: "topic", label: "What is it about?", kind: "chips", options: ["a repair", "a refund", "a thank-you", "an appointment", "a complaint", "an invitation"] },
        { fieldKey: "length", label: "How long?", kind: "chips", options: ["short", "medium"] }
      ],
      buildPrompt: function (values) {
        return "Please write a " + values.length + ", polite letter to " + values.recipient + " about " + values.topic + ". " +
          "Keep it warm and clear, and leave placeholders for my name and the date.";
      }
    },
    {
      categoryKey: "explain-text",
      title: "Explain a letter or paper",
      hint: "Paste the letter, or speak it - no typing needed.",
      fields: [
        { fieldKey: "source", label: "Where is it from?", kind: "chips", options: ["my bank or insurance", "a doctor or health service", "the government", "another office"] },
        { fieldKey: "pastedText", label: "The letter itself", kind: "textarea", wide: true, required: true, placeholder: "Paste the letter here, or tap Paste / Speak...", examples: [{ label: "Try an example letter", text: "Dear customer, your account review is due before the end of the month. Please contact us with your reference number to confirm your details." }] }
      ],
      buildPrompt: function (values) {
        return "Please explain this letter in plain words, like you are talking to a friend who is not a lawyer. " +
          "It came from " + values.source + ". Then tell me, step by step, what I need to DO and any deadlines I must not miss:\n\n" +
          values.pastedText;
      }
    },
    {
      categoryKey: "plan-week",
      title: "Plan my week and meals",
      hint: "Five simple dinners plus one shopping list.",
      fields: [
        { fieldKey: "people", label: "For how many people?", kind: "chips", options: ["one person", "two people"] },
        { fieldKey: "foodRules", label: "Any food rules?", kind: "chips", options: ["no rules", "low salt", "low sugar", "soft food", "no fish", "vegetarian", "halal"] }
      ],
      buildPrompt: function (values) {
        var rulesPart = values.foodRules === "no rules" ? "" : " The meals should fit these food rules: " + values.foodRules + ".";
        return "Plan five simple dinners this week for " + values.people + "." + rulesPart +
          " Each dinner should use common ingredients and be easy to prepare. " +
          "Then give me one shopping list for all five dinners.";
      }
    },
    {
      categoryKey: "health-helper",
      title: "Health helper",
      hint: "Ideas only - your doctor and pharmacist make the decisions.",
      fields: [
        { fieldKey: "helpKind", label: "What kind of help?", kind: "chips", options: ["meal ideas", "a gentle seated exercise", "a medication schedule", "explain a health term"] },
        { fieldKey: "detail", label: "Details (optional)", placeholder: "Low salt, the medicine name, or the health term...", kind: "text" }
      ],
      buildPrompt: function (values) {
        if (values.helpKind === "meal ideas") {
          return "Give me five simple meal ideas" + (values.detail ? " that fit these limits: " + values.detail : "") + ". Each with fewer than eight ingredients. " +
            "Do not give medical advice - I will check with my doctor or dietitian.";
        }
        if (values.helpKind === "a gentle seated exercise") {
          return "Create a gentle 15-minute seated exercise routine for a beginner, using only a chair." +
            (values.detail ? " Details: " + values.detail + "." : "") +
            " List each exercise with simple instructions and timing. Add a note that I should check with my doctor before starting.";
        }
        if (values.helpKind === "a medication schedule") {
          return "Make a large, easy-to-read daily medication schedule table with columns for morning, noon, evening, and night. " +
            "I will fill in my medicines and doses from my labels." + (values.detail ? " Details: " + values.detail + "." : "") +
            " Add a note that a pharmacist should check the final table.";
        }
        if (values.detail) {
          return "Explain what " + values.detail + " means in plain words, and list five good questions I should ask my doctor about it. Do not diagnose anything.";
        }
        return "I want to understand a health term. Ask me which term, then explain it in plain words and list five questions I should ask my doctor. Do not diagnose anything.";
      }
    },
    {
      categoryKey: "food-ingredients",
      title: "Food and ingredients",
      hint: "Tap your check, then paste or speak the ingredients. The label stays the final word.",
      fields: [
        { fieldKey: "checkKind", label: "What do you want to check?", kind: "chips", options: ["an allergy check", "a halal check", "a vegetarian or vegan check", "another diet check", "explain these ingredients", "the effects of a food"] },
        { fieldKey: "allergen", label: "My main allergen", kind: "chips", options: ["peanuts", "tree nuts", "milk", "eggs", "gluten", "fish", "shellfish", "soy", "sesame"], visibleWhen: { fieldKey: "checkKind", contains: "allergy" } },
        { fieldKey: "detail", label: "The ingredients (or your diet rules)", kind: "textarea", wide: true, required: true, placeholder: "Paste the ingredient list, or tap Paste / Speak...", examples: [{ label: "Try an example list", text: "Wheat flour, sugar, vegetable oil, milk powder, eggs, salt, peanuts, flavorings" }] }
      ],
      buildPrompt: function (values) {
        if (values.checkKind.indexOf("allergy") === 0) {
          return "I am checking food for allergies. My main allergen: " + values.allergen + ". Please check this ingredient list and point out anything I should worry about, with a plain explanation for each:\n\n" +
            values.detail + "\n\nRemind me to double-check with the food maker and my doctor.";
        }
        if (values.checkKind.indexOf("halal") === 0) {
          return "I would like to check whether a food is halal. The food or ingredient list: " + values.detail + ". " +
            "Please explain which ingredients may come from animal sources or alcohol and what questions to ask the maker. " +
            "Remind me that an official halal certification label is the most reliable check.";
        }
        if (values.checkKind.indexOf("vegetarian") === 0) {
          return "Please check this food for a vegetarian or vegan diet: " + values.detail + ". " +
            "Explain which ingredients may come from animals and what to ask the maker. " +
            "Remind me that the maker's label and my doctor can confirm.";
        }
        if (values.checkKind.indexOf("diet") === 0) {
          return "I follow this diet: " + values.detail + ". Please explain which common ingredients fit this diet and which do not, " +
            "and how to check a food label quickly. Remind me to confirm with the food maker and my doctor.";
        }
        if (values.checkKind.indexOf("explain") === 0) {
          return "Please explain this food ingredient list in plain words. For each item, say what it is and any common effects it may have:\n\n" + values.detail;
        }
        return "Please explain in plain words the common effects of " + values.detail + " on the body, and what is known versus what is myth. " +
          "Remind me that for my personal health, my doctor is the source of truth.";
      }
    },
    {
      categoryKey: "pharmacy-help",
      title: "Pharmacy and medicines",
      hint: "Tap your need. The pharmacist and doctor decide everything.",
      fields: [
        { fieldKey: "helpKind", label: "What kind of help?", kind: "chips", options: ["understand my medicine", "questions for my pharmacist", "check a health claim"] },
        { fieldKey: "detail", label: "Details (optional)", placeholder: "Medicine name, dose, or the claim you heard...", kind: "text" }
      ],
      buildPrompt: function (values) {
        if (values.helpKind === "understand my medicine") {
          if (values.detail) {
            return "Please help me understand my medicine in plain words. From my label: " + values.detail + ". " +
              "Explain what it is usually for, how it is commonly taken, and common side effects. " +
              "Then list five good questions to ask my pharmacist. Never change a dose - my pharmacist decides.";
          }
          return "I want to understand one of my medicines. Ask me for the medicine name and what the label says, " +
            "then explain it in plain words and list five questions I should ask my pharmacist. Never change a dose - my pharmacist decides.";
        }
        if (values.helpKind === "questions for my pharmacist") {
          return "Prepare clear questions for my pharmacist about my medicines." + (values.detail ? " Situation: " + values.detail + "." : " Ask me for the situation first.") +
            " Write the questions in plain, polite language, numbered.";
        }
        if (values.detail) {
          return "HEALTH CLAIM CHECK TASK. An older adult heard this health claim: " + values.detail + ". " +
            "Please say how likely it is to be true or false, what reliable official sources such as MedlinePlus or WHO say about it, " +
            "and how the person can verify it. Point out warning signs like miracle cures, secret formulas, and urgency. Never diagnose or prescribe.";
        }
        return "HEALTH CLAIM CHECK TASK. I heard a health claim I want to check. Ask me what it is, " +
          "then say how likely it is to be true or false, what reliable official sources say about it, and how I can verify it. Never diagnose or prescribe.";
      }
    },
    {
      categoryKey: "doctor-visit",
      title: "Doctor visit helper",
      hint: "Tap your answers - the doctor decides everything.",
      fields: [
        { fieldKey: "visitStage", label: "Before or after the visit?", kind: "chips", options: ["before the visit - help me prepare", "after the visit - summarize for me"] },
        { fieldKey: "doctorKind", label: "Which doctor?", kind: "chips", options: ["my family doctor", "my heart doctor", "my eye doctor", "my dentist", "another doctor"] },
        { fieldKey: "reason", label: "About what? (optional)", placeholder: "My blood pressure, a new medicine...", kind: "text" }
      ],
      buildPrompt: function (values) {
        var visitTarget = values.doctorKind + (values.reason ? " about " + values.reason : "");
        if (values.visitStage.indexOf("before") === 0) {
          return "I am visiting " + visitTarget + ". Help me prepare: first ask me one question at a time about how I feel and what worries me. " +
            "Then give me a short list of what to tell the doctor and five clear questions to ask during the visit.";
        }
        return "I just came from the doctor: " + visitTarget + ". I will describe what I remember in my own words, in any language. " +
          "Rewrite it as a clear summary in plain words, list what I need to DO next, and note any parts I should double-check with the clinic.";
      }
    },
    {
      categoryKey: "translate-help",
      title: "Translate",
      hint: "Tap what you need - paste or speak the text.",
      fields: [
        { fieldKey: "translateKind", label: "What do you want to translate?", kind: "chips", options: ["a letter or message", "useful phrases", "words for a doctor visit"] },
        { fieldKey: "language", label: "Which language?", kind: "chips", options: ["Turkish", "Arabic", "Spanish", "French", "Chinese", "Russian", "Ukrainian"] },
        { fieldKey: "detail", label: "The text (optional)", kind: "textarea", wide: true, placeholder: "Paste the text, or tap Paste / Speak...", examples: [{ label: "Try an example", text: "Thank you for your kind letter. We look forward to seeing you soon." }] }
      ],
      buildPrompt: function (values) {
        if (values.translateKind === "useful phrases") {
          return "Teach me 10 useful phrases in " + values.language + " for a family visit and video calls. " +
            "Write each phrase twice: in English and in " + values.language + ", with a simple pronunciation hint.";
        }
        if (values.translateKind === "words for a doctor visit") {
          var textPart = values.detail || "How are you feeling today? I would like to make an appointment. Please speak slowly.";
          return "Translate these words for a doctor visit into " + values.language + ": " + textPart + ". " +
            "Keep the sentences short and clear, because translation works best with short sentences.";
        }
        if (values.detail) {
          return "Translate this text into " + values.language + ", keeping the tone natural: " + values.detail + ". " +
            "Then show me how to translate a short reply back.";
        }
        return "I want to translate a letter into " + values.language + ". Ask me to paste or speak the letter, " +
          "then translate it keeping the tone natural, and show me how to translate a short reply back.";
      }
    },
    {
      categoryKey: "family-message",
      title: "Message for family",
      hint: "Tap your answers - the message appears.",
      fields: [
        { fieldKey: "person", label: "Who is it for?", kind: "chips", options: ["my grandson", "my granddaughter", "my son", "my daughter", "a friend", "another family member"] },
        { fieldKey: "occasion", label: "What is the occasion?", kind: "chips", options: ["a birthday", "a thank-you", "congratulations", "a get-well wish", "just to say hello"] },
        { fieldKey: "interests", label: "What do they love?", kind: "chips", options: ["dinosaurs", "football", "music", "animals", "books", "gardening", "video games", "surprise me"] }
      ],
      buildPrompt: function (values) {
        var interestsPart = values.interests === "surprise me" ? "" : " They love " + values.interests + ".";
        return "Write a warm message for " + values.occasion + " for " + values.person + "." + interestsPart +
          " About 60 words, cheerful, from me. Keep the sentences short.";
      }
    },
    {
      categoryKey: "hobby-project",
      title: "Hobbies and projects",
      hint: "Tap your hobby and what you need.",
      fields: [
        { fieldKey: "hobby", label: "My hobby or project", kind: "chips", options: ["gardening", "knitting or crochet", "chess", "cooking", "photography", "music", "writing", "another hobby"] },
        { fieldKey: "helpWanted", label: "What help do you want?", kind: "chips", options: ["new ideas to try", "a month-by-month plan", "fix a problem", "teach me the basics"] }
      ],
      buildPrompt: function (values) {
        return "My hobby or project: " + values.hobby + ". I would like help with: " + values.helpWanted + ". " +
          "Ask me a question if you need one more detail, then give me three specific things I could try, from easy to challenging. Plain words, please.";
      }
    },
    {
      categoryKey: "trip-plan",
      title: "Plan a trip",
      hint: "Tap your answers - a relaxed day-by-day plan appears.",
      fields: [
        { fieldKey: "days", label: "How many days?", kind: "chips", options: ["2 days", "3 days", "5 days"] },
        { fieldKey: "likes", label: "What do you like?", kind: "chips", options: ["museums and history", "nature and short walks", "food and markets", "shopping", "easy walking - no stairs", "a mix of everything"] },
        { fieldKey: "place", label: "Where to? (one short word is enough)", placeholder: "Chicago", kind: "text", required: true }
      ],
      buildPrompt: function (values) {
        return "Plan a relaxed " + values.days + " trip to " + values.place + " for me. I like " + values.likes + ". " +
          "One simple plan per day, with rest time, and a packing list at the end.";
      }
    },
    {
      categoryKey: "learn-new",
      title: "Learn something new",
      hint: "Tap a topic, or write your own.",
      fields: [
        { fieldKey: "topic", label: "What do you want to learn?", kind: "chips", options: ["a new language", "bird watching", "basic chess", "a cooking style", "calligraphy", "another topic"] },
        { fieldKey: "customTopic", label: "Or write your own (optional)", placeholder: "e.g. wood carving", kind: "text" }
      ],
      buildPrompt: function (values) {
        var topicName = values.topic === "another topic" ? (values.customTopic || "a new skill") : values.topic;
        return "I want to learn the basics of " + topicName + ". " +
          "Design me a gentle 4-week plan, 20 minutes a day, starting from zero, in plain words. " +
          "Each week should have one clear goal.";
      }
    },
    {
      categoryKey: "my-stories",
      title: "Write my stories",
      hint: "Tap what you want to write. Your life is the material.",
      fields: [
        { fieldKey: "storyKind", label: "What do you want to write?", kind: "chips", options: ["a memoir about my life", "a family memory", "a family recipe keepsake", "a children's story"] },
        { fieldKey: "startPoint", label: "Where do we start?", kind: "chips", options: ["my childhood", "my working years", "my wedding day", "moving to a new country", "my parents", "another memory"] }
      ],
      buildPrompt: function (values) {
        if (values.storyKind.indexOf("memoir") === 0) {
          return "I want to write a memoir. Start from " + values.startPoint + ". " +
            "Interview me one question at a time, starting with the very beginning. " +
            "After each answer, ask the next question. At the end, propose a chapter outline with a title for each chapter.";
        }
        if (values.storyKind.indexOf("family memory") === 0) {
          return "Help me turn a family memory into a short story. Start from " + values.startPoint + ". " +
            "Ask me a few questions one at a time, then write it warmly, about 300 words.";
        }
        if (values.storyKind.indexOf("recipe") === 0) {
          return "Help me write down a family recipe as a keepsake. " +
            "Ask me for the ingredients, the steps, and the story behind the dish, then write a beautiful recipe page with a story note.";
        }
        return "Write a children's story about " + values.startPoint + " for a young child. " +
          "About 200 words, gentle, happy ending, and suggest a title.";
      }
    },
    {
      categoryKey: "safety-check",
      title: "Check a suspicious message",
      hint: "Paste or speak the message - the helper checks it for scams.",
      fields: [
        { fieldKey: "pastedText", label: "The message or call", kind: "textarea", wide: true, required: true, placeholder: "Paste the suspicious message here, or tap Paste / Speak...", examples: [{ label: "Try an example scam", text: "FINAL NOTICE: Your account has been suspended. Call this number immediately and provide your card number to avoid fees." }] }
      ],
      buildPrompt: function (values) {
        return "SCAM ANALYSIS TASK. An older adult received this message or call. " +
          "Please say clearly whether it looks like a scam, why, and exactly what the person should do - and what not to do. " +
          "Remind them: never send money because of a call or message, never share passwords or card numbers, " +
          "hang up and call the real number themselves, and ask family when unsure.\n\n" +
          values.pastedText;
      }
    }
  ];

  var appElement = null;
  var savedValue = null;
  var currentCategoryKey = "free-question";
  var currentUser = null;
  var noIdentityMode = false;
  var readOnlyMode = false;
  var chatMessages = [];
  var chatSessionObjectId = "";
  var instanceId = "";
  var parentRecordId = "";
  var lastStagedJson = "";
  var chatStoreAvailable = true;
  var warnedChatStoreMissing = false;
  var persistTimer = null;
  var speakingNow = false;
  var listenMode = false;
  var textScaleIndex = 0;
  var askedForAiBefore = false;
  var recognitionInstance = null;
  var voiceListeningNow = false;
  var newChatArmed = false;
  var newChatArmTimer = null;
  var againPromptCache = [];
  var selectedChipValues = {};
  var lastFocusedFieldKey = "";

  function byId(id) { return document.getElementById(id); }

  /* ---------- small helpers ---------- */

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapePromptText(text) {
    return escapeHtml(text);
  }

  function formatAiAnswer(plainText) {
    var paragraphs = String(plainText || "").split(/\n{2,}/);
    var htmlParts = [];
    paragraphs.forEach(function (paragraph) {
      var trimmed = paragraph.replace(/\s+/g, " ").trim();
      if (trimmed) { htmlParts.push("<p>" + escapeHtml(trimmed) + "</p>"); }
    });
    return htmlParts.join("");
  }

  function displayNameOf(user) {
    if (!user) { return ""; }
    if (user.name) { return user.name; }
    if (user.email) { return user.email.split("@")[0]; }
    return "";
  }

  function firstNameOf(userName) {
    if (!userName) { return ""; }
    return userName.split(" ")[0];
  }

  function timestampLabel() {
    var now = new Date();
    var hours = String(now.getHours()).padStart(2, "0");
    var minutes = String(now.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function tryNotify(message, severity) {
    if (typeof tool.notify === "function") { tool.notify(message, severity); }
  }

  /* ---------- roles ---------- */

  function userRoles() {
    if (currentUser && currentUser.roles && currentUser.roles.length) { return currentUser.roles; }
    if (currentUser && currentUser.effectiveAccess) {
      var rolesFromAccess = [];
      if (currentUser.effectiveAccess.isManager) { rolesFromAccess.push("admin"); }
      else if (currentUser.effectiveAccess.isEditor) { rolesFromAccess.push("editor"); }
      else if (currentUser.effectiveAccess.isViewer) { rolesFromAccess.push("viewer"); }
      if (rolesFromAccess.length) { return rolesFromAccess; }
    }
    return [];
  }

  function canAskAi() {
    if (readOnlyMode) { return false; }
    if (noIdentityMode) { return true; }
    var roles = userRoles();
    return roles.indexOf("admin") !== -1 ||
      roles.indexOf("editor") !== -1 ||
      roles.indexOf("owner") !== -1 ||
      roles.indexOf("developer") !== -1 ||
      roles.indexOf("user-manager") !== -1;
  }

  function hasUserApi() {
    return typeof tool.getUser === "function";
  }

  function refreshUserWithFallback() {
    if (!hasUserApi()) { return; }
    try {
      var userNow = tool.getUser();
      if (userNow) { currentUser = userNow; }
    } catch (error) { /* ignore */ }
  }

  function startIdentityPolling() {
    if (typeof tool.getUser !== "function") {
      noIdentityMode = true;
      applyReadOnlyState();
      return;
    }
    var delays = [400, 1200, 2600, 5000];
    delays.forEach(function (delay) {
      setTimeout(function () {
        refreshUserWithFallback();
        if (!currentUser || !userRoles().length) { noIdentityMode = true; }
        applyReadOnlyState();
      }, delay);
    });
  }

  /* ---------- saved value ---------- */

  function normalizeSavedValue(value) {
    if (!value || typeof value !== "object") { value = {}; }
    if (!value.settings || typeof value.settings !== "object") { value.settings = {}; }
    value.version = VALUE_VERSION;
    if (!value.settings.textScale) { value.settings.textScale = "normal"; }
    if (typeof value.settings.listenMode !== "boolean") { value.settings.listenMode = false; }
    if (typeof value.settings.showSafetyRules !== "boolean") { value.settings.showSafetyRules = true; }
    if (!Array.isArray(value.notes)) { value.notes = []; }
    if (!value._instanceId) { value._instanceId = instanceId || (INSTANCE_PREFIX + "local"); }
    if (!value._parentRecordId) { value._parentRecordId = parentRecordId; }
    if (!value._sessionObjectId) { value._sessionObjectId = ""; }
    return value;
  }

  function persistSavedValue() {
    var snapshotJson = JSON.stringify(savedValue);
    if (snapshotJson === lastStagedJson) { return; }
    lastStagedJson = snapshotJson;
    if (typeof tool.setValue === "function") { tool.setValue(JSON.parse(snapshotJson)); }
  }

  /* ---------- chat session persistence ---------- */

  function parentRecordIdFromUrl() {
    if (typeof tool.getParentPageUrl !== "function") { return ""; }
    var pageUrl = tool.getParentPageUrl() || "";
    var cutIndex = Math.max(pageUrl.indexOf("?"), pageUrl.indexOf("#"));
    if (cutIndex >= 0) { pageUrl = pageUrl.slice(0, cutIndex); }
    var parts = pageUrl.split("/").filter(function (part) { return part.length > 0; });
    return parts.length ? parts[parts.length - 1] : "";
  }

  function buildSessionData() {
    return {
      _toolInstanceId: instanceId,
      messages: chatMessages
    };
  }

  function createChatSessionObject() {
    if (!chatStoreAvailable) { return; }
    tool.requestObjects("create", {
      mainObjectType: CHAT_SESSION_TYPE,
      name: "Senior Helper Chat",
      productData: { data_categoriesBased: buildSessionData() }
    }, function (error, result) {
      if (error || !result || !result.object) {
        chatStoreAvailable = false;
        warnChatStoreUnavailableOnce();
        return;
      }
      chatSessionObjectId = result.object.id;
      savedValue._sessionObjectId = chatSessionObjectId;
      persistSavedValue();
    });
  }

  function loadChatSessionObject() {
    if (typeof tool.requestObjects !== "function") {
      chatStoreAvailable = false;
      warnChatStoreUnavailableOnce();
      return;
    }
    tool.requestObjects("query", { mainObjectType: CHAT_SESSION_TYPE }, function (error, result) {
      if (error) {
        chatStoreAvailable = false;
        warnChatStoreUnavailableOnce();
        return;
      }
      var objects = (result && result.objects) || [];
      var matchingSession = null;
      for (var i = 0; i < objects.length; i++) {
        var objectData = objects[i];
        var dataFields = (objectData.productData && objectData.productData.data_categoriesBased) || {};
        if (dataFields._toolInstanceId === instanceId) {
          matchingSession = objectData;
          break;
        }
      }
      if (!matchingSession) {
        createChatSessionObject();
        return;
      }
      chatSessionObjectId = matchingSession.id;
      savedValue._sessionObjectId = chatSessionObjectId;
      persistSavedValue();
      var storedMessages = matchingSession.productData.data_categoriesBased.messages;
      if (Array.isArray(storedMessages)) { chatMessages = storedMessages; }
      renderChatMessages();
    });
  }

  function warnChatStoreUnavailableOnce() {
    if (warnedChatStoreMissing) { return; }
    warnedChatStoreMissing = true;
    tryNotify("Chat history will not be saved for this record", "warning");
  }

  function persistChatSessionSoon() {
    if (!chatStoreAvailable || !chatSessionObjectId || typeof tool.requestObjects !== "function") { return; }
    if (persistTimer) { clearTimeout(persistTimer); }
    persistTimer = setTimeout(function () {
      tool.requestObjects("update", {
        mainObjectType: CHAT_SESSION_TYPE,
        objectId: chatSessionObjectId,
        productData: { data_categoriesBased: { messages: chatMessages } }
      }, function (error) {
        if (error) { chatStoreAvailable = false; }
      });
    }, 800);
  }

  /* ---------- text scale ---------- */

  function applyTextScale() {
    appElement.classList.remove("shc-scale-large", "shc-scale-extra");
    var scale = savedValue.settings.textScale;
    if (scale === "large") { appElement.classList.add("shc-scale-large"); }
    if (scale === "extra") { appElement.classList.add("shc-scale-extra"); }
    textScaleIndex = Math.max(0, TEXT_SCALES.indexOf(scale));
  }

  function cycleTextScale(direction) {
    var newIndex = textScaleIndex + direction;
    if (newIndex < 0) { newIndex = 0; }
    if (newIndex > TEXT_SCALES.length - 1) { newIndex = TEXT_SCALES.length - 1; }
    textScaleIndex = newIndex;
    savedValue.settings.textScale = TEXT_SCALES[newIndex];
    applyTextScale();
    persistSavedValue();
  }

  /* ---------- listen mode ---------- */

  function speechAvailable() {
    return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  function stopSpeaking() {
    if (!speechAvailable()) { return; }
    window.speechSynthesis.cancel();
    speakingNow = false;
  }

  function speakAnswerText(text) {
    if (!speechAvailable()) { return; }
    stopSpeaking();
    var utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    speakingNow = true;
    utterance.onend = function () { speakingNow = false; };
    window.speechSynthesis.speak(utterance);
  }

  function updateListenButtonLabel() {
    var listenButton = byId("shc-listen-toggle");
    if (!listenButton) { return; }
    if (!speechAvailable()) {
      listenButton.style.display = "none";
      return;
    }
    listenButton.textContent = "Listen: " + (listenMode ? "on" : "off");
    listenButton.classList.toggle("shc-toolbtn-active", listenMode);
  }

  /* ---------- copy ---------- */

  function openCopyModal(text) {
    byId("shc-copy-modal-text").value = text;
    byId("shc-copy-modal-overlay").classList.add("shc-modal-open");
  }

  function closeCopyModal() {
    byId("shc-copy-modal-overlay").classList.remove("shc-modal-open");
  }

  function copyTextToClipboard(text, successMessage) {
    function fallbackToModal() {
      openCopyModal(text);
    }
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        tryNotify(successMessage, "success");
      }, fallbackToModal);
    } else {
      fallbackToModal();
    }
  }

  /* ---------- category forms ---------- */

  function categoryDefinitionOf(categoryKey) {
    for (var i = 0; i < CATEGORY_DEFINITIONS.length; i++) {
      if (CATEGORY_DEFINITIONS[i].categoryKey === categoryKey) { return CATEGORY_DEFINITIONS[i]; }
    }
    return null;
  }

  function buildFieldHtml(field) {
    var wideClass = field.wide ? " shc-field-wide" : "";
    if (field.kind === "chips") {
      var chipButtons = (field.options || []).map(function (option) {
        return '<button type="button" class="shc-chip-btn" data-field-key="' + escapeHtml(field.fieldKey) + '" data-chip-value="' + escapeHtml(option) + '">' + escapeHtml(option) + "</button>";
      }).join("");
      return '<div class="shc-field' + wideClass + '">' +
        "<label>" + escapeHtml(field.label) + "</label>" +
        '<div class="shc-chip-row" data-chip-group="' + escapeHtml(field.fieldKey) + '">' + chipButtons + "</div>" +
        "</div>";
    }
    if (field.kind === "textarea") {
      var exampleChips = field.examples && field.examples.length ?
        '<div class="shc-example-row">' + field.examples.map(function (example) {
          return '<button type="button" class="shc-example-btn" data-example-for="' + escapeHtml(field.fieldKey) + '" data-example-text="' + escapeHtml(example.text) + '">' + escapeHtml(example.label) + "</button>";
        }).join("") + "</div>" : "";
      return '<div class="shc-field' + wideClass + '">' +
        "<label>" + escapeHtml(field.label) + "</label>" +
        '<div class="shc-input-actions">' +
        '<textarea rows="3" data-field-key="' + escapeHtml(field.fieldKey) + '" placeholder="' + escapeHtml(field.placeholder || "") + '"></textarea>' +
        '<button type="button" class="shc-paste-btn" data-paste-for="' + escapeHtml(field.fieldKey) + '">Paste</button>' +
        "</div>" + exampleChips +
        "</div>";
    }
    return '<div class="shc-field' + wideClass + '">' +
      "<label>" + escapeHtml(field.label) + "</label>" +
      '<input type="text" data-field-key="' + escapeHtml(field.fieldKey) + '" placeholder="' + escapeHtml(field.placeholder || "") + '" />' +
      "</div>";
  }

  function chipValueOf(categoryKey, fieldKey) {
    return (selectedChipValues[categoryKey] || {})[fieldKey] || "";
  }

  function setChipValue(categoryKey, fieldKey, chipValue) {
    if (!selectedChipValues[categoryKey]) { selectedChipValues[categoryKey] = {}; }
    selectedChipValues[categoryKey][fieldKey] = chipValue;
  }

  function fieldIsVisible(field, values) {
    if (!field.visibleWhen) { return true; }
    var referenceValue = values[field.visibleWhen.fieldKey] || "";
    return referenceValue.indexOf(field.visibleWhen.contains) !== -1;
  }

  function collectCategoryFieldValues(categoryKey) {
    var definition = categoryDefinitionOf(categoryKey);
    var values = {};
    definition.fields.forEach(function (field) {
      if (field.kind === "chips") {
        values[field.fieldKey] = chipValueOf(categoryKey, field.fieldKey);
      } else {
        var inputElement = byId("shc-form-panel").querySelector('[data-field-key="' + field.fieldKey + '"]');
        values[field.fieldKey] = inputElement ? inputElement.value.trim() : "";
      }
    });
    return values;
  }

  function hasRequiredFields(categoryKey) {
    var definition = categoryDefinitionOf(categoryKey);
    var values = collectCategoryFieldValues(categoryKey);
    for (var i = 0; i < definition.fields.length; i++) {
      var field = definition.fields[i];
      if (!fieldIsVisible(field, values)) { continue; }
      if (field.kind === "chips") {
        if (!values[field.fieldKey]) { return false; }
      } else if (field.required) {
        if (!values[field.fieldKey]) { return false; }
      }
    }
    return true;
  }

  function buildPromptPreview(categoryKey) {
    var definition = categoryDefinitionOf(categoryKey);
    if (!definition.buildPrompt) { return ""; }
    var values = collectCategoryFieldValues(categoryKey);
    return definition.buildPrompt(values);
  }

  function renderFormPanel(categoryKey) {
    var definition = categoryDefinitionOf(categoryKey);
    var panel = byId("shc-form-panel");
    if (categoryKey === "my-notes") {
      renderNotesPanel();
      return;
    }
    if (!definition || definition.fields.length === 0) {
      panel.classList.remove("shc-panel-open");
      panel.innerHTML = "";
      return;
    }
    panel.classList.add("shc-panel-open");
    var visibleFields = definition.fields.filter(function (field) {
      return fieldIsVisible(field, collectCategoryFieldValues(categoryKey));
    });
    var fieldsHtml = visibleFields.map(buildFieldHtml).join("");
    var disabledAttribute = canAskAi() ? "" : " disabled";
    panel.innerHTML =
      '<div class="shc-form-head">' +
      '<div class="shc-form-title">' + escapeHtml(definition.title) + "</div>" +
      '<div class="shc-form-hint">' + escapeHtml(definition.hint || "") + "</div>" +
      "</div>" +
      '<div class="shc-form-body">' + fieldsHtml + "</div>" +
      '<div class="shc-form-preview" id="shc-form-preview">' +
      '<span class="shc-preview-label">Your question, being built</span>' +
      '<span id="shc-form-preview-text">Choose one answer in each group - your question builds itself.</span>' +
      "</div>" +
      '<div class="shc-form-actions">' +
      '<button type="button" class="shc-action-btn" id="shc-form-ask-ai"' + disabledAttribute + ">Ask the helper now</button>" +
      '<button type="button" class="shc-action-btn shc-action-secondary" id="shc-form-speak"' + disabledAttribute + ">Speak instead of typing</button>" +
      '<button type="button" class="shc-action-btn shc-action-secondary" id="shc-form-copy"' + disabledAttribute + ">Copy the question</button>" +
      "</div>";
    updateFormPreview();
    bindFormPanelEvents(categoryKey);
    tool.resize();
  }

  function updateFormPreview() {
    var previewText = byId("shc-form-preview-text");
    if (!previewText) { return; }
    if (hasRequiredFields(currentCategoryKey)) {
      previewText.textContent = buildPromptPreview(currentCategoryKey);
    } else {
      previewText.textContent = "Choose one answer in each group - your question builds itself.";
    }
  }

  function firstWritableFieldKey() {
    var panel = byId("shc-form-panel");
    var candidates = panel.querySelectorAll("textarea[data-field-key], input[data-field-key]");
    for (var i = 0; i < candidates.length; i++) {
      var fieldKey = candidates[i].getAttribute("data-field-key");
      if (!candidates[i].value.trim()) { return fieldKey; }
    }
    return candidates.length ? candidates[0].getAttribute("data-field-key") : "";
  }

  function pasteIntoField(fieldKey) {
    var targetKey = fieldKey || lastFocusedFieldKey || firstWritableFieldKey();
    var fieldElement = byId("shc-form-panel").querySelector('[data-field-key="' + targetKey + '"]');
    if (!fieldElement) { return; }
    if (navigator && navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (clipboardText) {
        fieldElement.value = (fieldElement.value ? fieldElement.value + "\n" : "") + clipboardText;
        updateFormPreview();
      }, function () {
        fieldElement.focus();
        tryNotify("Press and hold inside the box, then tap Paste", "info");
      });
    } else {
      fieldElement.focus();
      tryNotify("Press and hold inside the box, then tap Paste", "info");
    }
  }

  function speakIntoFormField() {
    var targetKey = lastFocusedFieldKey || firstWritableFieldKey();
    if (!targetKey) { tryNotify("There is nothing to fill by voice here", "info"); return; }
    if (!speechRecognitionAvailable()) { tryNotify("Voice typing is not available on this device", "warning"); return; }
    var fieldElement = byId("shc-form-panel").querySelector('[data-field-key="' + targetKey + '"]');
    if (!fieldElement) { return; }
    var SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      var formRecognition = new SpeechRecognitionClass();
      formRecognition.lang = "en-US";
      formRecognition.interimResults = true;
      formRecognition.onresult = function (event) {
        var spokenText = "";
        for (var resultIndex = 0; resultIndex < event.results.length; resultIndex++) {
          spokenText += event.results[resultIndex][0].transcript;
        }
        fieldElement.value = spokenText;
        updateFormPreview();
      };
      formRecognition.onend = function () {
        var speakButton = byId("shc-form-speak");
        if (speakButton) { speakButton.textContent = "Speak instead of typing"; speakButton.classList.remove("shc-toolbtn-active"); }
      };
      formRecognition.onerror = function () {
        var speakButton = byId("shc-form-speak");
        if (speakButton) { speakButton.textContent = "Speak instead of typing"; speakButton.classList.remove("shc-toolbtn-active"); }
      };
      var speakButton = byId("shc-form-speak");
      if (speakButton) { speakButton.textContent = "Listening..."; speakButton.classList.add("shc-toolbtn-active"); }
      formRecognition.start();
    } catch (error) {
      tryNotify("Voice typing is not available on this device", "warning");
    }
  }

  function bindFormPanelEvents(categoryKey) {
    var panel = byId("shc-form-panel");
    panel.querySelectorAll("input, textarea").forEach(function (textElement) {
      textElement.addEventListener("input", updateFormPreview);
      textElement.addEventListener("focus", function () {
        lastFocusedFieldKey = textElement.getAttribute("data-field-key") || "";
      });
    });
    panel.querySelectorAll(".shc-chip-row").forEach(function (chipGroup) {
      chipGroup.addEventListener("click", function (event) {
        var chipButton = event.target.closest ? event.target.closest(".shc-chip-btn") : null;
        if (!chipButton) { return; }
        var fieldKey = chipButton.getAttribute("data-field-key");
        setChipValue(categoryKey, fieldKey, chipButton.getAttribute("data-chip-value"));
        chipGroup.querySelectorAll(".shc-chip-btn").forEach(function (sibling) {
          sibling.classList.toggle("shc-chip-btn-active", sibling === chipButton);
        });
        var definition = categoryDefinitionOf(categoryKey);
        var hasConditionalFields = definition.fields.some(function (field) { return field.visibleWhen; });
        if (hasConditionalFields) {
          renderFormPanel(categoryKey);
        } else {
          updateFormPreview();
        }
      });
    });
    panel.querySelectorAll(".shc-paste-btn").forEach(function (pasteButton) {
      pasteButton.addEventListener("click", function () {
        pasteIntoField(pasteButton.getAttribute("data-paste-for"));
      });
    });
    panel.querySelectorAll(".shc-example-btn").forEach(function (exampleButton) {
      exampleButton.addEventListener("click", function () {
        var fieldElement = panel.querySelector('[data-field-key="' + exampleButton.getAttribute("data-example-for") + '"]');
        if (fieldElement) {
          fieldElement.value = exampleButton.getAttribute("data-example-text");
          updateFormPreview();
        }
      });
    });
    var speakButton = byId("shc-form-speak");
    if (speakButton) {
      if (!speechRecognitionAvailable()) { speakButton.style.display = "none"; }
      speakButton.addEventListener("click", speakIntoFormField);
    }
    var askNowButton = byId("shc-form-ask-ai");
    if (askNowButton) {
      askNowButton.addEventListener("click", function () {
        if (!hasRequiredFields(categoryKey)) {
          tryNotify("Please choose one answer in each group first", "warning");
          return;
        }
        var promptText = buildPromptPreview(categoryKey);
        sendChatMessage(promptText, categoryKey);
      });
    }
    var copyButton = byId("shc-form-copy");
    if (copyButton) {
      copyButton.addEventListener("click", function () {
        if (!hasRequiredFields(categoryKey)) {
          tryNotify("Please choose one answer in each group first", "warning");
          return;
        }
        copyTextToClipboard(buildPromptPreview(categoryKey), "Question copied - paste it into any AI app");
      });
    }
  }

  function updateCategoryHighlight() {
    var categoryButtons = appElement.querySelectorAll(".shc-catbtn");
    categoryButtons.forEach(function (button) {
      button.classList.toggle("shc-catbtn-active", button.getAttribute("data-category-key") === currentCategoryKey);
    });
  }

  function openCategory(categoryKey) {
    currentCategoryKey = categoryKey;
    updateCategoryHighlight();
    renderFormPanel(categoryKey);
    if (categoryKey === "free-question") {
      byId("shc-chat-input").focus();
    }
  }

  /* ---------- chat ---------- */

  function buildFullAiPrompt(userText) {
    var contextLines = [];
    var recentMessages = chatMessages.slice(-8);
    recentMessages.forEach(function (message) {
      contextLines.push((message.role === "user" ? "Person: " : "Helper: ") + message.text);
    });
    var parts = [SENIOR_SYSTEM_PROMPT];
    var customInstructions = tool.param("assistantInstructions", "");
    if (customInstructions) { parts.push("Extra instructions from the organizer: " + customInstructions); }
    if (contextLines.length) { parts.push("Conversation so far:\n" + contextLines.join("\n")); }
    parts.push("The person now says:\n" + userText);
    return parts.join("\n\n");
  }

  function renderChatMessages() {
    var messagesContainer = byId("shc-chat-messages");
    var welcomeNote = byId("shc-welcome-note");
    if (welcomeNote && chatMessages.length > 0) { welcomeNote.style.display = "none"; }
    var html = "";
    chatMessages.forEach(function (message, messageIndex) {
      if (message.role === "user") {
        html += '<div class="shc-msg shc-msg-user">' + escapeHtml(message.text) + "</div>";
      } else {
        var warnClass = message.warnStyle ? " shc-msg-warn" : "";
        html += '<div class="shc-msg shc-msg-ai' + warnClass + '">' +
          formatAiAnswer(message.text) +
          '<div class="shc-msg-meta">' +
          '<button type="button" data-action="listen" data-message-index="' + messageIndex + '">Listen</button>' +
          '<button type="button" data-action="copy" data-message-index="' + messageIndex + '">Copy</button>' +
          '<button type="button" data-action="save" data-message-index="' + messageIndex + '">Save</button>' +
          "</div>" +
          "</div>";
      }
    });
    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    renderQuickStarts();
    renderAgainChips();
  }

  function appendThinkingBubble() {
    var messagesContainer = byId("shc-chat-messages");
    var thinkingElement = document.createElement("div");
    thinkingElement.className = "shc-thinking";
    thinkingElement.id = "shc-thinking-bubble";
    thinkingElement.textContent = "The helper is thinking...";
    messagesContainer.appendChild(thinkingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function removeThinkingBubble() {
    var thinkingElement = byId("shc-thinking-bubble");
    if (thinkingElement && thinkingElement.parentNode) {
      thinkingElement.parentNode.removeChild(thinkingElement);
    }
  }

  function closeFormAfterAsk() {
    var panel = byId("shc-form-panel");
    if (panel.classList.contains("shc-panel-open")) {
      panel.classList.remove("shc-panel-open");
      panel.innerHTML = "";
    }
  }

  function sendChatMessage(userText, categoryKey) {
    var trimmedText = String(userText || "").trim();
    if (!trimmedText) { return; }
    if (!canAskAi()) {
      tryNotify("This record is view-only, so the helper cannot answer here", "warning");
      return;
    }
    if (tool.param("allowAi", "") !== "yes") {
      tryNotify("The AI service is not enabled for this helper", "error");
      return;
    }
    var userName = displayNameOf(currentUser) || tool.param("userFirstName", "");
    chatMessages.push({ role: "user", text: trimmedText, time: timestampLabel(), userId: currentUser ? currentUser.id : "", userName: userName });
    byId("shc-chat-input").value = "";
    closeFormAfterAsk();
    renderChatMessages();
    appendThinkingBubble();
    persistChatSessionSoon();
    tool.requestAI(buildFullAiPrompt(trimmedText), "", function (error, responseText) {
      removeThinkingBubble();
      if (error) { tryNotify("AI error: " + error, "warning"); }
      if (responseText) {
        chatMessages.push({
          role: "assistant",
          text: responseText,
          time: timestampLabel(),
          userId: "ai",
          userName: "Helper",
          warnStyle: categoryKey === "safety-check"
        });
        renderChatMessages();
        persistChatSessionSoon();
        if (listenMode) { speakAnswerText(responseText); }
      } else {
        chatMessages.push({
          role: "assistant",
          text: "Sorry, I could not reach the helper service right now. Please try again in a moment.",
          time: timestampLabel(),
          userId: "ai",
          userName: "Helper"
        });
        renderChatMessages();
      }
    });
  }

  /* ---------- read-only ---------- */

  function applyReadOnlyState() {
    var canAsk = canAskAi();
    byId("shc-send-button").disabled = !canAsk;
    if (!canAsk) {
      byId("shc-chat-input").placeholder = "This record is view-only. You can still read and copy answers.";
    } else {
      byId("shc-chat-input").placeholder = "Type your question here... (Enter to send)";
    }
    var askNowButton = byId("shc-form-ask-ai");
    if (askNowButton) { askNowButton.disabled = !canAsk; }
  }

  /* ---------- quick starts, ask again, notes, voice, new chat ---------- */

  function renderQuickStarts() {
    var container = byId("shc-quick-starts");
    if (!container) { return; }
    if (chatMessages.length > 0) { container.innerHTML = ""; return; }
    container.innerHTML = QUICK_START_PROMPTS.map(function (quickStart, quickIndex) {
      return '<button type="button" class="shc-quick-chip" data-quick-index="' + quickIndex + '">' + escapeHtml(quickStart.label) + "</button>";
    }).join("");
  }

  function renderAgainChips() {
    var container = byId("shc-again-chips");
    if (!container) { return; }
    var recentUserMessages = chatMessages.filter(function (message) { return message.role === "user"; }).slice(-5);
    if (recentUserMessages.length === 0) { container.innerHTML = ""; return; }
    againPromptCache = recentUserMessages.map(function (message) { return message.text; });
    var chipsHtml = recentUserMessages.map(function (message, recentIndex) {
      var shortText = message.text.length > 60 ? message.text.substring(0, 60) + "..." : message.text;
      return '<button type="button" class="shc-again-chip" data-again-index="' + recentIndex + '">' + escapeHtml(shortText) + "</button>";
    }).join("");
    container.innerHTML = '<span class="shc-again-label">Ask again</span>' + chipsHtml;
  }

  function addSavedNote(noteText) {
    var trimmedText = String(noteText || "").trim();
    if (!trimmedText) { return; }
    savedValue.notes.unshift({ id: "note-" + Date.now().toString(36), text: trimmedText.substring(0, 3000), time: timestampLabel() });
    if (savedValue.notes.length > 20) { savedValue.notes = savedValue.notes.slice(0, 20); }
    persistSavedValue();
    tryNotify("Answer saved - find it under My saved answers", "success");
    if (currentCategoryKey === "my-notes") { renderNotesPanel(); }
  }

  function removeSavedNoteById(noteId) {
    savedValue.notes = savedValue.notes.filter(function (note) { return note.id !== noteId; });
    persistSavedValue();
    if (currentCategoryKey === "my-notes") { renderNotesPanel(); }
  }

  function renderNotesPanel() {
    var panel = byId("shc-form-panel");
    panel.classList.add("shc-panel-open");
    var notesHtml;
    if (savedValue.notes.length === 0) {
      notesHtml = '<div class="shc-notes-empty">No saved answers yet. Tap the Save button under any helper answer to keep it here.</div>';
    } else {
      notesHtml = '<div class="shc-notes-list">' + savedValue.notes.map(function (note) {
        return '<div class="shc-note-item">' +
          "<p>" + escapeHtml(note.text) + "</p>" +
          '<div class="shc-note-actions">' +
          '<button type="button" data-note-action="listen" data-note-id="' + escapeHtml(note.id) + '">Listen</button>' +
          '<button type="button" data-note-action="copy" data-note-id="' + escapeHtml(note.id) + '">Copy</button>' +
          '<button type="button" class="shc-note-remove" data-note-action="remove" data-note-id="' + escapeHtml(note.id) + '">Remove</button>' +
          "</div>" +
          "</div>";
      }).join("") + "</div>";
    }
    panel.innerHTML =
      '<div class="shc-form-head">' +
      '<div class="shc-form-title">My saved answers (' + savedValue.notes.length + ")</div>" +
      '<div class="shc-form-hint">Answers you kept. They stay here even after you start a new chat.</div>' +
      "</div>" + notesHtml;
    tool.resize();
  }

  function speechRecognitionAvailable() {
    return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setVoiceListeningState(isListening) {
    voiceListeningNow = isListening;
    var talkButton = byId("shc-talk-button");
    if (!talkButton) { return; }
    talkButton.textContent = isListening ? "Listening..." : "Talk";
    talkButton.classList.toggle("shc-talk-listening", isListening);
  }

  function startVoiceListening() {
    if (!speechRecognitionAvailable() || voiceListeningNow) { return; }
    var SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      recognitionInstance = new SpeechRecognitionClass();
    } catch (error) {
      tryNotify("Voice typing is not available on this device", "warning");
      return;
    }
    recognitionInstance.lang = "en-US";
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = false;
    recognitionInstance.onresult = function (event) {
      var spokenText = "";
      for (var resultIndex = 0; resultIndex < event.results.length; resultIndex++) {
        spokenText += event.results[resultIndex][0].transcript;
      }
      byId("shc-chat-input").value = spokenText;
    };
    recognitionInstance.onend = function () { setVoiceListeningState(false); };
    recognitionInstance.onerror = function () { setVoiceListeningState(false); };
    setVoiceListeningState(true);
    recognitionInstance.start();
  }

  function stopVoiceListening() {
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch (error) { /* already stopped */ }
    }
    setVoiceListeningState(false);
  }

  function applySafetyVisibility() {
    var card = byId("shc-safety-card");
    var toggleButton = byId("shc-safety-toggle");
    if (!card) { return; }
    card.classList.toggle("shc-safety-hidden", !savedValue.settings.showSafetyRules);
    if (toggleButton) { toggleButton.textContent = savedValue.settings.showSafetyRules ? "Hide" : "Show"; }
  }

  function startNewChat() {
    var button = byId("shc-new-chat");
    if (!newChatArmed) {
      newChatArmed = true;
      button.textContent = "Sure? Tap again";
      button.classList.add("shc-toolbtn-active");
      if (newChatArmTimer) { clearTimeout(newChatArmTimer); }
      newChatArmTimer = setTimeout(function () {
        newChatArmed = false;
        button.textContent = "New chat";
        button.classList.remove("shc-toolbtn-active");
      }, 3000);
      return;
    }
    newChatArmed = false;
    if (newChatArmTimer) { clearTimeout(newChatArmTimer); }
    button.textContent = "New chat";
    button.classList.remove("shc-toolbtn-active");
    chatMessages = [];
    closeFormAfterAsk();
    renderChatMessages();
    persistChatSessionSoon();
    tryNotify("A fresh conversation is ready", "success");
  }

  /* ---------- main binding ---------- */

  function bindStaticEvents() {
    appElement.querySelectorAll(".shc-catbtn").forEach(function (button) {
      button.addEventListener("click", function () {
        openCategory(button.getAttribute("data-category-key"));
      });
    });
    byId("shc-text-bigger").addEventListener("click", function () { cycleTextScale(1); });
    byId("shc-text-smaller").addEventListener("click", function () { cycleTextScale(-1); });
    byId("shc-listen-toggle").addEventListener("click", function () {
      listenMode = !listenMode;
      if (!listenMode) { stopSpeaking(); }
      savedValue.settings.listenMode = listenMode;
      updateListenButtonLabel();
      persistSavedValue();
    });
    byId("shc-send-button").addEventListener("click", function () {
      sendChatMessage(byId("shc-chat-input").value, currentCategoryKey);
    });
    var talkButton = byId("shc-talk-button");
    if (talkButton) {
      if (!speechRecognitionAvailable()) {
        talkButton.style.display = "none";
      } else {
        talkButton.addEventListener("click", function () {
          if (voiceListeningNow) { stopVoiceListening(); } else { startVoiceListening(); }
        });
      }
    }
    byId("shc-new-chat").addEventListener("click", startNewChat);
    byId("shc-safety-toggle").addEventListener("click", function () {
      savedValue.settings.showSafetyRules = !savedValue.settings.showSafetyRules;
      applySafetyVisibility();
      persistSavedValue();
    });
    byId("shc-quick-starts").addEventListener("click", function (event) {
      var chip = event.target.closest ? event.target.closest(".shc-quick-chip") : null;
      if (!chip) { return; }
      var quickIndex = parseInt(chip.getAttribute("data-quick-index"), 10);
      var quickStart = QUICK_START_PROMPTS[quickIndex];
      if (quickStart) { sendChatMessage(quickStart.prompt, quickStart.categoryKey); }
    });
    byId("shc-again-chips").addEventListener("click", function (event) {
      var chip = event.target.closest ? event.target.closest(".shc-again-chip") : null;
      if (!chip) { return; }
      var againIndex = parseInt(chip.getAttribute("data-again-index"), 10);
      var promptText = againPromptCache[againIndex];
      if (promptText) { sendChatMessage(promptText, "free-question"); }
    });
    byId("shc-form-panel").addEventListener("click", function (event) {
      var actionButton = event.target.closest ? event.target.closest("[data-note-action]") : null;
      if (!actionButton) { return; }
      var noteId = actionButton.getAttribute("data-note-id");
      var noteAction = actionButton.getAttribute("data-note-action");
      var foundNote = null;
      for (var noteIndex = 0; noteIndex < savedValue.notes.length; noteIndex++) {
        if (savedValue.notes[noteIndex].id === noteId) { foundNote = savedValue.notes[noteIndex]; break; }
      }
      if (!foundNote) { return; }
      if (noteAction === "listen") { speakAnswerText(foundNote.text); }
      if (noteAction === "copy") { copyTextToClipboard(foundNote.text, "Answer copied"); }
      if (noteAction === "remove") { removeSavedNoteById(noteId); }
    });
    byId("shc-chat-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage(byId("shc-chat-input").value, currentCategoryKey);
      }
    });
    byId("shc-chat-messages").addEventListener("click", function (event) {
      var actionButton = event.target.closest ? event.target.closest("button[data-action]") : null;
      if (!actionButton) { return; }
      var action = actionButton.getAttribute("data-action");
      var messageIndex = parseInt(actionButton.getAttribute("data-message-index"), 10);
      var message = chatMessages[messageIndex];
      if (!message) { return; }
      if (action === "listen") { speakAnswerText(message.text); }
      if (action === "copy") { copyTextToClipboard(message.text, "Answer copied"); }
      if (action === "save") { addSavedNote(message.text); }
    });
    byId("shc-copy-modal-done").addEventListener("click", closeCopyModal);
    byId("shc-copy-modal-overlay").addEventListener("click", function (event) {
      if (event.target === byId("shc-copy-modal-overlay")) { closeCopyModal(); }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { closeCopyModal(); }
    });
  }

  function updateGreeting() {
    var greetingName = tool.param("userFirstName", "");
    if (!greetingName && currentUser) { greetingName = firstNameOf(displayNameOf(currentUser)); }
    var greeting = greetingName ? "Good day, " + greetingName + "! What would you like help with?" : "Good day! What would you like help with?";
    byId("shc-greeting").textContent = greeting;
  }

  /* ---------- init ---------- */

  function renderSavedSettings() {
    listenMode = savedValue.settings.listenMode === true;
    applyTextScale();
    updateListenButtonLabel();
    updateGreeting();
    applySafetyVisibility();
  }

  function declareToolParams() {
    tool.declareParams([
      { name: "allowAi", label: "Allow AI Service", type: "toggle", default: "yes", severity: "mandatory", hint: "Enables the chat and the guided question helpers." },
      { name: "allowObjectCRUD", label: "Allow Chat History Storage", type: "toggle", default: "yes", severity: "goodToHave", hint: "Saves the chat history to ai-chat-sessions-uniconbaseapps so the conversation survives reloads." },
      { name: "userFirstName", label: "First Name", type: "text", default: "", severity: "optional", hint: "Used in the greeting and in messages, e.g. 'Good day, Mary'." },
      { name: "assistantInstructions", label: "Extra Assistant Instructions", type: "text", default: "", severity: "optional", hint: "Organizer notes appended to every AI request, e.g. 'Speak about the community center hours'." },
      { name: "defaultTextScale", label: "Default Text Size", type: "select", default: "normal", severity: "optional", hint: "Start with normal, large, or extra-large text." }
    ]);
  }

  function reportMissingConfiguration() {
    var missingParams = [];
    if (tool.param("allowAi", "") !== "yes") {
      missingParams.push({
        name: "allowAi",
        label: "Allow AI Service",
        type: "toggle",
        default: "yes",
        hint: "Enables the chat and the guided question helpers.",
        reason: "The senior helper needs the AI service to answer questions.",
        severity: "mandatory"
      });
    }
    if (missingParams.length) {
      tool.reportMissingParams(missingParams, "The AI service must be enabled for this helper to answer questions.");
    }
  }

  tool.onReady(function (initialValue) {
    appElement = byId("shc-app");
    declareToolParams();
    reportMissingConfiguration();
    parentRecordId = parentRecordIdFromUrl();
    instanceId = INSTANCE_PREFIX + (parentRecordId || "local");
    savedValue = normalizeSavedValue(initialValue);
    if (!savedValue._instanceId || savedValue._instanceId === INSTANCE_PREFIX + "local") {
      savedValue._instanceId = instanceId;
      persistSavedValue();
    } else {
      instanceId = savedValue._instanceId;
    }
    chatSessionObjectId = savedValue._sessionObjectId || "";
    if (tool.param("defaultTextScale", "normal") !== "normal" && savedValue.settings.textScale === "normal") {
      savedValue.settings.textScale = tool.param("defaultTextScale", "normal");
    }
    refreshUserWithFallback();
    renderSavedSettings();
    bindStaticEvents();
    openCategory("free-question");
    renderQuickStarts();
    renderAgainChips();
    applyReadOnlyState();
    loadChatSessionObject();
    startIdentityPolling();
    tool.onValueChange(function (newValue) {
      var incomingJson = JSON.stringify(newValue);
      if (incomingJson === lastStagedJson) { return; }
      savedValue = normalizeSavedValue(newValue);
      lastStagedJson = JSON.stringify(savedValue);
      renderSavedSettings();
      applySafetyVisibility();
      if (currentCategoryKey === "my-notes") { renderNotesPanel(); }
      applyReadOnlyState();
    });
    tool.onReadonlyChange(function (readOnlyNow) {
      readOnlyMode = readOnlyNow;
      applyReadOnlyState();
    });
    tool.onUserChange(function (userNow) {
      if (userNow) { currentUser = userNow; }
      updateGreeting();
      applyReadOnlyState();
    });
    readOnlyMode = tool.isReadOnly();
    applyReadOnlyState();
    tool.reportValid(true);
    tool.resize();
  });

})();
