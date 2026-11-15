/**
 * A piece of the site's code that did not arrive (a phone's connection dropped while it downloaded, or a page was open
 * across an update) is cured by loading the page again, once. Two places do it, sharing this key and window:
 *
 * - After the first load, a missing piece throws a ChunkLoadError, which lands in app/error.tsx or global-error.tsx and
 *   their useReloadCure (components/site/ErrorReport.tsx).
 * - During the first load nothing throws: a file of the page's own that fails before Next's runtime is watching it
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
/** A small answer from the site itself, never cached: proof that a reload will land. */
const HEALTH_PATH = "/api/health";
/** How often to ask again while the site does not answer, and for how long (then the page stays as it is). */
const RETRY_MS = 5_000;
const RETRY_FOR_MS = 10 * 60_000;

/**
 * Runs `go` once the site answers: at once if it does now, otherwise after the phone is back online and then every few
 * seconds, for up to ten minutes. `cancelled` stops it (the page is leaving, or the screen asking went away).
 */
export function whenSiteAnswers(go: () => void, cancelled: () => boolean = () => false): void {
  const until = Date.now() + RETRY_FOR_MS;
  const check = () => {
    if (cancelled()) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6_000);
    fetch(HEALTH_PATH, { cache: "no-store", signal: ctl.signal }).then(
      (r) => {
        clearTimeout(timer);
        if (r.ok) go();
        else later();
      },
      () => {
        clearTimeout(timer);
        later();
      },
    );
  };
  const later = () => {
    if (!cancelled() && Date.now() < until) setTimeout(check, RETRY_MS);
  };
  if (navigator.onLine === false) window.addEventListener("online", check, { once: true });
  else check();
}

/**
 * Runs before the page's own code, inline in <head>. While the page first loads, a file the page was sent with (a
 * <script async> or a stylesheet under /_next/static/, as Next writes them into the HTML) that fails to arrive reloads
 * the page, once the site answers, under the same once-a-minute rule as useReloadCure; the minute starts at the reload
 * itself. A second failure inside the minute is reported, as the boundary does. And if Next itself never started
 * (window.next is set by its first file to run) eight seconds after everything else arrived, the same: a failure this
 * script came too late to see, because an inline script waits for the page's stylesheets before it runs.
 *
 * Left alone (review of 7c1faac, 15 November 2026):
 * - A file Next's runtime is already fetching again. Next watches the page's own files once it has started, and it
 *   removes a failed one before its single retry; so the check waits one task and acts only on a file still in the
 *   page. If Next's retry fails too, the error boundary cures it. Reloading at once wiped what a buyer had typed, and
 *   the two cures together showed "Something went wrong" and alerted the managers for a failure that cured itself.
 * - A phone too old to run Next's code at all (before Safari 16.4 or Chrome 94, such as an iPhone 6s, 7 or SE on
 *   iOS 15): its page reads fine without the code. It was reloading itself after eight seconds, and reporting every
 *   page view as a new incident. A class with a static block is the newest thing Next's own code uses.
 * - The browser's own Stop button, which fails the files still downloading: the document is then complete.
 * - Files that Next asks for later (a page opened after this one): only files in the page's own HTML, and only until
 *   the page has loaded. Search engines' renderers are left alone too.
 */
export const CHUNK_CURE_SCRIPT = `(function(){
try{Function("class A{static{}}")}catch(e){return}
var KEY=${JSON.stringify(CURE_KEY)},WINDOW=${CURE_WINDOW_MS},FLAG=${JSON.stringify(RELOADING_FLAG)};
if(/bot\\/|crawler|spider|slurp|inspectiontool|lighthouse/i.test(navigator.userAgent))return;
var OURS='script[async][src*="/_next/static/"],link[rel="stylesheet"][data-precedence][href*="/_next/static/"]';
var sent=null,loaded=false,leaving=false,acted=false;
function ours(t){
try{if(!t||t.nodeType!==1||!t.matches(OURS))return false}catch(e){return false}
if(!sent)return true;
for(var i=0;i<sent.length;i++)if(sent[i]===t)return true;
return false}
function report(what){
try{fetch("/api/ops/client-error",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:JSON.stringify({message:("A file of the page failed to arrive while it first loaded, again within a minute of reloading itself: "+what).slice(0,500),path:location.pathname.slice(0,300)})}).catch(function(){})}catch(e){}}
function whenSiteAnswers(go){
var until=Date.now()+${RETRY_FOR_MS};
function check(){
if(leaving)return;
var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort()},6000);
fetch(${JSON.stringify(HEALTH_PATH)},{cache:"no-store",signal:ctl.signal}).then(function(r){clearTimeout(timer);if(r.ok)go();else later()},function(){clearTimeout(timer);later()})}
function later(){if(!leaving&&Date.now()<until)setTimeout(check,${RETRY_MS})}
if(navigator.onLine===false)addEventListener("online",check,{once:true});else check()}
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
addEventListener("error",function(e){var t=e.target;if(!loaded&&document.readyState!=="complete"&&ours(t))setTimeout(function(){if(t.isConnected)cure(t.src||t.href)},0)},true);
document.addEventListener("DOMContentLoaded",function(){sent=document.querySelectorAll(OURS)});
addEventListener("pagehide",function(){leaving=true});
addEventListener("pageshow",function(){leaving=false});
addEventListener("load",function(){loaded=true;setTimeout(function(){if(!window.next)cure("Next never started")},8000)});
})();`;
