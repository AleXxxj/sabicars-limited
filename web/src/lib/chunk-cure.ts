/**
 * A piece of the site's code that did not arrive (a phone's connection dropped while it downloaded, or a page was open
 * across an update) is cured by loading the page again, once. Two places do it, sharing this key and window:
 *
 * - After the first load, a missing piece throws a ChunkLoadError, which lands in app/error.tsx or global-error.tsx and
 *   their useReloadCure (components/site/ErrorReport.tsx).
 * - During the first load nothing may throw: a file of the page's own that fails before Next's runtime is watching it
 *   leaves that part of the page dead, with no error at all (review of f092009, 14 November 2026: /contact's form and a
 *   car page's Chat with seller never woke). CHUNK_CURE_SCRIPT, inline in app/layout.tsx's <head>, watches for that.
 *
 * Both reload only once the site answers (whenSiteAnswers): a phone with signal but no data, or offline, keeps the page
 * it can read rather than trading it for the browser's own error page (review of 7c1faac, 15 November 2026).
 */

/** When the page last reloaded itself for a missing piece, kept for the tab's life only. */
export const CURE_KEY = "sc_chunk_reload";
/** A second missing piece this soon after the reload is not a dropped download: it is reported. */
export const CURE_WINDOW_MS = 60_000;
/** Set on window just before either cure reloads: the other then says "One moment…" and reports nothing. */
export const RELOADING_FLAG = "__scReloading";
/**
 * When a file of the site's code last failed to arrive, any file, Next's own fetches again included (set by
 * CHUNK_CURE_SCRIPT). An error page that opens moments later is that failure, whatever React calls it: on a very slow
 * line React gives up on the waiting page with its own error #482, not a ChunkLoadError (review of 666b037).
 */
export const CHUNK_FAILED_AT = "__scChunkFailedAt";
/** How long after a file failed an error is still taken for it. */
export const CHUNK_FAILED_WITHIN_MS = 10_000;
/** A small answer from the site that needs nothing else, never cached: proof that a reload will land (app/api/up). */
const UP_PATH = "/api/up";
/** How often to ask again while the site does not answer: every 5 s for the first minute, then every 30 s. */
const RETRY_MS = 5_000;
const RETRY_SLOW_MS = 30_000;
const RETRY_FAST_FOR_MS = 60_000;
/** The longest one ask may take before it counts as no answer. */
const ASK_TIMEOUT_MS = 6_000;

/**
 * Runs `go` once the site answers: at once if it does now, otherwise every 5 s for the first minute and every 30 s
 * after that, for as long as it takes, and straight away when the phone is back online or the page back in sight. It
 * never stops asking while the page is in sight: it did after ten minutes, and "One moment…" then stayed for good once
 * the data came back (review of 666b037, 15 November 2026). Nothing is asked while the page is out of sight or the phone
 * offline. `onMiss` is told each time the site does not answer. Returns a function that stops it.
 */
export function whenSiteAnswers(go: () => void, onMiss?: () => void): () => void {
  const since = Date.now();
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(check, Date.now() - since < RETRY_FAST_FOR_MS ? RETRY_MS : RETRY_SLOW_MS);
  };
  function check() {
    if (stopped || busy) return;
    if (document.visibilityState === "hidden" || navigator.onLine === false) return later();
    busy = true;
    const ctl = new AbortController();
    const giveUp = setTimeout(() => ctl.abort(), ASK_TIMEOUT_MS);
    const missed = () => {
      clearTimeout(giveUp);
      busy = false;
      if (stopped) return;
      onMiss?.();
      later();
    };
    fetch(UP_PATH, { cache: "no-store", signal: ctl.signal }).then((r) => {
      if (!r.ok) return missed();
      clearTimeout(giveUp);
      busy = false;
      if (stopped) return;
      stop();
      go();
    }, missed);
  }
  function nudge() {
    if (stopped || busy || document.visibilityState === "hidden") return;
    clearTimeout(timer);
    check();
  }
  function stop() {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("online", nudge);
    window.removeEventListener("pageshow", nudge);
    document.removeEventListener("visibilitychange", nudge);
  }
  window.addEventListener("online", nudge);
  window.addEventListener("pageshow", nudge);
  document.addEventListener("visibilitychange", nudge);
  check();
  return stop;
}

