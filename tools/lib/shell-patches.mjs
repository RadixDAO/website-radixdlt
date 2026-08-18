// Some exported detail templates are missing markup that every live page actually
// renders. This happens when the item Webflow used to bake the static "template" file
// had a conditionally-visible section hidden (e.g. an empty field), so the section
// never made it into the export at all -- not display:none, just absent from the DOM.
// We can't edit the read-only export or the regenerated shell directly (see
// BINDING-BRIEF.md rule 1), so we patch the raw body here, once, per collection, using
// markup verified byte-for-byte against reference/live/<collection>/*.html.
//
// IMPORTANT: this patch must run identically in both convert-detail-templates.mjs
// (which writes src/shells/_detail/<c>/body.html, used at render time) and
// derive-bindings.mjs (which re-reads the raw export directly to compute slot
// indices). If the two ever disagree, slot indices silently point at the wrong
// elements. Both tools import `applyShellPatch` from here for that reason.
//
// radix-opp-statuses: detail_radix-opp-statuses.html has <h1> for the item name but
// nothing else -- no status badges, dates, or content. Every one of the 36 live pages
// (all Status=Closed) renders the same wrapper structure right after `c-title-main`;
// the fragment below reproduces it with Webflow's own empty-state markers so the
// normal binding pipeline can fill it in. The service-s MultiReference list reuses the
// exact single-item placeholder found in the read-only status/current-issues.html and
// status/closed-issues.html list templates. The status-warning-blue.svg icon and the
// "status-bar-5"/"closed" modifier are static across all 36 live samples (severity
// does not visibly affect this template) so they are hardcoded rather than bound.
const SHELL_PATCHES = {
  'radix-opp-statuses': (body) => {
    const anchor = '<h1 class="w-dyn-bind-empty"></h1>\n      </div>\n';
    const fragment = `      <div class="status-cap-3 closed">
        <div class="bm-20-copy"><img loading="lazy" src="https://cdn.prod.website-files.com/6053f7fca5bf627283b582c2/614a0c53de544d060d43ec73_status-warning-blue.svg" alt="" class="image-19">
          <div class="w-dyn-list">
            <div role="list" class="collection-list w-dyn-items">
              <div role="listitem" class="w-dyn-item">
                <div class="badge-3 w-dyn-bind-empty"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bm-20">
          <div class="status-date-2">
            <div class="text-small date">Date Reported:</div>
            <div class="c-date-time">
              <div class="text-small inline w-dyn-bind-empty"></div>
              <div class="text-small">(UTC)</div>
            </div>
          </div>
          <div class="status-date-2">
            <div class="text-small date">Last Update:</div>
            <div class="c-date-time">
              <div class="text-small inline w-dyn-bind-empty"></div>
              <div class="text-small inline">(UTC)</div>
            </div>
          </div>
          <div class="status-date-2">
            <div class="text-small date">Status:</div>
            <div class="c-date-time">
              <div class="text-small inline w-dyn-bind-empty"></div>
            </div>
          </div>
        </div>
        <div class="c-issue-desc">
          <div class="c-status-rt w-dyn-bind-empty w-richtext"></div>
        </div>
        <div class="status-bar-holder">
          <div class="status-bar-5"></div>
        </div>
      </div>
`;
    if (!body.includes(anchor)) throw new Error('radix-opp-statuses shell patch anchor not found -- export template changed?');
    return body.replace(anchor, anchor + fragment);
  },
};

/** Apply the collection's shell patch (if any) to a raw/exported body string. */
export function applyShellPatch(slug, body) {
  return SHELL_PATCHES[slug] ? SHELL_PATCHES[slug](body) : body;
}
