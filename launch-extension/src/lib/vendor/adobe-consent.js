/*! adobe-consent v1.0.0 | MIT | Adobe-native cookie consent management */
"use strict";var _=Object.defineProperty;var ge=Object.getOwnPropertyDescriptor;var fe=Object.getOwnPropertyNames;var me=Object.prototype.hasOwnProperty;var ye=(o,e)=>{for(var t in e)_(o,t,{get:e[t],enumerable:!0})},be=(o,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of fe(e))!me.call(o,i)&&i!==t&&_(o,i,{get:()=>e[i],enumerable:!(n=ge(e,i))||n.enumerable});return o};var ve=o=>be(_({},"__esModule",{value:!0}),o);var De={};ye(De,{AnalyticsAdapter:()=>m,AutoBlocker:()=>w,ConsentBanner:()=>A,ConsentEngine:()=>k,ConsentManager:()=>T,DEFAULT_CATEGORIES:()=>D,DEFAULT_CONFIG:()=>P,DEFAULT_MAPPING:()=>L,DEFAULT_REGIONS:()=>H,DEFAULT_TEXT:()=>N,DataLayerAdapter:()=>y,LaunchAdapter:()=>b,OPT_IN_CATEGORIES:()=>O,OptInAdapter:()=>v,WebSdkAdapter:()=>x,attachAdobe:()=>I,create:()=>he,default:()=>Ie,init:()=>z,instance:()=>q});module.exports=ve(De);var L={collect:["analytics","personalization","advertising"],share:["advertising"],personalize:["personalization"],adId:["advertising"],analytics:["analytics"],target:["personalization"],audienceManager:["advertising"],ecid:["analytics","personalization","advertising"]};function h(o){return{...L,...o||{}}}function p(o,e){if(!o||o.length===0)return!1;for(let t of o)if(e[t]===!0)return!0;return!1}function R(o){return o?"y":"n"}var m=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}instance(){let e=this.opts.instanceGlobal||"s",t=window[e];return t&&typeof t=="object"?t:null}apply(e){let t=p(this.mapping.analytics,e),n=this.instance();if(!n){this.engine.log.log("AppMeasurement instance not found; nothing to gate");return}n.abort=!t,n.optOut=!t,this.engine.log.log("AppMeasurement analytics consent:",t?"granted":"denied")}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.apply(this.engine.decision)),this.engine.on("change",()=>this.apply(this.engine.decision)))}};var y=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}get name(){return this.opts.name||"adobeDataLayer"}queue(){let e=window;return Array.isArray(e[this.name])||(e[this.name]=[]),e[this.name]}buildPayload(e,t){let n=this.engine.getState();return{event:t,consent:{categories:{...e},granted:Object.keys(e).filter(i=>e[i]),denied:Object.keys(e).filter(i=>!e[i]),adobe:{collect:p(this.mapping.collect,e),share:p(this.mapping.share,e),personalize:p(this.mapping.personalize,e),adId:p(this.mapping.adId,e),analytics:p(this.mapping.analytics,e),target:p(this.mapping.target,e),audienceManager:p(this.mapping.audienceManager,e)},method:n==null?void 0:n.method,region:this.engine.region,model:this.engine.model,policyVersion:n==null?void 0:n.policyVersion,receiptId:n==null?void 0:n.id,timestamp:n==null?void 0:n.timestamp,pending:this.engine.isPending()}}}push(e,t){let n=t||this.opts.eventName||"consent-updated";try{this.queue().push(this.buildPayload(e,n)),this.engine.log.log('pushed "'+n+'" to '+this.name)}catch(i){this.engine.log.error("data layer push failed",i)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>{this.opts.pushOnLoad!==!1&&this.push(this.engine.decision,"consent-loaded")}),this.engine.on("change",()=>this.push(this.engine.decision)))}};var b=class{constructor(e,t={}){this.retries=0;this.engine=e,this.opts=t}get satellite(){let e=window._satellite;return e&&typeof e.track=="function"?e:null}detail(e){let t=this.engine.getState();return{consent:{...e},method:t==null?void 0:t.method,region:this.engine.region,model:this.engine.model,receiptId:t==null?void 0:t.id,pending:this.engine.isPending()}}fire(e){let t=this.satellite;if(!t){this.retries<20?(this.retries++,window.setTimeout(()=>this.fire(e),250)):this.engine.log.warn("_satellite never appeared; direct call rules not fired");return}this.retries=0;let n=this.opts.directCallId||"adobe-consent-changed";try{if(t.track(n,this.detail(e)),this.engine.log.log('_satellite.track("'+n+'")'),this.opts.perCategoryDirectCalls)for(let i of Object.keys(e)){let s=e[i]?"granted":"denied";t.track("consent-"+i+"-"+s,this.detail(e))}}catch(i){this.engine.log.error("_satellite.track failed",i)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.fire(this.engine.decision)),this.engine.on("change",()=>this.fire(this.engine.decision)))}};var O={ECID:"ecid",ANALYTICS:"aa",TARGET:"target",AUDIENCE_MANAGER:"aam",AD_CLOUD:"adcloud",CAMPAIGN:"campaign",LIVEFYRE:"livefyre",MEDIA_ANALYTICS:"mediaaa"},v=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}get api(){let e=window.adobe;return e&&e.optIn?e.optIn:null}category(e){var s;let t=(s=window.adobe)==null?void 0:s.OptInCategories;return(t?t[e==="AUDIENCE_MANAGER"?"AAM":e]:void 0)||O[e]}known(e){var i;let t=(i=window.adobe)==null?void 0:i.OptInCategories;if(!t)return e;let n={};for(let s of Object.keys(t)){let r=t[s];r&&(n[r]=!0)}return e.filter(s=>n[s]===!0)}buildPermissions(e){let t=[["ECID",p(this.mapping.ecid,e)],["ANALYTICS",p(this.mapping.analytics,e)],["TARGET",p(this.mapping.target,e)],["AUDIENCE_MANAGER",p(this.mapping.audienceManager,e)]],n=[],i=[];for(let[s,r]of t)(r?n:i).push(this.category(s));return{approve:n,deny:i}}send(e){let t=this.api;if(!t){this.engine.log.warn('adobe.optIn not found; is "Enable Opt-In" on in the ECID extension?');return}let n=this.buildPermissions(e),i=this.known(n.approve),s=this.known(n.deny);try{i.length&&t.approve(i,!0),s.length&&this.opts.denyUnconsented!==!1&&t.deny(s,!0),t.complete(),this.engine.log.log("optIn approved:",i,"denied:",s)}catch(r){this.engine.log.error("adobe.optIn call failed",r)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.send(this.engine.decision)),this.engine.on("change",()=>this.send(this.engine.decision)))}};var x=class{constructor(e,t={},n){this.engine=e,this.opts={standardVersion:"2.0",sendOnEveryPageLoad:!0,...t},this.mapping=h(n)}getInstanceNames(){var t;if((t=this.opts.instanceNames)!=null&&t.length)return this.opts.instanceNames;let e=window;return Array.isArray(e.__alloyNS)&&e.__alloyNS.length?e.__alloyNS.slice():typeof e.alloy=="function"?["alloy"]:[]}buildPayload(e){if(this.opts.standardVersion==="1.0")return[{standard:"Adobe",version:"1.0",value:{general:p(this.mapping.collect,e)?"in":"out"}}];let t={collect:{val:R(p(this.mapping.collect,e))},share:{val:R(p(this.mapping.share,e))},personalize:{content:{val:R(p(this.mapping.personalize,e))}},metadata:{time:new Date().toISOString()}};return this.opts.adIdType&&(t.adID={idType:this.opts.adIdType,val:R(p(this.mapping.adId,e))}),[{standard:"Adobe",version:"2.0",value:t}]}send(e){let t=this.getInstanceNames();if(t.length===0){this.engine.log.warn("Web SDK not found on the page; skipping setConsent");return}let n={consent:this.buildPayload(e)};this.opts.identityMap&&(n.identityMap=this.opts.identityMap);for(let i of t){let s=window[i];if(typeof s!="function"){this.engine.log.warn('alloy instance "'+i+'" is not callable');continue}try{let r=s("setConsent",n);this.engine.log.log("setConsent ->",i,n),r&&typeof r.catch=="function"&&r.catch(a=>{this.engine.log.error("setConsent rejected for "+i,a)})}catch(r){this.engine.log.error("setConsent threw for "+i,r)}}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>{this.opts.sendOnEveryPageLoad!==!1&&this.send(this.engine.decision)}),this.engine.on("change",()=>this.send(this.engine.decision)))}};function I(o,e={}){let t=e.mapping,n={webSdk:new x(o,e.webSdk||{},t),optIn:new v(o,e.optIn||{},t),analytics:new m(o,e.analytics||{},t),dataLayer:new y(o,e.dataLayer||{},t),launch:new b(o,e.launch||{})};return n.webSdk.attach(),n.optIn.attach(),n.analytics.attach(),n.dataLayer.attach(),n.launch.attach(),n}var V="data-cc-category",M="data-cc-src",K="data-cc-unblocked",C="ac-embed-placeholder",w=class{constructor(e,t={}){this.observer=null;this.styleInjected=!1;this.engine=e,this.opts=t}start(){this.sweep(),this.engine.on("ready",()=>this.sweep()),this.engine.on("change",()=>this.sweep()),typeof MutationObserver=="function"&&document.documentElement&&(this.observer=new MutationObserver(e=>{for(let t of e)if(t.addedNodes.length){this.sweep();return}}),this.observer.observe(document.documentElement,{childList:!0,subtree:!0}))}stop(){var e;(e=this.observer)==null||e.disconnect(),this.observer=null}sweep(){if(typeof document=="undefined")return;let e=document.querySelectorAll("["+V+"]:not(["+K+"])");for(let t=0;t<e.length;t++){let n=e[t],i=n.getAttribute(V);i&&(this.engine.hasConsent(i)?this.unblock(n,i):n.tagName==="IFRAME"&&this.opts.placeholders!==!1&&this.showPlaceholder(n,i))}}unblock(e,t){if(e.setAttribute(K,"true"),this.removePlaceholder(e),e.tagName==="SCRIPT"){this.reviveScript(e);return}let n=e.getAttribute(M);n&&(e.setAttribute("src",n),e.removeAttribute(M)),this.engine.log.log("unblocked",e.tagName.toLowerCase(),"for",t)}reviveScript(e){var s;let t=document.createElement("script");for(let r=0;r<e.attributes.length;r++){let a=e.attributes[r];a.name==="type"||a.name===M||t.setAttribute(a.name,a.value)}let n=e.getAttribute(M);n?t.src=n:e.src&&(t.src=e.src),!t.src&&e.textContent&&(t.textContent=e.textContent);let i=e.getAttribute("data-cc-type");i&&(t.type=i),(s=e.parentNode)==null||s.insertBefore(t,e.nextSibling),e.remove(),this.engine.log.log("unblocked script",t.src||"(inline)")}injectStyle(){var t;if(this.styleInjected||typeof document=="undefined")return;let e=document.createElement("style");e.setAttribute("data-adobe-consent","placeholder"),e.textContent=`
.${C}{display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:10px;min-height:150px;padding:20px;text-align:center;background:#f3f4f6;color:#374151;
border:1px solid #e5e7eb;border-radius:8px;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}
.${C} button{font:inherit;font-weight:600;padding:9px 16px;border-radius:999px;
border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;min-height:40px;}
.${C} button:hover{background:rgba(0,0,0,.05);}
@media (prefers-color-scheme:dark){.${C}{background:#1f2937;color:#e5e7eb;border-color:#374151;}}
`.trim(),(t=document.head)==null||t.appendChild(e),this.styleInjected=!0}showPlaceholder(e,t){var a,d,l;if((d=(a=e.previousElementSibling)==null?void 0:a.classList)!=null&&d.contains(C))return;this.injectStyle();let n=this.engine.getCategories().filter(u=>u.id===t).map(u=>u.label)[0]||t,i=document.createElement("div");i.className=C,i.setAttribute("data-cc-placeholder-for",t);let s=document.createElement("p");s.style.margin="0",s.textContent=this.opts.placeholderText?this.opts.placeholderText(n):"This content is hidden because "+n.toLowerCase()+" cookies are turned off.";let r=document.createElement("button");r.type="button",r.textContent=this.opts.placeholderButton||"Allow and show",r.addEventListener("click",()=>{let u={};u[t]=!0,this.engine.update(u)}),i.appendChild(s),i.appendChild(r),e.style.display="none",(l=e.parentNode)==null||l.insertBefore(i,e)}removePlaceholder(e){var n;let t=e.previousElementSibling;(n=t==null?void 0:t.classList)!=null&&n.contains(C)&&(t.remove(),e.style.removeProperty("display"))}};var D=[{id:"essential",label:"Essential",summary:"always on",description:"Required for the site to function \u2014 security, load balancing, remembering your privacy choices, and keeping you signed in. These cannot be switched off.",required:!0,defaultGranted:!0},{id:"analytics",label:"Analytics",summary:"understand usage",description:"Helps us measure how the site performs \u2014 which pages are visited, where errors happen, and what to fix next. Reported in aggregate.",defaultGranted:!1},{id:"personalization",label:"Personalization",summary:"tailored content",description:"Lets us remember your preferences and tailor the content and offers you see, rather than showing everyone the same thing.",defaultGranted:!1},{id:"advertising",label:"Advertising",summary:"relevant offers",description:"Used to build an advertising profile and show you more relevant offers on this site and elsewhere. May involve sharing data with advertising partners.",defaultGranted:!1}],N={title:"Your privacy choices",body:"We use cookies and similar technologies to run this site, measure how it performs, personalize your experience, and tailor offers. Choose what you are comfortable with \u2014 essential cookies are always on.",acceptAll:"Accept all",rejectAll:"Reject all",save:"Save choices",preferences:"Privacy choices",close:"Close",privacyPolicy:"Privacy policy",ariaLabel:"Privacy and cookie preferences",savedAnnouncement:"Your privacy choices have been saved.",detailsShow:"Details",detailsHide:"Hide details",cookieTableName:"Name",cookieTableProvider:"Provider",cookieTablePurpose:"Purpose",cookieTableDuration:"Duration"},H=[{match:["EU","EEA","GB","UK","CH","AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","BR"],model:"opt_in"},{match:["US","US-CA","US-CO","US-CT","US-VA","US-UT","US-TX","US-OR","US-MT","US-DE","US-IA","US-NE","US-NH","US-NJ","US-TN","US-MN","US-MD","US-RI","US-KY","US-IN","CA"],model:"opt_out",defaultGranted:["essential","analytics","personalization","advertising"]},{match:["*"],model:"opt_in"}],P={policyVersion:1,categories:D,model:"opt_in",regions:H,storage:{},ui:{layout:"modal",position:"center",blocking:!0,showBadge:!0,badgePosition:"bottom-left",categoriesOnFirstLayer:!0,lang:"en"},adobe:{},receipt:{enabled:!0,historySize:10},honorGpc:!0,honorDnt:!1,autoBlock:!0,reconsentDays:365,debug:!1,autoInit:!0};var Y="region";function xe(o,e){let t=(o||"").toUpperCase(),n=t.split("-")[0]||"",i=null,s=null,r=null;for(let a of e)for(let d of a.match){let l=d.toUpperCase();l==="*"?r||(r=a):l===t?i||(i=a):l===n&&(s||(s=a))}return i||s||r}function $(o,e,t){let n=xe(o,e);return{region:o,model:n?n.model:t,defaultGranted:n!=null&&n.defaultGranted?n.defaultGranted.slice():[],suppressBanner:!!(n!=null&&n.suppressBanner)}}function Ce(o){if(typeof document=="undefined")return null;let e=document.querySelector('meta[name="'+o+'"]'),t=e==null?void 0:e.getAttribute("content");return t?t.trim():null}function J(o,e){var r;let t=o.fallbackRegion||"EU";if(o.region)return{immediate:o.region,pending:null};if(o.metaTagName){let a=Ce(o.metaTagName);if(a)return{immediate:a,pending:null}}let n=e.getItem(Y);if(n)try{let a=JSON.parse(n);if(a&&a.expires>Date.now()&&a.region)return{immediate:a.region,pending:null}}catch{}if(!o.endpoint||typeof fetch=="undefined")return{immediate:t,pending:null};let i=(r=o.cacheMinutes)!=null?r:720,s=fetch(o.endpoint,{credentials:"omit",mode:"cors"}).then(a=>a.ok?a.json():null).then(a=>{if(!a)return t;let d=a.region||a.regionCode||(a.country&&a.subdivision?a.country+"-"+a.subdivision:a.country)||t;return e.setItem(Y,JSON.stringify({region:d,expires:Date.now()+i*6e4})),d}).catch(()=>t);return{immediate:t,pending:s}}function Q(){let o=typeof crypto!="undefined"?crypto:void 0;if(o&&typeof o.randomUUID=="function")return o.randomUUID();if(o&&typeof o.getRandomValues=="function"){let e=o.getRandomValues(new Uint8Array(16)),t="";for(let n=0;n<e.length;n++)t+=(e[n]+256).toString(16).slice(1);return t}return Date.now().toString(36)+Math.random().toString(36).slice(2,10)}function X(o){let e=2166136261;for(let t=0;t<o.length;t++)e^=o.charCodeAt(t),e=e+((e<<1)+(e<<4)+(e<<7)+(e<<8)+(e<<24))>>>0;return("00000000"+e.toString(16)).slice(-8)}function F(){return typeof window!="undefined"&&typeof document!="undefined"}function Z(o){F()&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o())}function ee(o,e="[adobe-consent]"){let t=()=>{};return!o||typeof console=="undefined"?{log:t,warn:t,error:t,group:t}:{log:(...n)=>console.log(e,...n),warn:(...n)=>console.warn(e,...n),error:(...n)=>console.error(e,...n),group:(n,i)=>{console.groupCollapsed(e+" "+n),i(),console.groupEnd()}}}function j(o,e){if(!e)return{...o};let t={...o};for(let n of Object.keys(e)){let i=e[n];if(i===void 0)continue;let s=t[n],r=i&&typeof i=="object"&&!Array.isArray(i)&&s&&typeof s=="object"&&!Array.isArray(s);t[n]=r?j(s,i):i}return t}var B="receipts";function te(o,e,t){let n={id:o.id,timestamp:o.timestamp,policyVersion:o.policyVersion,categories:{...o.categories},method:o.method,region:o.region,gpc:o.gpc};return typeof location!="undefined"&&(n.url=location.href),typeof document!="undefined"&&document.referrer&&(n.referrer=document.referrer),typeof navigator!="undefined"&&(n.language=navigator.language,n.userAgent=navigator.userAgent),e.includeCopy&&t&&(n.copy=t),n.digest=X(JSON.stringify(n)),n}function ne(o,e){let t=JSON.stringify(o);try{if(typeof navigator!="undefined"&&typeof navigator.sendBeacon=="function"){let n=new Blob([t],{type:"application/json"});if(navigator.sendBeacon(e,n))return!0}}catch{}try{if(typeof fetch=="function")return fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:t,keepalive:!0,credentials:"omit"}).catch(()=>{}),!0}catch{}return!1}function ie(o,e,t){let n=[],i=t.getItem(B);if(i)try{let s=JSON.parse(i);Array.isArray(s)&&(n=s)}catch{n=[]}return n.push(o),n.length>e&&(n=n.slice(n.length-e)),t.setItem(B,JSON.stringify(n)),n}function oe(o){let e=o.getItem(B);if(!e)return[];try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}}function we(){return typeof navigator=="undefined"?!1:navigator.globalPrivacyControl===!0||typeof window!="undefined"&&window.globalPrivacyControl===!0}function ke(){if(typeof navigator=="undefined")return!1;let o=navigator,e=o.doNotTrack||(typeof window!="undefined"?window.doNotTrack:void 0)||o.msDoNotTrack;return e==="1"||e==="yes"}function re(o,e){return o&&we()?"gpc":e&&ke()?"dnt":null}var W="adobeConsent:",S={cookieName:"adobe_consent",cookiePath:"/",cookieSameSite:"Lax",expiryDays:365,useLocalStorage:!0};function se(o){let e={};for(let n of Object.keys(o.categories))e[n]=o.categories[n]?1:0;let t={v:1,pv:o.policyVersion,c:e,t:o.timestamp,m:o.method,id:o.id};return o.region&&(t.r=o.region),o.gpc&&(t.g=1),encodeURIComponent(JSON.stringify(t))}function ae(o){if(!o)return null;let e;try{e=JSON.parse(decodeURIComponent(o))}catch{return null}if(!e||typeof e!="object"||!e.c||typeof e.t!="number")return null;let t={};for(let n of Object.keys(e.c))t[n]=e.c[n]===1;return{schema:e.v||1,policyVersion:typeof e.pv=="number"?e.pv:1,categories:t,timestamp:e.t,method:e.m||"restored",id:e.id||"",region:e.r,gpc:e.g===1}}function Ae(o){if(typeof document=="undefined"||!document.cookie)return null;let e=o+"=";for(let t of document.cookie.split(";")){let n=t.trim();if(n.indexOf(e)===0)return n.substring(e.length)}return null}function ce(o,e,t){var d,l,u,E;if(typeof document=="undefined")return;let n=(d=t.expiryDays)!=null?d:S.expiryDays,i=new Date(Date.now()+n*864e5).toUTCString(),s=(l=t.cookieSameSite)!=null?l:S.cookieSameSite,r=(u=t.cookieSecure)!=null?u:s==="None"||typeof location!="undefined"&&location.protocol==="https:",a=o+"="+e+";expires="+i+";path="+((E=t.cookiePath)!=null?E:S.cookiePath)+";SameSite="+s;t.cookieDomain&&(a+=";domain="+t.cookieDomain),r&&(a+=";Secure"),document.cookie=a}function Ee(o,e){var n;if(typeof document=="undefined")return;let t=o+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path="+((n=e.cookiePath)!=null?n:"/");e.cookieDomain&&(t+=";domain="+e.cookieDomain),document.cookie=t}function le(o){try{return window.localStorage.getItem(W+o)}catch{return null}}function de(o,e){try{window.localStorage.setItem(W+o,e)}catch{}}function Se(o){try{window.localStorage.removeItem(W+o)}catch{}}var U=class{constructor(e={}){this.opts={...S,...e}}get cookieName(){var e;return(e=this.opts.cookieName)!=null?e:S.cookieName}read(){let e=ae(Ae(this.cookieName));if(e)return e;if(this.opts.useLocalStorage){let t=ae(le(this.cookieName));if(t)return ce(this.cookieName,se(t),this.opts),t}return null}write(e){let t=se(e);ce(this.cookieName,t,this.opts),this.opts.useLocalStorage&&de(this.cookieName,t)}clear(){Ee(this.cookieName,this.opts),this.opts.useLocalStorage&&Se(this.cookieName)}getItem(e){return le(e)}setItem(e,t){de(e,t)}isExpired(e,t){var i;let n=(i=t!=null?t:this.opts.expiryDays)!=null?i:S.expiryDays;return n?Date.now()-e.timestamp>n*864e5:!1}};var k=class{constructor(e={},t={}){this.listeners=new Map;this.gateQueue=new Map;this.state=null;this.effective={};this.started=!1;this.pendingDecision=!0;this.lastReceipt=null;var n,i,s;this.config=j(P,e),this.categories=(n=this.config.categories)!=null&&n.length?this.config.categories:D,this.storage=new U(this.config.storage),this.log=ee(!!this.config.debug),this.hooks=t,this.regionInfo={region:((i=this.config.geo)==null?void 0:i.region)||((s=this.config.geo)==null?void 0:s.fallbackRegion)||"EU",model:this.config.model||"opt_in",defaultGranted:[],suppressBanner:!1}}start(){if(this.started)return this.snapshot();this.started=!0;let e=J(this.config.geo||{},this.storage);this.applyRegion(e.immediate);let t=this.storage.read();if(t&&this.isStateValid(t)&&t)this.state=t,this.pendingDecision=!1,this.effective=this.withRequired(t.categories),this.log.log("restored decision",this.effective);else{t&&this.log.log("stored decision discarded (version bump or expiry)"),this.pendingDecision=!0,this.effective=this.defaultDecision();let i=re(!!this.config.honorGpc,!!this.config.honorDnt);i&&(this.log.log("honoring browser privacy signal:",i),this.commit(this.rejectedDecision(),i==="gpc"?"gpc":"dnt",{silent:!0,gpc:i==="gpc"}),this.pendingDecision=!1)}return this.emit("ready",this.snapshot()),this.flushGates(),this.config.onReady&&this.config.onReady(this.snapshot()),e.pending&&e.pending.then(i=>{i!==this.regionInfo.region&&(this.applyRegion(i),this.pendingDecision&&(this.effective=this.defaultDecision(),this.log.log("region resolved late:",i,this.regionInfo.model),this.emit("change",this.buildChangeEvent(null,!0)),this.flushGates()))}),this.snapshot()}applyRegion(e){this.regionInfo=$(e,this.config.regions||[],this.config.model||"opt_in")}isStateValid(e){var t;return!(e.policyVersion!==((t=this.config.policyVersion)!=null?t:1)||this.storage.isExpired(e,this.config.reconsentDays))}get decision(){return{...this.effective}}get region(){return this.regionInfo.region}get model(){return this.regionInfo.model}getCategories(){return this.categories}hasConsent(e){return this.effective[e]===!0}isPending(){return this.pendingDecision}getState(){return this.state?{...this.state,categories:{...this.state.categories}}:null}getReceipts(){return oe(this.storage)}getLastReceipt(){return this.lastReceipt}shouldPrompt(){var e;return(e=this.config.ui)!=null&&e.headless||this.regionInfo.suppressBanner||this.hooks.canShowUi&&!this.hooks.canShowUi()?!1:this.pendingDecision}acceptAll(){return this.commit(this.allDecision(!0),"accept_all")}rejectAll(){return this.commit(this.rejectedDecision(),"reject_all")}save(e,t="save_choices"){let n={};for(let i of this.categories)n[i.id]=i.required?!0:e[i.id]===!0;return this.commit(n,t)}update(e,t="programmatic"){return this.save({...this.effective,...e},t)}dismiss(){let e=this.regionInfo.model==="opt_in"?"reject_all":"implied_close",t=this.regionInfo.model==="opt_in"?this.rejectedDecision():this.defaultDecision();return this.commit(t,e)}reset(){this.storage.clear(),this.state=null,this.pendingDecision=!0;let e=this.snapshot();this.effective=this.defaultDecision(),this.log.log("consent reset"),this.emit("change",this.buildChangeEvent(e,!1))}commit(e,t,n={}){var d,l;let i=this.state?this.snapshot():null,s={...this.effective},r=this.withRequired(e),a={schema:1,policyVersion:(d=this.config.policyVersion)!=null?d:1,categories:r,timestamp:Date.now(),method:t,id:Q(),region:this.regionInfo.region,gpc:(l=n.gpc)!=null?l:void 0};return this.state=a,this.effective=r,this.pendingDecision=!1,this.storage.write(a),this.recordReceipt(a),this.log.log("decision committed:",t,r),n.silent||(this.emit("change",this.buildChangeEvent(i,!1,s)),this.config.onChange&&this.config.onChange(a,i)),this.flushGates(),this.snapshot()}recordReceipt(e){let t=this.config.receipt;if(!(t!=null&&t.enabled))return;let n=t.includeCopy&&this.hooks.getCopy?this.hooks.getCopy():void 0,i=te(e,t,n);this.lastReceipt=i,t.historySize&&t.historySize>0&&ie(i,t.historySize,this.storage),t.endpoint&&ne(i,t.endpoint)}gate(e,t){if(this.hasConsent(e))return this.runGuarded(t),()=>{};let n=this.gateQueue.get(e)||[];return n.push(t),this.gateQueue.set(e,n),()=>{let i=this.gateQueue.get(e);if(!i)return;let s=i.indexOf(t);s>=0&&i.splice(s,1)}}flushGates(){for(let[e,t]of this.gateQueue)if(!(!this.hasConsent(e)||t.length===0)){this.gateQueue.set(e,[]);for(let n of t)this.runGuarded(n)}}runGuarded(e){try{e()}catch(t){this.log.error("gated callback threw",t),this.emit("error",t)}}on(e,t){let n=this.listeners.get(e)||[];return n.push(t),this.listeners.set(e,n),()=>this.off(e,t)}off(e,t){let n=this.listeners.get(e);if(!n)return;let i=n.indexOf(t);i>=0&&n.splice(i,1)}emit(e,t){let n=this.listeners.get(e);if(n)for(let i of n.slice())try{i(t)}catch(s){this.log.error('listener for "'+e+'" threw',s)}if(typeof document!="undefined"&&typeof CustomEvent=="function")try{document.dispatchEvent(new CustomEvent("adobeConsent:"+e,{detail:t}))}catch{}}buildChangeEvent(e,t,n){let i=n||(e==null?void 0:e.categories)||{},s=[],r=[];for(let a of Object.keys(this.effective)){let d=i[a]===!0,l=this.effective[a]===!0;!d&&l&&s.push(a),d&&!l&&r.push(a)}return s.length&&this.emit("granted",s),r.length&&this.emit("revoked",r),{state:this.snapshot(),previous:e,granted:s,revoked:r,initial:t}}snapshot(){var e;return this.state?{...this.state,categories:{...this.state.categories}}:{schema:1,policyVersion:(e=this.config.policyVersion)!=null?e:1,categories:{...this.effective},timestamp:Date.now(),method:"region_default",id:"",region:this.regionInfo.region}}withRequired(e){let t={};for(let n of this.categories)t[n.id]=n.required?!0:e[n.id]===!0;return t}allDecision(e){let t={};for(let n of this.categories)t[n.id]=n.required?!0:e;return t}rejectedDecision(){return this.allDecision(!1)}defaultDecision(){let e={},t=this.regionInfo.model,n=this.regionInfo.defaultGranted;for(let i of this.categories)i.required?e[i.id]=!0:t==="opt_in"?e[i.id]=!1:n.length?e[i.id]=n.indexOf(i.id)>=0:e[i.id]=i.defaultGranted!==!1;return e}};function pe(o={}){let e={surface:o.surface||"#152238",surfaceAlt:o.surfaceAlt||"rgba(255, 255, 255, 0.055)",text:o.text||"#f2f6ff",textMuted:o.textMuted||"#c3cfe4",accent:o.accent||"linear-gradient(96deg, #8fe3e8 0%, #cfe98f 100%)",accentText:o.accentText||"#0d1a2e",border:o.border||"rgba(255, 255, 255, 0.22)",radius:o.radius||"18px",fontFamily:o.fontFamily||"system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",headingFontFamily:o.headingFontFamily||"Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",overlay:o.overlay||"rgba(6, 12, 24, 0.55)"};return`
:host {
  --ac-surface: ${e.surface};
  --ac-surface-alt: ${e.surfaceAlt};
  --ac-text: ${e.text};
  --ac-text-muted: ${e.textMuted};
  --ac-accent: ${e.accent};
  --ac-accent-text: ${e.accentText};
  --ac-border: ${e.border};
  --ac-radius: ${e.radius};
  --ac-font: ${e.fontFamily};
  --ac-font-heading: ${e.headingFontFamily};
  --ac-overlay: ${e.overlay};
  --ac-focus: #ffffff;

  all: initial;
  font-family: var(--ac-font);
  color: var(--ac-text);
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after { box-sizing: border-box; }

.overlay {
  position: fixed;
  inset: 0;
  background: var(--ac-overlay);
  z-index: 2147483000;
  display: flex;
  padding: 20px;
  overflow-y: auto;
  animation: ac-fade 180ms ease-out;
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}
.overlay[data-blocking='false'] {
  background: transparent;
  pointer-events: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.overlay[data-blocking='false'] .panel { pointer-events: auto; }

.overlay[data-position='center'] { align-items: center; justify-content: center; }
.overlay[data-position='bottom'] { align-items: flex-end; justify-content: center; }
.overlay[data-position='top'] { align-items: flex-start; justify-content: center; }
.overlay[data-position='bottom-left'] { align-items: flex-end; justify-content: flex-start; }
.overlay[data-position='bottom-right'] { align-items: flex-end; justify-content: flex-end; }

.panel {
  background: var(--ac-surface);
  border-radius: var(--ac-radius);
  padding: 30px 32px 28px;
  width: 100%;
  max-width: 680px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.28);
  animation: ac-rise 220ms cubic-bezier(0.16, 1, 0.3, 1);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}
.panel[data-layout='bar'] { max-width: 1180px; }
.panel[data-layout='box'] { max-width: 440px; }

h2.title {
  font-family: var(--ac-font-heading);
  font-size: 27px;
  line-height: 1.2;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--ac-text);
  letter-spacing: -0.01em;
}

p.body {
  font-size: 15.5px;
  line-height: 1.58;
  margin: 0 0 20px;
  color: var(--ac-text-muted);
}
p.body a {
  color: var(--ac-text);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.categories {
  background: var(--ac-surface-alt);
  border-radius: 12px;
  padding: 18px 20px;
  margin: 0 0 22px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.category { display: block; }
.category + .category { margin-top: 4px; }

.row-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 7px 0;
  cursor: pointer;
  font-size: 15.5px;
  line-height: 1.45;
  color: var(--ac-text);
  flex: 1;
}
.row.locked { cursor: default; }

input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  border: 1.5px solid var(--ac-border);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  flex: 0 0 auto;
  cursor: pointer;
  display: grid;
  place-content: center;
  transition: background-color 120ms ease, border-color 120ms ease;
}
input[type='checkbox']::after {
  content: '';
  width: 10px;
  height: 10px;
  transform: scale(0);
  transition: transform 110ms cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: inset 1em 1em #0d1a2e;
  clip-path: polygon(14% 44%, 0 65%, 40% 100%, 100% 16%, 82% 0%, 37% 70%);
}
input[type='checkbox']:checked::after { transform: scale(1); }
input[type='checkbox']:disabled {
  background: rgba(255, 255, 255, 0.42);
  cursor: default;
}
input[type='checkbox']:disabled::after { box-shadow: inset 1em 1em #55607a; }

.switch input[type='checkbox'] {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  border-color: transparent;
  position: relative;
  place-content: initial;
}
.switch input[type='checkbox']::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: none;
  clip-path: none;
  transform: none;
  transition: left 140ms cubic-bezier(0.16, 1, 0.3, 1);
}
.switch input[type='checkbox']:checked { background: #8fe3e8; }
.switch input[type='checkbox']:checked::after { left: 19px; transform: none; }

.label-text { flex: 1; }
.label-text .name { font-weight: 500; }
.label-text .summary { color: var(--ac-text-muted); }

.details-toggle {
  appearance: none;
  background: none;
  border: 0;
  color: var(--ac-text-muted);
  font: inherit;
  font-size: 13px;
  padding: 2px 6px;
  margin: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 6px;
  flex: 0 0 auto;
}
.details-toggle:hover { color: var(--ac-text); }

.details {
  display: none;
  padding: 4px 0 12px 30px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ac-text-muted);
}
.details[data-open='true'] { display: block; }

table.cookies {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 12.5px;
}
table.cookies th, table.cookies td {
  text-align: left;
  padding: 6px 8px 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  vertical-align: top;
}
table.cookies th { font-weight: 600; color: var(--ac-text); }

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

button.action {
  appearance: none;
  font: inherit;
  font-size: 15.5px;
  font-weight: 600;
  border-radius: 999px;
  padding: 13px 26px;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: transform 110ms ease, box-shadow 140ms ease, opacity 140ms ease;
  min-height: 48px;
  flex: 0 1 auto;
}
button.action:hover { transform: translateY(-1px); }
button.action:active { transform: translateY(0); }

button.primary {
  background: var(--ac-accent);
  color: var(--ac-accent-text);
  box-shadow: 0 2px 10px rgba(143, 227, 232, 0.2);
}
button.secondary {
  background: transparent;
  color: var(--ac-text);
  border-color: var(--ac-text);
}
button.secondary:hover { background: rgba(255, 255, 255, 0.08); }

.link-row {
  margin: 16px 0 0;
  font-size: 13.5px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}
.link-row a {
  color: var(--ac-text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 4px;
}
.link-row a:hover { color: var(--ac-text); }

.badge {
  position: fixed;
  bottom: 18px;
  z-index: 2147482000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ac-surface);
  color: var(--ac-text);
  border: 1px solid var(--ac-border);
  border-radius: 999px;
  padding: 9px 16px;
  font-family: var(--ac-font);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  min-height: 40px;
}
.badge[data-position='bottom-left'] { left: 18px; }
.badge[data-position='bottom-right'] { right: 18px; }
.badge:hover { transform: translateY(-1px); }
.badge svg { width: 15px; height: 15px; flex: 0 0 auto; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:focus-visible {
  outline: 3px solid var(--ac-focus);
  outline-offset: 2px;
}

@keyframes ac-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ac-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .overlay, .panel { animation: none; }
  button.action:hover, .badge:hover { transform: none; }
  input[type='checkbox']::after, .switch input[type='checkbox']::after { transition: none; }
}

@media (max-width: 560px) {
  .overlay { padding: 0; align-items: flex-end; }
  .panel {
    border-radius: var(--ac-radius) var(--ac-radius) 0 0;
    padding: 24px 20px 20px;
    max-width: none;
    max-height: 92vh;
  }
  h2.title { font-size: 23px; }
  .actions { flex-direction: column-reverse; align-items: stretch; }
  button.action { width: 100%; }
}

@media (forced-colors: active) {
  .panel { border: 1px solid CanvasText; }
  button.action { border: 1px solid ButtonText; }
  input[type='checkbox'] { border: 1px solid CanvasText; }
}
${o.customCss||""}
`.trim()}var ue="adobe-consent-root";function c(o,e,t){let n=document.createElement(o);return e&&(n.className=e),t!==void 0&&(n.textContent=t),n}var A=class{constructor(e,t={}){this.host=null;this.shadow=null;this.overlay=null;this.panel=null;this.badge=null;this.liveRegion=null;this.inputs=new Map;this.visible=!1;this.mode="notice";this.lastFocused=null;this.keyHandler=null;this.inerted=[];this.engine=e,this.opts=t,this.text={...N,...t.text||{}}}ensureHost(){if(this.shadow)return this.shadow;let e=document.getElementById(ue);e&&e.remove();let t=c("div");t.id=ue,t.style.cssText="position:static;display:block;width:0;height:0;",this.opts.lang&&t.setAttribute("lang",this.opts.lang),(this.opts.root||document.body||document.documentElement).appendChild(t);let i=t.attachShadow({mode:"open"}),s=document.createElement("style");s.textContent=pe(this.opts.theme||{}),i.appendChild(s);let r=c("div","sr-only");return r.setAttribute("role","status"),r.setAttribute("aria-live","polite"),i.appendChild(r),this.host=t,this.shadow=i,this.liveRegion=r,i}renderCategory(e,t){var l,u;let n=c("div","category"),i=c("div","row-wrap"),s=c("label","row"+(e.required?" locked":"")),r=c("input");r.type="checkbox",r.checked=e.required?!0:t[e.id]===!0,r.disabled=!!e.required,r.setAttribute("data-category",e.id),e.required&&r.setAttribute("aria-disabled","true");let a=c("span","label-text");if(a.appendChild(c("span","name",e.label)),e.summary&&(a.appendChild(document.createTextNode(" \u2014 ")),a.appendChild(c("span","summary",e.summary))),s.appendChild(r),s.appendChild(a),i.appendChild(s),!!(e.description||(l=e.cookies)!=null&&l.length)){let E="ac-det-"+e.id,g=c("button","details-toggle",this.text.detailsShow||"Details");g.type="button",g.setAttribute("aria-expanded","false"),g.setAttribute("aria-controls",E);let f=c("div","details");f.id=E,f.setAttribute("data-open","false"),e.description&&f.appendChild(c("p",void 0,e.description)),(u=e.cookies)!=null&&u.length&&f.appendChild(this.renderCookieTable(e)),e.description&&r.setAttribute("aria-describedby",E),g.addEventListener("click",()=>{let G=f.getAttribute("data-open")==="true";f.setAttribute("data-open",G?"false":"true"),g.setAttribute("aria-expanded",G?"false":"true"),g.textContent=G?this.text.detailsShow||"Details":this.text.detailsHide||"Hide details"}),i.appendChild(g),n.appendChild(i),n.appendChild(f)}else n.appendChild(i);return this.inputs.set(e.id,r),n}renderCookieTable(e){let t=c("table","cookies"),n=c("thead"),i=c("tr");for(let r of[this.text.cookieTableName||"Name",this.text.cookieTableProvider||"Provider",this.text.cookieTablePurpose||"Purpose",this.text.cookieTableDuration||"Duration"]){let a=c("th",void 0,r);a.setAttribute("scope","col"),i.appendChild(a)}n.appendChild(i),t.appendChild(n);let s=c("tbody");for(let r of e.cookies||[]){let a=c("tr");a.appendChild(c("td",void 0,r.name)),a.appendChild(c("td",void 0,r.provider||"\u2014")),a.appendChild(c("td",void 0,r.purpose||"\u2014")),a.appendChild(c("td",void 0,r.duration||"\u2014")),s.appendChild(a)}return t.appendChild(s),t.setAttribute("aria-label",e.label+" cookies"),t}renderPanel(e){let t=this.engine.decision;this.inputs.clear();let n=c("div","overlay");n.setAttribute("data-position",this.opts.position||"center"),n.setAttribute("data-blocking",String(this.opts.blocking!==!1));let i=c("div","panel");i.setAttribute("data-layout",this.opts.layout||"modal"),i.setAttribute("role","dialog"),i.setAttribute("aria-modal",String(this.opts.blocking!==!1)),i.setAttribute("aria-labelledby","ac-title"),i.setAttribute("aria-describedby","ac-body"),this.text.ariaLabel&&i.setAttribute("aria-label",this.text.ariaLabel);let s=c("h2","title",this.text.title);s.id="ac-title",i.appendChild(s);let r=c("p","body",this.text.body);r.id="ac-body",i.appendChild(r);let a=this.opts.categoriesOnFirstLayer!==!1||e==="preferences";if(a){let l=c("div","categories");l.setAttribute("role","group"),l.setAttribute("aria-label","Cookie categories");for(let u of this.engine.getCategories())l.appendChild(this.renderCategory(u,t));i.appendChild(l)}i.appendChild(this.renderActions(a,e));let d=c("div","link-row");if(this.text.privacyPolicyUrl&&this.text.privacyPolicy){let l=c("a",void 0,this.text.privacyPolicy);l.href=this.text.privacyPolicyUrl,l.target="_blank",l.rel="noopener noreferrer",d.appendChild(l)}return this.text.poweredBy&&d.appendChild(c("span",void 0,this.text.poweredBy)),d.childNodes.length&&i.appendChild(d),n.appendChild(i),this.overlay=n,this.panel=i,n}renderActions(e,t){let n=c("div","actions"),i=c("button","action primary",this.text.acceptAll);i.type="button",i.addEventListener("click",()=>{this.engine.acceptAll(),this.announceAndClose()});let s=c("button","action primary",this.text.rejectAll);if(s.type="button",s.addEventListener("click",()=>{this.engine.rejectAll(),this.announceAndClose()}),n.appendChild(i),n.appendChild(s),e){let r=c("button","action secondary",this.text.save);r.type="button",r.addEventListener("click",()=>{this.engine.save(this.collect()),this.announceAndClose()}),n.appendChild(r)}else{let r=c("button","action secondary",this.text.preferences);r.type="button",r.addEventListener("click",()=>this.open("preferences")),n.appendChild(r)}if(t==="preferences"){let r=c("button","action secondary",this.text.close);r.type="button",r.addEventListener("click",()=>this.close()),n.appendChild(r)}return n}collect(){let e={};for(let[t,n]of this.inputs)e[t]=n.checked;return e}renderBadge(){if(this.opts.showBadge===!1||this.badge)return;let e=this.ensureHost(),t=c("button","badge");t.setAttribute("type","button"),t.setAttribute("data-position",this.opts.badgePosition||"bottom-left"),t.setAttribute("aria-haspopup","dialog");let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("aria-hidden","true"),n.setAttribute("fill","none"),n.setAttribute("stroke","currentColor"),n.setAttribute("stroke-width","2");let i=document.createElementNS("http://www.w3.org/2000/svg","path");i.setAttribute("d","M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z M8.5 11h.01 M12 15.5h.01 M15.5 10h.01"),i.setAttribute("stroke-linecap","round"),i.setAttribute("stroke-linejoin","round"),n.appendChild(i),t.appendChild(n),t.appendChild(document.createTextNode(this.opts.badgeLabel||this.text.preferences)),t.addEventListener("click",()=>this.open("preferences")),e.appendChild(t),this.badge=t}open(e="notice"){var i,s;let t=this.ensureHost();this.visible&&this.teardownPanel(),this.mode=e,this.lastFocused=document.activeElement;let n=this.renderPanel(e);t.appendChild(n),this.visible=!0,this.opts.blocking!==!1&&(document.documentElement.style.setProperty("overflow","hidden"),this.setBackgroundInert(!0)),this.keyHandler=r=>this.onKeyDown(r),document.addEventListener("keydown",this.keyHandler,!0),(i=this.panel)==null||i.setAttribute("tabindex","-1"),(s=this.panel)==null||s.focus({preventScroll:!0}),this.engine.emit("show",{mode:e})}close(){this.visible&&(this.teardownPanel(),this.visible=!1,this.opts.blocking!==!1&&(document.documentElement.style.removeProperty("overflow"),this.setBackgroundInert(!1)),this.lastFocused instanceof HTMLElement&&this.lastFocused.focus({preventScroll:!0}),this.engine.emit("hide",{mode:this.mode}))}teardownPanel(){var e;this.keyHandler&&(document.removeEventListener("keydown",this.keyHandler,!0),this.keyHandler=null),(e=this.overlay)==null||e.remove(),this.overlay=null,this.panel=null,this.inputs.clear()}announceAndClose(){this.liveRegion&&this.text.savedAnnouncement&&(this.liveRegion.textContent=this.text.savedAnnouncement,window.setTimeout(()=>{this.liveRegion&&(this.liveRegion.textContent="")},4e3)),this.close(),this.renderBadge()}setBackgroundInert(e){if(e){let t=document.body;if(!t)return;let n=Array.prototype.slice.call(t.children);for(let i of n)i===this.host||i.hasAttribute("inert")||(i.setAttribute("inert",""),i.setAttribute("aria-hidden","true"),this.inerted.push(i))}else{for(let t of this.inerted)t.removeAttribute("inert"),t.removeAttribute("aria-hidden");this.inerted=[]}}onKeyDown(e){var r;if(!this.visible||!this.panel)return;if(e.key==="Escape"){e.preventDefault(),this.mode==="preferences"?this.close():(this.engine.dismiss(),this.announceAndClose());return}if(e.key!=="Tab")return;let t=this.focusable();if(t.length===0)return;let n=t[0],i=t[t.length-1],s=(r=this.shadow)==null?void 0:r.activeElement;e.shiftKey&&(s===n||s===this.panel)?(e.preventDefault(),i.focus()):!e.shiftKey&&s===i&&(e.preventDefault(),n.focus())}focusable(){if(!this.panel)return[];let e=this.panel.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');return Array.prototype.slice.call(e).filter(t=>t.offsetParent!==null||t.tagName==="INPUT")}isVisible(){return this.visible}getCopy(){let e={};for(let t of this.engine.getCategories())e[t.id]=t.label+(t.summary?" \u2014 "+t.summary:"");return{title:this.text.title,body:this.text.body,categories:e}}destroy(){var e,t;this.teardownPanel(),(e=this.badge)==null||e.remove(),this.badge=null,(t=this.host)==null||t.remove(),this.host=null,this.shadow=null,this.visible=!1}};var T=class{constructor(e={}){this.adobe=null;this.booted=!1;this.engine=new k(e,{canShowUi:()=>{var t;return!((t=e.ui)!=null&&t.headless)},getCopy:()=>this.banner.getCopy()}),this.banner=new A(this.engine,e.ui||{}),this.blocker=e.autoBlock!==!1?new w(this.engine):null}init(){var e,t;return this.booted?this:(this.booted=!0,this.adobe=I(this.engine,this.engine.config.adobe||{}),(e=this.blocker)==null||e.start(),this.engine.start(),(t=this.engine.config.ui)!=null&&t.headless||Z(()=>{this.engine.shouldPrompt()?this.banner.open("notice"):this.banner.renderBadge()}),this)}hasConsent(e){return this.engine.hasConsent(e)}gate(e,t){return this.engine.gate(e,t)}acceptAll(){return this.engine.acceptAll()}rejectAll(){return this.engine.rejectAll()}save(e){return this.engine.save(e)}update(e){return this.engine.update(e)}openPreferences(){this.banner.open("preferences")}showBanner(){this.banner.open("notice")}hideBanner(){this.banner.close()}reset(){this.engine.reset(),this.banner.open("notice")}on(e,t){return this.engine.on(e,t)}off(e,t){this.engine.off(e,t)}get decision(){return this.engine.decision}get state(){return this.engine.getState()}get region(){return this.engine.region}isPending(){return this.engine.isPending()}getReceipts(){return this.engine.getReceipts()}rescan(){var e;(e=this.blocker)==null||e.sweep()}destroy(){var e;this.banner.destroy(),(e=this.blocker)==null||e.stop()}};function he(o={}){return new T(o)}function z(o={}){return new T(o).init()}function Te(){if(typeof document=="undefined")return null;let o=document.currentScript||document.querySelector("script[data-adobe-consent]"),e=o==null?void 0:o.getAttribute("data-config");if(!e)return null;try{return JSON.parse(e)}catch{return typeof console!="undefined"&&console.warn("[adobe-consent] data-config is not valid JSON; ignoring"),null}}var q=null;function Re(){if(!F())return;let e=window.adobeConsentConfig||Te();e&&e.autoInit!==!1&&(q=z(e))}Re();var Ie={create:he,init:z,ConsentManager:T,ConsentEngine:k,ConsentBanner:A,AutoBlocker:w,attachAdobe:I,get instance(){return q}};