/**
 * Runs before the page's own code, inline in <head>. While the page first loads, a file the page was sent with (a
 * <script async> or a stylesheet under /_next/static/, as Next writes them into the HTML) that fails to arrive reloads
 * the page, once the site answers, under the same once-a-minute rule as useReloadCure; the minute starts at the reload
 * itself. A second failure inside the minute is reported, as the boundary does. The same when the page cannot have
 * started:
 * - Next's own fetch again of a file fails too, before React has taken the page: Next's start-up then fails with a
 *   ChunkLoadError that nothing catches, and no error page can show (review of 666b037, 15 November 2026: a line drop
 *   just after Next started, on the files every page shares, left the whole page dead, with no reload and no report).
 * - A file that failed before this script ran: it waits for the page's stylesheets before it runs, so it cannot hear
 *   a stylesheet, or a script that failed meanwhile (review of 666b037: an unstyled page, or /check's box that never
 *   woke, with no reload and no report). At the page's load, a stylesheet whose rules cannot be read came to nothing,
 *   and a script whose every download the browser timed came back empty (status 0, no bytes) never arrived. Only the
 *   site's own files: another site's stylesheet cannot be read either. A browser that does not time downloads that way
 *   is not asked.
 * - Eight seconds after everything else arrived, Next never started (window.next is set by its first file to run), or
 *   React never took the page.
 *
 * Left alone (review of 7c1faac, 15 November 2026):
 * - A file Next's runtime is already fetching again. Next watches the page's own files once it has started, and it
 *   removes a failed one before its single retry; so the check waits one task and acts only on a file still in the
 *   page. If Next's retry fails too, the error page cures it, or, before React has the page, the uncaught ChunkLoadError
 *   above. Reloading at once wiped what a buyer had typed, and the two cures together showed "Something went wrong" and
 *   alerted the managers for a failure that cured itself.
 * - A phone too old to run Next's code at all (before Safari 16.4 or Chrome 94, such as an iPhone 6s, 7 or SE on
 *   iOS 15): its page reads fine without the code. It was reloading itself after eight seconds, and reporting every
 *   page view as a new incident. A class with a static block is the newest thing Next's own code uses.
 * - The browser's own Stop button, which fails the files still downloading: the document is then complete, and no load
 *   event follows.
 * - Files that Next asks for later (a page opened after this one): only files in the page's own HTML, and only until
 *   the page has loaded. Search engines' renderers are left alone too.
 *
 * It also notes when any file of the site's code fails (CHUNK_FAILED_AT), and forgets a reload that never happened: a
 * visitor who goes Back while it is on its way stays on the page, and a later missing piece is cured again rather than
 * left on "One moment…" (review of 666b037).
 */
