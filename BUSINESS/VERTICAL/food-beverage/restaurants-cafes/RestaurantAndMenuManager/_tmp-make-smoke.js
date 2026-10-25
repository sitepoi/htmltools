/* Build a temporary smoke-test page from the harness, with a scripted scenario. */
const fs = require('fs');
const { join } = require('path');
const toolDir = 'd:/PROJECTS/UNICONHUB/CODE/HTMLBasedTools/BUSINESS/VERTICAL/food-beverage/restaurants-cafes/RestaurantAndMenuManager/app';
const sourcePath = join(toolDir, 'test-harness.html');
const targetPath = join(toolDir, '_tmp-smoke.html');

const scenario = `
<script>
(function () {
  var results = [];
  function record(label, value) { results.push(label + '=' + value); }

  window.tool.requestAI = function (prompt, context, callback) {
    var canned = JSON.stringify({ deals: [
      { title: 'AI lunch 10%', description: 'AI test deal', section: 'deals', rule_type: 'percentage_discount', rule: { discount_percent: 10 } },
      { title: 'AI free delivery', description: 'AI test deal', section: 'deals', rule_type: 'free_delivery', rule: { min_order: 20 } }
    ] });
    setTimeout(function () { callback(null, canned); }, 60);
  };

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'smoke-out';
    pre.textContent = 'SMOKE-START\\n' + results.join('\\n') + '\\nSMOKE-END';
    document.body.appendChild(pre);
    document.title = 'SMOKE-DONE';
  }

  function runAiScenario() {
    var generateButton = document.getElementById('deals-ai-generate-btn');
    record('aiButton', Boolean(generateButton));
    record('pageErrors', (window.__pageErrors || []).slice(0, 3).join(' | ') || 'none');
    record('leafletLoaded', typeof window.L);
    record('leafletDrawLoaded', window.L ? typeof window.L.Draw : 'no-leaflet');
    record('sortableLoaded', typeof window.Sortable);
    record('isReadOnly', window.tool.isReadOnly());
    record('openFnType', typeof openDealAiGenerateModal);
    record('globalScope', Object.keys(window).filter(function (key) { return key.indexOf('wire') === 0 || key.indexOf('openDeal') === 0; }).join(',') || 'no-globals');

    document.getElementById('zone-add-btn').click();
    record('zoneFormOpened', document.getElementById('zone-form').style.display !== 'none');
    document.getElementById('deals-import-btn').click();
    record('importModalOpened', document.getElementById('deals-import-modal').style.display !== 'none');
    if (document.getElementById('deals-import-cancel')) document.getElementById('deals-import-cancel').click();
    if (!generateButton) return;

    try { openDealAiGenerateModal(); } catch (error) { record('openFnError', error.message); }
    record('aiModalAfterDirectCall', document.getElementById('deal-ai-modal').style.display);

    generateButton.click();
    record('aiModalVisible', document.getElementById('deal-ai-modal').style.display !== 'none');
    var checkboxes = document.querySelectorAll('#deal-ai-types input[type=checkbox]');
    record('aiTypeCount', checkboxes.length);

    var dealCountBefore = storedDeals().length;
    Array.prototype.forEach.call(checkboxes, function (checkbox) {
      checkbox.checked = (checkbox.value === 'percentage_discount' || checkbox.value === 'free_delivery');
    });
    document.getElementById('deal-ai-run').click();

    setTimeout(function () {
      var createdDeals = storedDeals().slice(dealCountBefore);
      record('aiDealsAdded', createdDeals.length);
      record('aiDealsInactive', createdDeals.every(function (deal) { return deal.active === false; }));
      record('aiDealTypes', createdDeals.map(function (deal) { return deal.rule_type; }).join('+'));
      record('aiModalClosed', document.getElementById('deal-ai-modal').style.display === 'none');
      record('aiErrorHidden', document.getElementById('deal-ai-error').style.display === 'none');
      record('aiErrorText', (document.getElementById('deal-ai-error').textContent || '').slice(0, 60));
      record('dealsListHtml', (document.getElementById('deals-list').innerHTML || '').length);
      runCoordinateScenario();
    }, 900);
  }

  function storedDeals() {
    var value = window.tool.getValue() || {};
    return value.deals || [];
  }

  function runCoordinateScenario() {
    data.general_info.coordinates = { lat: 0, lng: 0 };
    document.getElementById('gen-coord-lat').value = '';
    document.getElementById('gen-coord-lng').value = '';
    document.getElementById('gen-coord-maps-link').value = 'https://www.google.com/maps/@41.0082,28.9784,15z';
    document.getElementById('gen-coord-maps-apply').click();
    record('coordLat', data.general_info.coordinates.lat);
    record('coordLng', data.general_info.coordinates.lng);
    record('coordHint', (document.getElementById('gen-coord-hint').textContent || '').slice(0, 40));

    document.getElementById('gen-coord-maps-link').value = 'not a link';
    document.getElementById('gen-coord-maps-apply').click();
    record('coordBadLinkKeptLat', data.general_info.coordinates.lat);
    runTaxScenario();
  }

  function runTaxScenario() {
    data.general_info.address = data.general_info.address || {};
    data.general_info.address.country = 'US';
    data.general_info.address.state = 'NY';
    renderTaxTemplateHint();
    record('taxHintText', (document.getElementById('tax-template-hint').textContent || '').slice(0, 45));

    document.getElementById('tax-apply-template-btn').click();
    record('taxModalVisible', document.getElementById('tax-template-modal').style.display !== 'none');
    document.getElementById('tax-template-apply-btn').click();
    var tax = data.taxation_currency || {};
    var categories = tax.tax_categories || [];
    record('taxName', tax.tax_name);
    record('taxCategoryCount', categories.length);
    record('taxPickupRate', categories.length ? categories[0].pickup : 'none');
    record('taxDeliveryFeeRate', tax.delivery_fee_tax_rate);
    record('taxModalClosed', document.getElementById('tax-template-modal').style.display === 'none');

    data.general_info.address.country = 'DE';
    data.general_info.address.state = 'BE';
    renderTaxTemplateHint();
    document.getElementById('tax-apply-template-btn').click();
    record('taxNoTemplateModalHidden', document.getElementById('tax-template-modal').style.display === 'none');
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        runAiScenario();
        setTimeout(finish, 2500);
      } catch (error) {
        record('exception', error.message);
        finish();
      }
    }, 700);
  });
})();
</script>
`;

const original = fs.readFileSync(sourcePath, 'utf8');
if (original.indexOf('</body>') < 0) throw new Error('no body end in harness');
const errorCapture = '<script>window.__pageErrors = []; window.addEventListener("error", function (event) { window.__pageErrors.push((event.message || "") + " @ " + (event.filename || "") + ":" + (event.lineno || 0)); });'
  + 'if (window.tool && window.tool.onReady) { var originalOnReady = window.tool.onReady; window.tool.onReady = function (callback) { return originalOnReady.call(window.tool, function (value) { try { callback(value); } catch (error) { window.__pageErrors.push("BOOT: " + error.message + " | " + String(error.stack || "").split("\\n").slice(0, 3).join(" ~ ")); throw error; } }); }; }'
  + '</script>\n';
const withCapture = original.replace('<script src="RestaurantAndMenuManager.js"></script>', errorCapture + '<script src="RestaurantAndMenuManager.js"></script>');
const updated = withCapture.replace('</body>', scenario + '</body>');
fs.writeFileSync(targetPath, updated, 'utf8');
console.log('created ' + targetPath);
