/**
 * A piece of the site's code that did not arrive (a phone's connection dropped while it downloaded, or a page was open
 * across an update) is cured by loading the page again, once. Two places do it, sharing this key and window:
 *
 * - After the first load, a missing piece throws a ChunkLoadError, which lands in app/error.tsx or global-error.tsx and
 *   their useReloadCure (components/site/ErrorReport.tsx).
 * - During the first load nothing throws: a file of the page's own that fails before Next's runtime is watching it
 *   leaves that part of the page dead, with no error at all (review of f092009, 14 November 2026: /contact's form and a
 *   car page's Chat with seller never woke). CHUNK_CURE_SCRIPT, inline in app/layout.tsx's <head>, watches
 *   for that.
 */

/** When the page last reloaded itself for a missing piece, kept for the tab's life only. */
export const CURE_KEY = "sc_chunk_reload";
/** A second missing piece this soon after the reload is not a dropped download: it is reported. */
export const CURE_WINDOW_MS = 60_000;

/**
 * Runs before the page's own code, inline in <head>. While the page first loads, a file the page was
 * sent with (a <script async> or a stylesheet under /_next/static/, as Next writes them into the HTML) that fails to
 * arrive reloads the page, under the same once-a-minute rule as useReloadCure; offline, it waits to be back online.
 * A second failure inside the minute is reported, as the boundary does. And if Next itself never started (window.next
 * is set by its first file to run) eight seconds after everything else arrived, the same: a failure this script came
 * too late to see, because an inline script waits for the page's stylesheets before it runs.
 *
 * Files that Next asks for later (a page opened after this one) are left to Next's own retry and to the boundary:
 * only files in the page's own HTML, and only until the page has loaded. Search engines' renderers are left alone.
 */
export const CHUNK_CURE_SCRIPT = `(function(){
var KEY=${JSON.stringify(CURE_KEY)},WINDOW=${CURE_WINDOW_MS};
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
function cure(what){
if(acted||leaving)return;
acted=true;
var last;
try{last=Number(sessionStorage.getItem(KEY)||0)}catch(e){report(what);return}
if(Date.now()-last<=WINDOW){report(what);return}
try{sessionStorage.setItem(KEY,String(Date.now()))}catch(e){report(what);return}
if(navigator.onLine===false)addEventListener("online",function(){location.reload()},{once:true});
else location.reload()}
addEventListener("error",function(e){var t=e.target;if(!loaded&&ours(t))cure(t.src||t.href)},true);
document.addEventListener("DOMContentLoaded",function(){sent=document.querySelectorAll(OURS)});
addEventListener("pagehide",function(){leaving=true});
addEventListener("pageshow",function(){leaving=false});
addEventListener("load",function(){loaded=true;setTimeout(function(){if(!window.next)cure("Next never started")},8000)});
})();`;