export const CHUNK_CURE_SCRIPT = `(function(){
try{Function("class A{static{}}")}catch(e){return}
var KEY=${JSON.stringify(CURE_KEY)},WINDOW=${CURE_WINDOW_MS},FLAG=${JSON.stringify(RELOADING_FLAG)},FAILED=${JSON.stringify(CHUNK_FAILED_AT)};
if(/bot\\/|crawler|spider|slurp|inspectiontool|lighthouse/i.test(navigator.userAgent))return;
var OURS='script[async][src*="/_next/static/"],link[rel="stylesheet"][data-precedence][href*="/_next/static/"]';
var sent=null,loaded=false,leaving=false,acted=false;
function ours(t){
try{if(!t||t.nodeType!==1||!t.matches(OURS))return false}catch(e){return false}
if(!sent)return true;
for(var i=0;i<sent.length;i++)if(sent[i]===t)return true;
return false}
function reactHasPage(){return Object.keys(document).some(function(k){return k.indexOf("__reactContainer$")===0})}
function report(what){
try{fetch("/api/ops/client-error",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:JSON.stringify({message:("A file of the page failed to arrive while it first loaded, again within a minute of reloading itself: "+what).slice(0,500),path:location.pathname.slice(0,300)})}).catch(function(){})}catch(e){}}
function whenSiteAnswers(go){
var since=Date.now(),busy=false,done=false,timer;
function later(){clearTimeout(timer);if(!done)timer=setTimeout(check,Date.now()-since<${RETRY_FAST_FOR_MS}?${RETRY_MS}:${RETRY_SLOW_MS})}
function check(){
if(done||busy)return;
if(leaving||document.visibilityState==="hidden"||navigator.onLine===false){later();return}
busy=true;
var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},${ASK_TIMEOUT_MS});
fetch(${JSON.stringify(UP_PATH)},{cache:"no-store",signal:ctl.signal}).then(function(r){clearTimeout(t);busy=false;if(r.ok&&!leaving){done=true;go()}else later()},function(){clearTimeout(t);busy=false;later()})}
function nudge(){if(!done&&!busy&&document.visibilityState!=="hidden"){clearTimeout(timer);check()}}
addEventListener("online",nudge);addEventListener("pageshow",nudge);document.addEventListener("visibilitychange",nudge);
check()}
function cure(what){
if(acted||leaving)return;
acted=true;
var last;
try{last=Number(sessionStorage.getItem(KEY)||0)}catch(e){report(what);return}
if(Date.now()-last<=WINDOW){report(what);return}
whenSiteAnswers(function(){
if(leaving)return;
try{sessionStorage.setItem(KEY,String(Date.now()))}catch(e){report(what);return}
window[FLAG]=true;
location.reload()})}
addEventListener("error",function(e){var t=e.target;
if(t&&(t.tagName==="SCRIPT"||t.tagName==="LINK")&&String(t.src||t.href||"").indexOf("/_next/static/")>=0)window[FAILED]=Date.now();
if(!loaded&&document.readyState!=="complete"&&ours(t))setTimeout(function(){if(t.isConnected)cure(t.src||t.href)},0)},true);
addEventListener("unhandledrejection",function(e){var r=e.reason;if(!r||reactHasPage())return;var m=String(r.name||"")+" "+String(r.message||"");if(/ChunkLoadError|Failed to load chunk|Loading (CSS )?chunk/i.test(m))cure(String(r.message||r.name))});
document.addEventListener("DOMContentLoaded",function(){sent=document.querySelectorAll(OURS)});
addEventListener("pagehide",function(){leaving=true});
addEventListener("pageshow",function(){leaving=false});
addEventListener("popstate",function(){if(window[FLAG]){window[FLAG]=false;try{sessionStorage.removeItem(KEY)}catch(e){}}});
addEventListener("load",function(){loaded=true;
var R=[];try{R=performance.getEntriesByType("resource")}catch(e){}
function arrived(u){var any=false;for(var j=0;j<R.length;j++){var r=R[j];if(r.name!==u)continue;if(typeof r.responseStatus!=="number")return true;if(r.responseStatus!==0||r.decodedBodySize>0)return true;any=true}return !any}
for(var i=0;sent&&i<sent.length;i++){var l=sent[i],u=l.src||l.href,bad=false;
if(!l.isConnected||typeof u!=="string"||u.indexOf(location.origin+"/")!==0)continue;
if(l.tagName==="LINK"){try{bad=!l.sheet||!l.sheet.cssRules}catch(e){bad=true}}else bad=!arrived(u);
if(bad){cure(u);break}}
setTimeout(function(){if(!window.next)cure("Next never started");else if(!reactHasPage())cure("React never took the page")},8000)});
})();`;
