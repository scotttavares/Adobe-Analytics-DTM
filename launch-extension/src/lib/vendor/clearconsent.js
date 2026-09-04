/*! clearconsent v1.0.0 | MIT | Adobe-native cookie consent management */
"use strict";var O=Object.defineProperty,xe=Object.defineProperties,Ce=Object.getOwnPropertyDescriptor,we=Object.getOwnPropertyDescriptors,ke=Object.getOwnPropertyNames,$=Object.getOwnPropertySymbols;var Q=Object.prototype.hasOwnProperty,Ae=Object.prototype.propertyIsEnumerable;var J=(o,e,t)=>e in o?O(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t,c=(o,e)=>{for(var t in e||(e={}))Q.call(e,t)&&J(o,t,e[t]);if($)for(var t of $(e))Ae.call(e,t)&&J(o,t,e[t]);return o},M=(o,e)=>xe(o,we(e));var Ee=(o,e)=>{for(var t in e)O(o,t,{get:e[t],enumerable:!0})},Se=(o,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of ke(e))!Q.call(o,i)&&i!==t&&O(o,i,{get:()=>e[i],enumerable:!(n=Ce(e,i))||n.enumerable});return o};var Te=o=>Se(O({},"__esModule",{value:!0}),o);var _e={};Ee(_e,{AnalyticsAdapter:()=>b,AutoBlocker:()=>A,ConsentBanner:()=>S,ConsentEngine:()=>E,ConsentManager:()=>D,DEFAULT_CATEGORIES:()=>L,DEFAULT_CONFIG:()=>_,DEFAULT_MAPPING:()=>N,DEFAULT_REGIONS:()=>j,DEFAULT_TEXT:()=>U,DataLayerAdapter:()=>v,LaunchAdapter:()=>x,OPT_IN_CATEGORIES:()=>P,OptInAdapter:()=>C,WebSdkAdapter:()=>w,attachAdobe:()=>R,create:()=>ve,default:()=>Ue,init:()=>K,instance:()=>Y});module.exports=Te(_e);var N={collect:["analytics","personalization","advertising"],share:["advertising"],personalize:["personalization"],adId:["advertising"],analytics:["analytics"],target:["personalization"],audienceManager:["advertising"],ecid:["analytics","personalization","advertising"]};function h(o){return c(c({},N),o||{})}function g(o,e){if(!o||o.length===0)return!1;for(let t of o)if(e[t]===!0)return!0;return!1}function I(o){return o?"y":"n"}var b=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}instance(){let e=this.opts.instanceGlobal||"s",t=window[e];return t&&typeof t=="object"?t:null}apply(e){let t=g(this.mapping.analytics,e),n=this.instance();if(!n){this.engine.log.log("AppMeasurement instance not found; nothing to gate");return}n.abort=!t,n.optOut=!t,this.engine.log.log("AppMeasurement analytics consent:",t?"granted":"denied")}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.apply(this.engine.decision)),this.engine.on("change",()=>this.apply(this.engine.decision)))}};var v=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}get name(){return this.opts.name||"adobeDataLayer"}queue(){let e=window;return Array.isArray(e[this.name])||(e[this.name]=[]),e[this.name]}buildPayload(e,t){let n=this.engine.getState();return{event:t,consent:{categories:c({},e),granted:Object.keys(e).filter(i=>e[i]),denied:Object.keys(e).filter(i=>!e[i]),adobe:{collect:g(this.mapping.collect,e),share:g(this.mapping.share,e),personalize:g(this.mapping.personalize,e),adId:g(this.mapping.adId,e),analytics:g(this.mapping.analytics,e),target:g(this.mapping.target,e),audienceManager:g(this.mapping.audienceManager,e)},method:n==null?void 0:n.method,region:this.engine.region,model:this.engine.model,policyVersion:n==null?void 0:n.policyVersion,receiptId:n==null?void 0:n.id,timestamp:n==null?void 0:n.timestamp,pending:this.engine.isPending()}}}push(e,t){let n=t||this.opts.eventName||"consent-updated";try{this.queue().push(this.buildPayload(e,n)),this.engine.log.log('pushed "'+n+'" to '+this.name)}catch(i){this.engine.log.error("data layer push failed",i)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>{this.opts.pushOnLoad!==!1&&this.push(this.engine.decision,"consent-loaded")}),this.engine.on("change",()=>this.push(this.engine.decision)))}};var x=class{constructor(e,t={}){this.retries=0;this.engine=e,this.opts=t}get satellite(){let e=window._satellite;return e&&typeof e.track=="function"?e:null}detail(e){let t=this.engine.getState();return{consent:c({},e),method:t==null?void 0:t.method,region:this.engine.region,model:this.engine.model,receiptId:t==null?void 0:t.id,pending:this.engine.isPending()}}fire(e){let t=this.satellite;if(!t){this.retries<20?(this.retries++,window.setTimeout(()=>this.fire(e),250)):this.engine.log.warn("_satellite never appeared; direct call rules not fired");return}this.retries=0;let n=this.opts.directCallId||"clear-consent-changed";try{if(t.track(n,this.detail(e)),this.engine.log.log('_satellite.track("'+n+'")'),this.opts.perCategoryDirectCalls)for(let i of Object.keys(e)){let r=e[i]?"granted":"denied";t.track("consent-"+i+"-"+r,this.detail(e))}}catch(i){this.engine.log.error("_satellite.track failed",i)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.fire(this.engine.decision)),this.engine.on("change",()=>this.fire(this.engine.decision)))}};var P={ECID:"ecid",ANALYTICS:"aa",TARGET:"target",AUDIENCE_MANAGER:"aam",AD_CLOUD:"adcloud",CAMPAIGN:"campaign",LIVEFYRE:"livefyre",MEDIA_ANALYTICS:"mediaaa"},C=class{constructor(e,t={},n){this.engine=e,this.opts=t,this.mapping=h(n)}get api(){let e=window.adobe;return e&&e.optIn?e.optIn:null}category(e){var r;let t=(r=window.adobe)==null?void 0:r.OptInCategories;return(t?t[e==="AUDIENCE_MANAGER"?"AAM":e]:void 0)||P[e]}known(e){var i;let t=(i=window.adobe)==null?void 0:i.OptInCategories;if(!t)return e;let n={};for(let r of Object.keys(t)){let s=t[r];s&&(n[s]=!0)}return e.filter(r=>n[r]===!0)}buildPermissions(e){let t=[["ECID",g(this.mapping.ecid,e)],["ANALYTICS",g(this.mapping.analytics,e)],["TARGET",g(this.mapping.target,e)],["AUDIENCE_MANAGER",g(this.mapping.audienceManager,e)]],n=[],i=[];for(let[r,s]of t)(s?n:i).push(this.category(r));return{approve:n,deny:i}}send(e){let t=this.api;if(!t){this.engine.log.warn('adobe.optIn not found; is "Enable Opt-In" on in the ECID extension?');return}let n=this.buildPermissions(e),i=this.known(n.approve),r=this.known(n.deny);try{i.length&&t.approve(i,!0),r.length&&this.opts.denyUnconsented!==!1&&t.deny(r,!0),t.complete(),this.engine.log.log("optIn approved:",i,"denied:",r)}catch(s){this.engine.log.error("adobe.optIn call failed",s)}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>this.send(this.engine.decision)),this.engine.on("change",()=>this.send(this.engine.decision)))}};var w=class{constructor(e,t={},n){this.engine=e,this.opts=c({standardVersion:"2.0",sendOnEveryPageLoad:!0},t),this.mapping=h(n)}getInstanceNames(){var t;if((t=this.opts.instanceNames)!=null&&t.length)return this.opts.instanceNames;let e=window;return Array.isArray(e.__alloyNS)&&e.__alloyNS.length?e.__alloyNS.slice():typeof e.alloy=="function"?["alloy"]:[]}buildPayload(e){if(this.opts.standardVersion==="1.0")return[{standard:"Adobe",version:"1.0",value:{general:g(this.mapping.collect,e)?"in":"out"}}];let t={collect:{val:I(g(this.mapping.collect,e))},share:{val:I(g(this.mapping.share,e))},personalize:{content:{val:I(g(this.mapping.personalize,e))}},metadata:{time:new Date().toISOString()}};return this.opts.adIdType&&(t.adID={idType:this.opts.adIdType,val:I(g(this.mapping.adId,e))}),[{standard:"Adobe",version:"2.0",value:t}]}send(e){let t=this.getInstanceNames();if(t.length===0){this.engine.log.warn("Web SDK not found on the page; skipping setConsent");return}let n={consent:this.buildPayload(e)};this.opts.identityMap&&(n.identityMap=this.opts.identityMap);for(let i of t){let r=window[i];if(typeof r!="function"){this.engine.log.warn('alloy instance "'+i+'" is not callable');continue}try{let s=r("setConsent",n);this.engine.log.log("setConsent ->",i,n),s&&typeof s.catch=="function"&&s.catch(a=>{this.engine.log.error("setConsent rejected for "+i,a)})}catch(s){this.engine.log.error("setConsent threw for "+i,s)}}}attach(){this.opts.enabled!==!1&&(this.engine.on("ready",()=>{this.opts.sendOnEveryPageLoad!==!1&&this.send(this.engine.decision)}),this.engine.on("change",()=>this.send(this.engine.decision)))}};function R(o,e={}){let t=e.mapping,n={webSdk:new w(o,e.webSdk||{},t),optIn:new C(o,e.optIn||{},t),analytics:new b(o,e.analytics||{},t),dataLayer:new v(o,e.dataLayer||{},t),launch:new x(o,e.launch||{})};return n.webSdk.attach(),n.optIn.attach(),n.analytics.attach(),n.dataLayer.attach(),n.launch.attach(),n}var X="data-cc-category",G="data-cc-src",Z="data-cc-unblocked",k="ac-embed-placeholder",A=class{constructor(e,t={}){this.observer=null;this.styleInjected=!1;this.engine=e,this.opts=t}start(){this.sweep(),this.engine.on("ready",()=>this.sweep()),this.engine.on("change",()=>this.sweep()),typeof MutationObserver=="function"&&document.documentElement&&(this.observer=new MutationObserver(e=>{for(let t of e)if(t.addedNodes.length){this.sweep();return}}),this.observer.observe(document.documentElement,{childList:!0,subtree:!0}))}stop(){var e;(e=this.observer)==null||e.disconnect(),this.observer=null}sweep(){if(typeof document=="undefined")return;let e=document.querySelectorAll("["+X+"]:not(["+Z+"])");for(let t=0;t<e.length;t++){let n=e[t],i=n.getAttribute(X);i&&(this.engine.hasConsent(i)?this.unblock(n,i):n.tagName==="IFRAME"&&this.opts.placeholders!==!1&&this.showPlaceholder(n,i))}}unblock(e,t){if(e.setAttribute(Z,"true"),this.removePlaceholder(e),e.tagName==="SCRIPT"){this.reviveScript(e);return}let n=e.getAttribute(G);n&&(e.setAttribute("src",n),e.removeAttribute(G)),this.engine.log.log("unblocked",e.tagName.toLowerCase(),"for",t)}reviveScript(e){var r;let t=document.createElement("script");for(let s=0;s<e.attributes.length;s++){let a=e.attributes[s];a.name==="type"||a.name===G||t.setAttribute(a.name,a.value)}let n=e.getAttribute(G);n?t.src=n:e.src&&(t.src=e.src),!t.src&&e.textContent&&(t.textContent=e.textContent);let i=e.getAttribute("data-cc-type");i&&(t.type=i),(r=e.parentNode)==null||r.insertBefore(t,e.nextSibling),e.remove(),this.engine.log.log("unblocked script",t.src||"(inline)")}injectStyle(){var t;if(this.styleInjected||typeof document=="undefined")return;let e=document.createElement("style");e.setAttribute("data-clearconsent","placeholder"),e.textContent=`
.${k}{display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:10px;min-height:150px;padding:20px;text-align:center;background:#f3f4f6;color:#374151;
border:1px solid #e5e7eb;border-radius:8px;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}
.${k} button{font:inherit;font-weight:600;padding:9px 16px;border-radius:999px;
border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;min-height:40px;}
.${k} button:hover{background:rgba(0,0,0,.05);}
@media (prefers-color-scheme:dark){.${k}{background:#1f2937;color:#e5e7eb;border-color:#374151;}}
`.trim(),(t=document.head)==null||t.appendChild(e),this.styleInjected=!0}showPlaceholder(e,t){var a,u,p;if((u=(a=e.previousElementSibling)==null?void 0:a.classList)!=null&&u.contains(k))return;this.injectStyle();let n=this.engine.getCategories().filter(d=>d.id===t).map(d=>d.label)[0]||t,i=document.createElement("div");i.className=k,i.setAttribute("data-cc-placeholder-for",t);let r=document.createElement("p");r.style.margin="0",r.textContent=this.opts.placeholderText?this.opts.placeholderText(n):"This content is hidden because "+n.toLowerCase()+" cookies are turned off.";let s=document.createElement("button");s.type="button",s.textContent=this.opts.placeholderButton||"Allow and show",s.addEventListener("click",()=>{let d={};d[t]=!0,this.engine.update(d)}),i.appendChild(r),i.appendChild(s),e.style.display="none",(p=e.parentNode)==null||p.insertBefore(i,e)}removePlaceholder(e){var n;let t=e.previousElementSibling;(n=t==null?void 0:t.classList)!=null&&n.contains(k)&&(t.remove(),e.style.removeProperty("display"))}};var L=[{id:"essential",label:"Essential",summary:"always on",description:"Required for the site to function \u2014 security, load balancing, remembering your privacy choices, and keeping you signed in. These cannot be switched off.",required:!0,defaultGranted:!0},{id:"analytics",label:"Analytics",summary:"understand usage",description:"Helps us measure how the site performs \u2014 which pages are visited, where errors happen, and what to fix next. Reported in aggregate.",defaultGranted:!1},{id:"personalization",label:"Personalization",summary:"tailored content",description:"Lets us remember your preferences and tailor the content and offers you see, rather than showing everyone the same thing.",defaultGranted:!1},{id:"advertising",label:"Advertising",summary:"relevant offers",description:"Used to build an advertising profile and show you more relevant offers on this site and elsewhere. May involve sharing data with advertising partners.",defaultGranted:!1}],U={title:"Your privacy choices",body:"We use cookies and similar technologies to run this site, measure how it performs, personalize your experience, and tailor offers. Choose what you are comfortable with \u2014 essential cookies are always on.",acceptAll:"Accept all",rejectAll:"Reject all",save:"Save choices",preferences:"Privacy choices",close:"Close",privacyPolicy:"Privacy policy",ariaLabel:"Privacy and cookie preferences",savedAnnouncement:"Your privacy choices have been saved.",detailsShow:"Details",detailsHide:"Hide details",cookieTableName:"Name",cookieTableProvider:"Provider",cookieTablePurpose:"Purpose",cookieTableDuration:"Duration",signalGpcTitle:"Global Privacy Control \u2014 honored",signalGpcBody:"Your browser sent an opt-out signal, so sale, sharing, and non-essential cookies are already switched off. Nothing here is required \u2014 change anything you like.",signalDntTitle:"Do Not Track \u2014 noted",signalDntBody:"We treat it as an advisory opt-out and left non-essential cookies off. GPC is the signal with legal force; this one we honor as a courtesy.",signalMoreInfo:"How we handle signals"},j=[{match:["EU","EEA","GB","UK","CH","AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","BR"],model:"opt_in"},{match:["US","US-CA","US-CO","US-CT","US-VA","US-UT","US-TX","US-OR","US-MT","US-DE","US-IA","US-NE","US-NH","US-NJ","US-TN","US-MN","US-MD","US-RI","US-KY","US-IN","CA"],model:"opt_out",defaultGranted:["essential","analytics","personalization","advertising"]},{match:["*"],model:"opt_in"}],_={policyVersion:1,categories:L,model:"opt_in",regions:j,storage:{},ui:{layout:"modal",position:"center",blocking:!0,showBadge:!0,badgePosition:"bottom-left",categoriesOnFirstLayer:!0,lang:"en"},adobe:{},receipt:{enabled:!0,historySize:10},honorGpc:!0,honorDnt:!1,autoBlock:!0,reconsentDays:365,debug:!1,autoInit:!0};var ee="region";function De(o,e){let t=(o||"").toUpperCase(),n=t.split("-")[0]||"",i=null,r=null,s=null;for(let a of e)for(let u of a.match){let p=u.toUpperCase();p==="*"?s||(s=a):p===t?i||(i=a):p===n&&(r||(r=a))}return i||r||s}function te(o,e,t){let n=De(o,e);return{region:o,model:n?n.model:t,defaultGranted:n!=null&&n.defaultGranted?n.defaultGranted.slice():[],suppressBanner:!!(n!=null&&n.suppressBanner)}}function Ie(o){if(typeof document=="undefined")return null;let e=document.querySelector('meta[name="'+o+'"]'),t=e==null?void 0:e.getAttribute("content");return t?t.trim():null}function ne(o,e){var s;let t=o.fallbackRegion||"EU";if(o.region)return{immediate:o.region,pending:null};if(o.metaTagName){let a=Ie(o.metaTagName);if(a)return{immediate:a,pending:null}}let n=e.getItem(ee);if(n)try{let a=JSON.parse(n);if(a&&a.expires>Date.now()&&a.region)return{immediate:a.region,pending:null}}catch(a){}if(!o.endpoint||typeof fetch=="undefined")return{immediate:t,pending:null};let i=(s=o.cacheMinutes)!=null?s:720,r=fetch(o.endpoint,{credentials:"omit",mode:"cors"}).then(a=>a.ok?a.json():null).then(a=>{if(!a)return t;let u=a.region||a.regionCode||(a.country&&a.subdivision?a.country+"-"+a.subdivision:a.country)||t;return e.setItem(ee,JSON.stringify({region:u,expires:Date.now()+i*6e4})),u}).catch(()=>t);return{immediate:t,pending:r}}function ie(){let o=typeof crypto!="undefined"?crypto:void 0;if(o&&typeof o.randomUUID=="function")return o.randomUUID();if(o&&typeof o.getRandomValues=="function"){let e=o.getRandomValues(new Uint8Array(16)),t="";for(let n=0;n<e.length;n++)t+=(e[n]+256).toString(16).slice(1);return t}return Date.now().toString(36)+Math.random().toString(36).slice(2,10)}function oe(o){let e=2166136261;for(let t=0;t<o.length;t++)e^=o.charCodeAt(t),e=e+((e<<1)+(e<<4)+(e<<7)+(e<<8)+(e<<24))>>>0;return("00000000"+e.toString(16)).slice(-8)}function re(o,e){let t=Object.keys(o);if(t.length!==Object.keys(e).length)return!1;for(let n of t)if(o[n]!==e[n])return!1;return!0}function B(){return typeof window!="undefined"&&typeof document!="undefined"}function se(o){B()&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o())}function ae(o,e="[clearconsent]"){let t=()=>{};return!o||typeof console=="undefined"?{log:t,warn:t,error:t,group:t}:{log:(...n)=>console.log(e,...n),warn:(...n)=>console.warn(e,...n),error:(...n)=>console.error(e,...n),group:(n,i)=>{console.groupCollapsed(e+" "+n),i(),console.groupEnd()}}}function W(o,e){if(!e)return c({},o);let t=c({},o);for(let n of Object.keys(e)){let i=e[n];if(i===void 0)continue;let r=t[n],s=i&&typeof i=="object"&&!Array.isArray(i)&&r&&typeof r=="object"&&!Array.isArray(r);t[n]=s?W(r,i):i}return t}var z="receipts";function le(o,e,t){let n={id:o.id,timestamp:o.timestamp,policyVersion:o.policyVersion,categories:c({},o.categories),method:o.method,region:o.region,gpc:o.gpc};return typeof location!="undefined"&&(n.url=location.href),typeof document!="undefined"&&document.referrer&&(n.referrer=document.referrer),typeof navigator!="undefined"&&(n.language=navigator.language,n.userAgent=navigator.userAgent),e.includeCopy&&t&&(n.copy=t),n.digest=oe(JSON.stringify(n)),n}function ce(o,e){let t=JSON.stringify(o);try{if(typeof navigator!="undefined"&&typeof navigator.sendBeacon=="function"){let n=new Blob([t],{type:"application/json"});if(navigator.sendBeacon(e,n))return!0}}catch(n){}try{if(typeof fetch=="function")return fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:t,keepalive:!0,credentials:"omit"}).catch(()=>{}),!0}catch(n){}return!1}function de(o,e,t){let n=[],i=t.getItem(z);if(i)try{let r=JSON.parse(i);Array.isArray(r)&&(n=r)}catch(r){n=[]}return n.push(o),n.length>e&&(n=n.slice(n.length-e)),t.setItem(z,JSON.stringify(n)),n}function pe(o){let e=o.getItem(z);if(!e)return[];try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch(t){return[]}}function Re(){return typeof navigator=="undefined"?!1:navigator.globalPrivacyControl===!0||typeof window!="undefined"&&window.globalPrivacyControl===!0}function Le(){if(typeof navigator=="undefined")return!1;let o=navigator,e=o.doNotTrack||(typeof window!="undefined"?window.doNotTrack:void 0)||o.msDoNotTrack;return e==="1"||e==="yes"}function q(o,e){return o&&Re()?"gpc":e&&Le()?"dnt":null}var V="clearConsent:",T={cookieName:"clearconsent",cookiePath:"/",cookieSameSite:"Lax",expiryDays:365,useLocalStorage:!0};function ue(o){let e={};for(let n of Object.keys(o.categories))e[n]=o.categories[n]?1:0;let t={v:1,pv:o.policyVersion,c:e,t:o.timestamp,m:o.method,id:o.id};return o.region&&(t.r=o.region),o.gpc&&(t.g=1),encodeURIComponent(JSON.stringify(t))}function ge(o){if(!o)return null;let e;try{e=JSON.parse(decodeURIComponent(o))}catch(n){return null}if(!e||typeof e!="object"||!e.c||typeof e.t!="number")return null;let t={};for(let n of Object.keys(e.c))t[n]=e.c[n]===1;return{schema:e.v||1,policyVersion:typeof e.pv=="number"?e.pv:1,categories:t,timestamp:e.t,method:e.m||"restored",id:e.id||"",region:e.r,gpc:e.g===1}}function Oe(o){if(typeof document=="undefined"||!document.cookie)return null;let e=o+"=";for(let t of document.cookie.split(";")){let n=t.trim();if(n.indexOf(e)===0)return n.substring(e.length)}return null}function he(o,e,t){var u,p,d,f;if(typeof document=="undefined")return;let n=(u=t.expiryDays)!=null?u:T.expiryDays,i=new Date(Date.now()+n*864e5).toUTCString(),r=(p=t.cookieSameSite)!=null?p:T.cookieSameSite,s=(d=t.cookieSecure)!=null?d:r==="None"||typeof location!="undefined"&&location.protocol==="https:",a=o+"="+e+";expires="+i+";path="+((f=t.cookiePath)!=null?f:T.cookiePath)+";SameSite="+r;t.cookieDomain&&(a+=";domain="+t.cookieDomain),s&&(a+=";Secure"),document.cookie=a}function Me(o,e){var n;if(typeof document=="undefined")return;let t=o+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path="+((n=e.cookiePath)!=null?n:"/");e.cookieDomain&&(t+=";domain="+e.cookieDomain),document.cookie=t}function fe(o){try{return window.localStorage.getItem(V+o)}catch(e){return null}}function me(o,e){try{window.localStorage.setItem(V+o,e)}catch(t){}}function Ne(o){try{window.localStorage.removeItem(V+o)}catch(e){}}var H=class{constructor(e={}){this.opts=c(c({},T),e)}get cookieName(){var e;return(e=this.opts.cookieName)!=null?e:T.cookieName}read(){let e=ge(Oe(this.cookieName));if(e)return e;if(this.opts.useLocalStorage){let t=ge(fe(this.cookieName));if(t)return he(this.cookieName,ue(t),this.opts),t}return null}write(e){let t=ue(e);he(this.cookieName,t,this.opts),this.opts.useLocalStorage&&me(this.cookieName,t)}clear(){Me(this.cookieName,this.opts),this.opts.useLocalStorage&&Ne(this.cookieName)}getItem(e){return fe(e)}setItem(e,t){me(e,t)}isExpired(e,t){var i;let n=(i=t!=null?t:this.opts.expiryDays)!=null?i:T.expiryDays;return n?Date.now()-e.timestamp>n*864e5:!1}};var E=class{constructor(e={},t={}){this.listeners=new Map;this.gateQueue=new Map;this.state=null;this.effective={};this.started=!1;this.pendingDecision=!0;this.lastReceipt=null;var n,i,r;this.config=W(_,e),this.categories=(n=this.config.categories)!=null&&n.length?this.config.categories:L,this.storage=new H(this.config.storage),this.log=ae(!!this.config.debug),this.hooks=t,this.regionInfo={region:((i=this.config.geo)==null?void 0:i.region)||((r=this.config.geo)==null?void 0:r.fallbackRegion)||"EU",model:this.config.model||"opt_in",defaultGranted:[],suppressBanner:!1}}start(){if(this.started)return this.snapshot();this.started=!0;let e=ne(this.config.geo||{},this.storage);this.applyRegion(e.immediate);let t=this.storage.read();if(t&&this.isStateValid(t)&&t)this.state=t,this.pendingDecision=!1,this.effective=this.withRequired(t.categories),this.log.log("restored decision",this.effective);else{t&&this.log.log("stored decision discarded (version bump or expiry)"),this.pendingDecision=!0,this.effective=this.defaultDecision();let i=q(!!this.config.honorGpc,!!this.config.honorDnt);i&&(this.log.log("honoring browser privacy signal:",i),this.commit(this.rejectedDecision(),i==="gpc"?"gpc":"dnt",{silent:!0,gpc:i==="gpc"}),this.pendingDecision=!1)}return this.emit("ready",this.snapshot()),this.flushGates(),this.config.onReady&&this.config.onReady(this.snapshot()),e.pending&&e.pending.then(i=>{if(i!==this.regionInfo.region&&(this.applyRegion(i),this.pendingDecision)){let r=c({},this.effective);this.effective=this.defaultDecision(),this.log.log("region resolved late:",i,this.regionInfo.model),this.emit("change",this.buildChangeEvent(null,!0,r)),this.flushGates()}}),this.snapshot()}applyRegion(e){this.regionInfo=te(e,this.config.regions||[],this.config.model||"opt_in")}isStateValid(e){var t;return!(e.policyVersion!==((t=this.config.policyVersion)!=null?t:1)||this.storage.isExpired(e,this.config.reconsentDays))}get decision(){return c({},this.effective)}get region(){return this.regionInfo.region}get model(){return this.regionInfo.model}getCategories(){return this.categories}hasConsent(e){return this.effective[e]===!0}isPending(){return this.pendingDecision}activeSignal(){return q(!!this.config.honorGpc,!!this.config.honorDnt)}getState(){return this.state?M(c({},this.state),{categories:c({},this.state.categories)}):null}getReceipts(){return pe(this.storage)}getLastReceipt(){return this.lastReceipt}shouldPrompt(){var e;return(e=this.config.ui)!=null&&e.headless||this.regionInfo.suppressBanner||this.hooks.canShowUi&&!this.hooks.canShowUi()?!1:this.pendingDecision}acceptAll(){return this.commit(this.allDecision(!0),"accept_all")}rejectAll(){return this.commit(this.rejectedDecision(),"reject_all")}save(e,t="save_choices"){let n={};for(let i of this.categories)n[i.id]=i.required?!0:e[i.id]===!0;return this.commit(n,t)}update(e,t="programmatic"){return this.save(c(c({},this.effective),e),t)}dismiss(){let e=this.regionInfo.model==="opt_in"?"reject_all":"implied_close",t=this.regionInfo.model==="opt_in"?this.rejectedDecision():this.defaultDecision();return this.commit(t,e)}reset(){this.storage.clear(),this.state=null,this.pendingDecision=!0;let e=this.snapshot();this.effective=this.defaultDecision(),this.log.log("consent reset"),this.emit("change",this.buildChangeEvent(e,!1))}commit(e,t,n={}){var u,p;let i=this.state?this.snapshot():null,r=c({},this.effective),s=this.withRequired(e);if(this.state&&re(r,s))return this.state=M(c({},this.state),{timestamp:Date.now()}),this.storage.write(this.state),this.log.log("decision re-affirmed unchanged:",t),this.flushGates(),this.snapshot();let a={schema:1,policyVersion:(u=this.config.policyVersion)!=null?u:1,categories:s,timestamp:Date.now(),method:t,id:ie(),region:this.regionInfo.region,gpc:(p=n.gpc)!=null?p:void 0};return this.state=a,this.effective=s,this.pendingDecision=!1,this.storage.write(a),this.recordReceipt(a),this.log.log("decision committed:",t,s),n.silent||(this.emit("change",this.buildChangeEvent(i,!1,r)),this.config.onChange&&this.config.onChange(a,i)),this.flushGates(),this.snapshot()}recordReceipt(e){let t=this.config.receipt;if(!(t!=null&&t.enabled))return;let n=t.includeCopy&&this.hooks.getCopy?this.hooks.getCopy():void 0,i=le(e,t,n);this.lastReceipt=i,t.historySize&&t.historySize>0&&de(i,t.historySize,this.storage),t.endpoint&&ce(i,t.endpoint)}gate(e,t){if(this.hasConsent(e))return this.runGuarded(t),()=>{};let n=this.gateQueue.get(e)||[];return n.push(t),this.gateQueue.set(e,n),()=>{let i=this.gateQueue.get(e);if(!i)return;let r=i.indexOf(t);r>=0&&i.splice(r,1)}}flushGates(){for(let[e,t]of this.gateQueue)if(!(!this.hasConsent(e)||t.length===0)){this.gateQueue.set(e,[]);for(let n of t)this.runGuarded(n)}}runGuarded(e){try{e()}catch(t){this.log.error("gated callback threw",t),this.emit("error",t)}}on(e,t){let n=this.listeners.get(e)||[];return n.push(t),this.listeners.set(e,n),()=>this.off(e,t)}off(e,t){let n=this.listeners.get(e);if(!n)return;let i=n.indexOf(t);i>=0&&n.splice(i,1)}emit(e,t){let n=this.listeners.get(e);if(n)for(let i of n.slice())try{i(t)}catch(r){this.log.error('listener for "'+e+'" threw',r)}if(typeof document!="undefined"&&typeof CustomEvent=="function")try{document.dispatchEvent(new CustomEvent("clearConsent:"+e,{detail:t}))}catch(i){}}buildChangeEvent(e,t,n){let i=n||(e==null?void 0:e.categories)||{},r=[],s=[];for(let a of Object.keys(this.effective)){let u=i[a]===!0,p=this.effective[a]===!0;!u&&p&&r.push(a),u&&!p&&s.push(a)}return r.length&&this.emit("granted",r),s.length&&this.emit("revoked",s),{state:this.snapshot(),previous:e,granted:r,revoked:s,initial:t}}snapshot(){var e;return this.state?M(c({},this.state),{categories:c({},this.state.categories)}):{schema:1,policyVersion:(e=this.config.policyVersion)!=null?e:1,categories:c({},this.effective),timestamp:Date.now(),method:"region_default",id:"",region:this.regionInfo.region}}withRequired(e){let t={};for(let n of this.categories)t[n.id]=n.required?!0:e[n.id]===!0;return t}allDecision(e){let t={};for(let n of this.categories)t[n.id]=n.required?!0:e;return t}rejectedDecision(){return this.allDecision(!1)}defaultDecision(){let e={},t=this.regionInfo.model,n=this.regionInfo.defaultGranted;for(let i of this.categories)i.required?e[i.id]=!0:t==="opt_in"?e[i.id]=!1:n.length?e[i.id]=n.indexOf(i.id)>=0:e[i.id]=i.defaultGranted!==!1;return e}};function ye(o={}){let e={surface:o.surface||"#1b1530",surfaceAlt:o.surfaceAlt||"rgba(255, 255, 255, 0.055)",text:o.text||"#f2f0fb",textMuted:o.textMuted||"#c7c1de",accent:o.accent||"linear-gradient(96deg, #7d8bff 0%, #b57cff 100%)",accentText:o.accentText||"#160f2b",border:o.border||"rgba(255, 255, 255, 0.22)",radius:o.radius||"18px",fontFamily:o.fontFamily||"system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",headingFontFamily:o.headingFontFamily||"Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",overlay:o.overlay||"rgba(8, 6, 18, 0.55)"};return`
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
  box-shadow: inset 1em 1em #160f2b;
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
.switch input[type='checkbox']:checked { background: #9aa7ff; }
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
  box-shadow: 0 2px 10px rgba(125, 139, 255, 0.24);
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

.signal-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 16px;
  margin: 0 0 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: var(--ac-surface-alt);
}
.signal-note svg { width: 22px; height: 22px; flex: 0 0 auto; margin-top: 1px; }
.signal-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.signal-title { font-size: 14.5px; font-weight: 600; letter-spacing: -0.005em; }
.signal-body { font-size: 13.5px; line-height: 1.5; color: var(--ac-text-muted); }
.signal-more {
  align-self: flex-start;
  margin-top: 5px;
  font-size: 13px;
  color: var(--ac-text);
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 4px;
}
.signal-more:hover { opacity: 0.82; }

/* GPC is legally binding \u2014 confident and green, "we already did it". */
.signal-note[data-signal='gpc'] {
  border-color: rgba(52, 211, 153, 0.5);
  background: linear-gradient(180deg, rgba(52, 211, 153, 0.13), var(--ac-surface-alt));
}
.signal-note[data-signal='gpc'] svg { color: #34d399; }
.signal-note[data-signal='gpc'] .signal-title { color: #6ee7b7; }

/* DNT carries no legal force \u2014 acknowledged plainly, deliberately not green. */
.signal-note[data-signal='dnt'] svg { color: var(--ac-text-muted); }

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
  .signal-note { border: 1px solid CanvasText; }
}
${o.customCss||""}
`.trim()}var be="clearconsent-root";function l(o,e,t){let n=document.createElement(o);return e&&(n.className=e),t!==void 0&&(n.textContent=t),n}var S=class{constructor(e,t={}){this.host=null;this.shadow=null;this.overlay=null;this.panel=null;this.badge=null;this.liveRegion=null;this.inputs=new Map;this.visible=!1;this.mode="notice";this.lastFocused=null;this.keyHandler=null;this.inerted=[];this.engine=e,this.opts=t,this.text=c(c({},U),t.text||{})}ensureHost(){if(this.shadow)return this.shadow;let e=document.getElementById(be);e&&e.remove();let t=l("div");t.id=be,t.style.cssText="position:static;display:block;width:0;height:0;",this.opts.lang&&t.setAttribute("lang",this.opts.lang),(this.opts.root||document.body||document.documentElement).appendChild(t);let i=t.attachShadow({mode:"open"}),r=document.createElement("style");r.textContent=ye(this.opts.theme||{}),i.appendChild(r);let s=l("div","sr-only");return s.setAttribute("role","status"),s.setAttribute("aria-live","polite"),i.appendChild(s),this.host=t,this.shadow=i,this.liveRegion=s,i}renderCategory(e,t){var p,d;let n=l("div","category"),i=l("div","row-wrap"),r=l("label","row"+(e.required?" locked":"")),s=l("input");s.type="checkbox",s.checked=e.required?!0:t[e.id]===!0,s.disabled=!!e.required,s.setAttribute("data-category",e.id),e.required&&s.setAttribute("aria-disabled","true");let a=l("span","label-text");if(a.appendChild(l("span","name",e.label)),e.summary&&(a.appendChild(document.createTextNode(" \u2014 ")),a.appendChild(l("span","summary",e.summary))),r.appendChild(s),r.appendChild(a),i.appendChild(r),!!(e.description||(p=e.cookies)!=null&&p.length)){let f="ac-det-"+e.id,m=l("button","details-toggle",this.text.detailsShow||"Details");m.type="button",m.setAttribute("aria-expanded","false"),m.setAttribute("aria-controls",f);let y=l("div","details");y.id=f,y.setAttribute("data-open","false"),e.description&&y.appendChild(l("p",void 0,e.description)),(d=e.cookies)!=null&&d.length&&y.appendChild(this.renderCookieTable(e)),e.description&&s.setAttribute("aria-describedby",f),m.addEventListener("click",()=>{let F=y.getAttribute("data-open")==="true";y.setAttribute("data-open",F?"false":"true"),m.setAttribute("aria-expanded",F?"false":"true"),m.textContent=F?this.text.detailsShow||"Details":this.text.detailsHide||"Hide details"}),i.appendChild(m),n.appendChild(i),n.appendChild(y)}else n.appendChild(i);return this.inputs.set(e.id,s),n}renderCookieTable(e){let t=l("table","cookies"),n=l("thead"),i=l("tr");for(let s of[this.text.cookieTableName||"Name",this.text.cookieTableProvider||"Provider",this.text.cookieTablePurpose||"Purpose",this.text.cookieTableDuration||"Duration"]){let a=l("th",void 0,s);a.setAttribute("scope","col"),i.appendChild(a)}n.appendChild(i),t.appendChild(n);let r=l("tbody");for(let s of e.cookies||[]){let a=l("tr");a.appendChild(l("td",void 0,s.name)),a.appendChild(l("td",void 0,s.provider||"\u2014")),a.appendChild(l("td",void 0,s.purpose||"\u2014")),a.appendChild(l("td",void 0,s.duration||"\u2014")),r.appendChild(a)}return t.appendChild(r),t.setAttribute("aria-label",e.label+" cookies"),t}renderSignalNote(){let e=this.engine.activeSignal();if(!e)return null;let t=l("div","signal-note");t.setAttribute("data-signal",e),t.setAttribute("role","status");let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("aria-hidden","true"),n.setAttribute("fill","none"),n.setAttribute("stroke","currentColor"),n.setAttribute("stroke-width","2"),n.setAttribute("stroke-linecap","round"),n.setAttribute("stroke-linejoin","round");let i=document.createElementNS("http://www.w3.org/2000/svg","path");i.setAttribute("d","M20.5 12a8.5 8.5 0 1 1-3.7-7");let r=document.createElementNS("http://www.w3.org/2000/svg","path");r.setAttribute("d","M9 12.5l2.5 2.5L18 7.5"),n.appendChild(i),n.appendChild(r);let s=e==="gpc",a=l("div","signal-text"),u=s?this.text.signalGpcTitle:this.text.signalDntTitle,p=s?this.text.signalGpcBody:this.text.signalDntBody;if(u&&a.appendChild(l("strong","signal-title",u)),p&&a.appendChild(l("span","signal-body",p)),this.text.signalMoreInfoUrl&&this.text.signalMoreInfo){let d=l("a","signal-more",this.text.signalMoreInfo);d.href=this.text.signalMoreInfoUrl,d.target="_blank",d.rel="noopener noreferrer",a.appendChild(d)}return t.appendChild(n),t.appendChild(a),t}renderPanel(e){let t=this.engine.decision;this.inputs.clear();let n=l("div","overlay");n.setAttribute("data-position",this.opts.position||"center"),n.setAttribute("data-blocking",String(this.opts.blocking!==!1));let i=l("div","panel");i.setAttribute("data-layout",this.opts.layout||"modal"),i.setAttribute("role","dialog"),i.setAttribute("aria-modal",String(this.opts.blocking!==!1)),i.setAttribute("aria-labelledby","ac-title"),i.setAttribute("aria-describedby","ac-body"),this.text.ariaLabel&&i.setAttribute("aria-label",this.text.ariaLabel);let r=this.renderSignalNote();r&&i.appendChild(r);let s=l("h2","title",this.text.title);s.id="ac-title",i.appendChild(s);let a=l("p","body",this.text.body);a.id="ac-body",i.appendChild(a);let u=this.opts.categoriesOnFirstLayer!==!1||e==="preferences";if(u){let d=l("div","categories");d.setAttribute("role","group"),d.setAttribute("aria-label","Cookie categories");for(let f of this.engine.getCategories())d.appendChild(this.renderCategory(f,t));i.appendChild(d)}i.appendChild(this.renderActions(u,e));let p=l("div","link-row");if(this.text.privacyPolicyUrl&&this.text.privacyPolicy){let d=l("a",void 0,this.text.privacyPolicy);d.href=this.text.privacyPolicyUrl,d.target="_blank",d.rel="noopener noreferrer",p.appendChild(d)}return this.text.poweredBy&&p.appendChild(l("span",void 0,this.text.poweredBy)),p.childNodes.length&&i.appendChild(p),n.appendChild(i),this.overlay=n,this.panel=i,n}renderActions(e,t){let n=l("div","actions"),i=l("button","action primary",this.text.acceptAll);i.type="button",i.addEventListener("click",()=>{this.engine.acceptAll(),this.announceAndClose()});let r=l("button","action primary",this.text.rejectAll);if(r.type="button",r.addEventListener("click",()=>{this.engine.rejectAll(),this.announceAndClose()}),n.appendChild(i),n.appendChild(r),e){let s=l("button","action secondary",this.text.save);s.type="button",s.addEventListener("click",()=>{this.engine.save(this.collect()),this.announceAndClose()}),n.appendChild(s)}else{let s=l("button","action secondary",this.text.preferences);s.type="button",s.addEventListener("click",()=>this.open("preferences")),n.appendChild(s)}if(t==="preferences"){let s=l("button","action secondary",this.text.close);s.type="button",s.addEventListener("click",()=>this.close()),n.appendChild(s)}return n}collect(){let e={};for(let[t,n]of this.inputs)e[t]=n.checked;return e}renderBadge(){if(this.opts.showBadge===!1||this.badge)return;let e=this.ensureHost(),t=l("button","badge");t.setAttribute("type","button"),t.setAttribute("data-position",this.opts.badgePosition||"bottom-left"),t.setAttribute("aria-haspopup","dialog");let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("aria-hidden","true"),n.setAttribute("fill","none"),n.setAttribute("stroke","currentColor"),n.setAttribute("stroke-width","2");let i=document.createElementNS("http://www.w3.org/2000/svg","path");i.setAttribute("d","M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z M8.5 11h.01 M12 15.5h.01 M15.5 10h.01"),i.setAttribute("stroke-linecap","round"),i.setAttribute("stroke-linejoin","round"),n.appendChild(i),t.appendChild(n),t.appendChild(document.createTextNode(this.opts.badgeLabel||this.text.preferences)),t.addEventListener("click",()=>this.open("preferences")),e.appendChild(t),this.badge=t}open(e="notice"){var i,r;let t=this.ensureHost();this.visible&&this.teardownPanel(),this.mode=e,this.lastFocused=document.activeElement;let n=this.renderPanel(e);t.appendChild(n),this.visible=!0,this.opts.blocking!==!1&&(document.documentElement.style.setProperty("overflow","hidden"),this.setBackgroundInert(!0)),this.keyHandler=s=>this.onKeyDown(s),document.addEventListener("keydown",this.keyHandler,!0),(i=this.panel)==null||i.setAttribute("tabindex","-1"),(r=this.panel)==null||r.focus({preventScroll:!0}),this.engine.emit("show",{mode:e})}close(){this.visible&&(this.teardownPanel(),this.visible=!1,this.opts.blocking!==!1&&(document.documentElement.style.removeProperty("overflow"),this.setBackgroundInert(!1)),this.lastFocused instanceof HTMLElement&&this.lastFocused.focus({preventScroll:!0}),this.engine.emit("hide",{mode:this.mode}))}teardownPanel(){var e;this.keyHandler&&(document.removeEventListener("keydown",this.keyHandler,!0),this.keyHandler=null),(e=this.overlay)==null||e.remove(),this.overlay=null,this.panel=null,this.inputs.clear()}announceAndClose(){this.liveRegion&&this.text.savedAnnouncement&&(this.liveRegion.textContent=this.text.savedAnnouncement,window.setTimeout(()=>{this.liveRegion&&(this.liveRegion.textContent="")},4e3)),this.close(),this.renderBadge()}setBackgroundInert(e){if(e){let t=document.body;if(!t)return;let n=Array.prototype.slice.call(t.children);for(let i of n)i===this.host||i.hasAttribute("inert")||(i.setAttribute("inert",""),i.setAttribute("aria-hidden","true"),this.inerted.push(i))}else{for(let t of this.inerted)t.removeAttribute("inert"),t.removeAttribute("aria-hidden");this.inerted=[]}}onKeyDown(e){var s;if(!this.visible||!this.panel)return;if(e.key==="Escape"){e.preventDefault(),this.mode==="preferences"?this.close():(this.engine.dismiss(),this.announceAndClose());return}if(e.key!=="Tab")return;let t=this.focusable();if(t.length===0)return;let n=t[0],i=t[t.length-1],r=(s=this.shadow)==null?void 0:s.activeElement;e.shiftKey&&(r===n||r===this.panel)?(e.preventDefault(),i.focus()):!e.shiftKey&&r===i&&(e.preventDefault(),n.focus())}focusable(){if(!this.panel)return[];let e=this.panel.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');return Array.prototype.slice.call(e).filter(t=>t.offsetParent!==null||t.tagName==="INPUT")}isVisible(){return this.visible}getCopy(){let e={};for(let t of this.engine.getCategories())e[t.id]=t.label+(t.summary?" \u2014 "+t.summary:"");return{title:this.text.title,body:this.text.body,categories:e}}destroy(){var e,t;this.teardownPanel(),(e=this.badge)==null||e.remove(),this.badge=null,(t=this.host)==null||t.remove(),this.host=null,this.shadow=null,this.visible=!1}};var D=class{constructor(e={}){this.adobe=null;this.booted=!1;this.engine=new E(e,{canShowUi:()=>{var t;return!((t=e.ui)!=null&&t.headless)},getCopy:()=>this.banner.getCopy()}),this.banner=new S(this.engine,e.ui||{}),this.blocker=e.autoBlock!==!1?new A(this.engine):null}init(){var e,t;return this.booted?this:(this.booted=!0,this.adobe=R(this.engine,this.engine.config.adobe||{}),(e=this.blocker)==null||e.start(),this.engine.start(),(t=this.engine.config.ui)!=null&&t.headless||se(()=>{this.engine.shouldPrompt()?this.banner.open("notice"):this.banner.renderBadge()}),this)}hasConsent(e){return this.engine.hasConsent(e)}gate(e,t){return this.engine.gate(e,t)}acceptAll(){return this.engine.acceptAll()}rejectAll(){return this.engine.rejectAll()}save(e){return this.engine.save(e)}update(e){return this.engine.update(e)}openPreferences(){this.banner.open("preferences")}showBanner(){this.banner.open("notice")}hideBanner(){this.banner.close()}reset(){this.engine.reset(),this.banner.open("notice")}on(e,t){return this.engine.on(e,t)}off(e,t){this.engine.off(e,t)}get decision(){return this.engine.decision}get state(){return this.engine.getState()}get region(){return this.engine.region}isPending(){return this.engine.isPending()}getReceipts(){return this.engine.getReceipts()}rescan(){var e;(e=this.blocker)==null||e.sweep()}destroy(){var e;this.banner.destroy(),(e=this.blocker)==null||e.stop()}};function ve(o={}){return new D(o)}function K(o={}){return new D(o).init()}function Pe(){if(typeof document=="undefined")return null;let o=document.currentScript||document.querySelector("script[data-clearconsent]"),e=o==null?void 0:o.getAttribute("data-config");if(!e)return null;try{return JSON.parse(e)}catch(t){return typeof console!="undefined"&&console.warn("[clearconsent] data-config is not valid JSON; ignoring"),null}}var Y=null;function Ge(){if(!B())return;let e=window.clearConsentConfig||Pe();e&&e.autoInit!==!1&&(Y=K(e))}Ge();var Ue={create:ve,init:K,ConsentManager:D,ConsentEngine:E,ConsentBanner:S,AutoBlocker:A,attachAdobe:R,get instance(){return Y}};
