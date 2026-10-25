/* Insert the new markup into the harness only, with per-piece guards. */
const fs = require('fs');
const filePath = 'd:/PROJECTS/UNICONHUB/CODE/HTMLBasedTools/BUSINESS/VERTICAL/food-beverage/restaurants-cafes/RestaurantAndMenuManager/app/test-harness.html';
let text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

const coordinateBlock = `            <div class="coord-picker-block">
              <div class="coord-picker-actions">
                <button type="button" class="btn btn-sm btn-outline" id="gen-coord-open-map-btn">📍 Pick on map</button>
                <span class="field-hint" id="gen-coord-hint">No point selected yet.</span>
              </div>
              <div class="coord-map-wrap" id="gen-coord-map-wrap" style="display:none;">
                <div id="gen-coord-map"></div>
                <div class="coord-map-tools">
                  <input type="text" class="form-input form-input-sm" id="gen-coord-maps-link" placeholder="Paste a Google Maps link or lat, lng">
                  <button type="button" class="btn btn-sm btn-outline" id="gen-coord-maps-apply">Use link</button>
                </div>
                <span class="field-hint">Click the map or drag the pin. The delivery map and the website use the same point.</span>
              </div>
            </div>
`;

const taxTemplateRow = `          <div class="tax-template-row">
            <button type="button" class="btn btn-sm btn-outline" id="tax-apply-template-btn">🏛️ Apply state / province template</button>
            <span class="field-hint" id="tax-template-hint"></span>
          </div>
`;

const modals = `<!-- ===== TAX TEMPLATE CONFIRMATION ===== -->
<div class="modal-overlay" id="tax-template-modal" style="display:none;">
  <div class="modal-dialog">
    <div class="modal-title">Apply tax template?</div>
    <div class="modal-body">
      <p><strong id="tax-template-confirm-name"></strong></p>
      <p id="tax-template-confirm-note"></p>
      <p id="tax-template-confirm-existing"></p>
      <p class="field-hint">The template fills the tax name, one tax category for pickup, delivery and in-restaurant, and the delivery-fee tax rate.</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost btn-sm" id="tax-template-cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" id="tax-template-apply-btn">Apply template</button>
    </div>
  </div>
</div>

<!-- ===== AI DEAL GENERATION ===== -->
<div class="modal-overlay" id="deal-ai-modal" style="display:none;">
  <div class="modal-dialog modal-dialog-deal">
    <div class="deal-editor-header">
      <div class="modal-title">✨ Generate sample deals with AI</div>
      <button type="button" class="btn btn-sm btn-ghost" id="deal-ai-close">✕</button>
    </div>
    <div class="deal-editor-body">
      <p class="deal-rule-hint">The AI reads your menu, your existing deals and every supported rule type, then creates one deal per selected type. Every generated deal is saved <strong>inactive</strong>, so you review the list and switch on only the ones you want.</p>
      <fieldset class="settings-group">
        <legend>Deal types to generate</legend>
        <div class="deal-ai-types" id="deal-ai-types">
          <label class="radio-label"><input type="checkbox" value="bundle"> Bundle</label>
          <label class="radio-label"><input type="checkbox" value="min_quantity"> Minimum quantity</label>
          <label class="radio-label"><input type="checkbox" value="tiered"> Tiered</label>
          <label class="radio-label"><input type="checkbox" value="two_for_one"> Two for one</label>
          <label class="radio-label"><input type="checkbox" value="percentage_discount"> Percentage discount</label>
          <label class="radio-label"><input type="checkbox" value="subtotal_threshold"> Subtotal threshold</label>
          <label class="radio-label"><input type="checkbox" value="free_delivery"> Free delivery</label>
          <label class="radio-label"><input type="checkbox" value="free_item_with_purchase"> Free item with purchase</label>
          <label class="radio-label"><input type="checkbox" value="buy_n_get_m"> Buy N get M</label>
          <label class="radio-label"><input type="checkbox" value="volume_pricing"> Volume pricing</label>
          <label class="radio-label"><input type="checkbox" value="free_modifier"> Free modifier options</label>
        </div>
      </fieldset>
      <div id="deal-ai-error" class="deal-editor-errors" style="display:none;"></div>
      <p class="field-hint">AI calls are limited to 30 per month per restaurant. The counter appears here once usage monitoring is enabled.</p>
    </div>
    <div class="deal-editor-actions">
      <span class="field-hint">All generated deals are inactive.</span>
      <div class="deal-editor-actions-right">
        <button type="button" class="btn btn-sm btn-ghost" id="deal-ai-cancel">Cancel</button>
        <button type="button" class="btn btn-sm btn-primary" id="deal-ai-run">Generate deals</button>
      </div>
    </div>
  </div>
</div>

`;

if (text.indexOf('gen-coord-open-map-btn') < 0) {
  const coordinateAnchor = `              <input type="number" class="form-input" id="gen-coord-lng" data-path="general_info.coordinates.lng" step="any" placeholder="Lng (-74.006)">
            </div>
          </div>
        </div>
`;
  if (text.indexOf(coordinateAnchor) < 0) throw new Error('coordinate anchor missing');
  text = text.replace(coordinateAnchor, coordinateAnchor + coordinateBlock);
}

if (text.indexOf('zone-center-btn') < 0) {
  const mapAnchor = '<div id="delivery-map"></div>';
  if (text.indexOf(mapAnchor) < 0) throw new Error('map anchor missing');
  text = text.replace(mapAnchor, '<div class="zone-map-toolbar"><button type="button" class="btn btn-sm btn-outline" id="zone-center-btn">📍 Center on restaurant</button></div>\n        ' + mapAnchor);
}

if (text.indexOf('tax-apply-template-btn') < 0) {
  const taxAnchor = '<button type="button" class="btn btn-outline btn-sm" id="tax-add-cat">+ Add Category</button>';
  if (text.indexOf(taxAnchor) < 0) throw new Error('tax anchor missing');
  text = text.replace(taxAnchor, taxAnchor + '\n' + taxTemplateRow);
}

if (text.indexOf('deals-ai-generate-btn') < 0) {
  const aiButtonAnchor = '        <button type="button" class="btn btn-sm btn-outline" id="deals-import-btn">📥 Samples</button>';
  if (text.indexOf(aiButtonAnchor) < 0) throw new Error('deals toolbar anchor missing');
  text = text.replace(aiButtonAnchor, '        <button type="button" class="btn btn-sm btn-outline" id="deals-ai-generate-btn">✨ Generate with AI</button>\n' + aiButtonAnchor);
}

if (text.indexOf('deal-ai-modal') < 0) {
  const alertsAnchor = '<section class="tab-panel" data-tab="alerts">';
  if (text.indexOf(alertsAnchor) < 0) throw new Error('alerts anchor missing');
  text = text.replace(alertsAnchor, modals + alertsAnchor);
}

fs.writeFileSync(filePath, text.replace(/\n/g, '\r\n'), 'utf8');
console.log('harness markup updated');
