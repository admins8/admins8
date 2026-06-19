function a(i){return String(i||"").replace(/&nbsp;|&#160;|&#xA0;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(e,r)=>{const t=Number(r);return Number.isFinite(t)?String.fromCharCode(t):""}).replace(/&#x([0-9a-f]+);/gi,(e,r)=>{const t=parseInt(r,16);return Number.isFinite(t)?String.fromCharCode(t):""})}const n=[/^\s*window\.[A-Za-z_$][\w$]*\s*=\s*["'][A-Za-z0-9+/=\s]{40,}["'];?\s*$/gim];function s(i){let e=String(i||"").replace(/<\s*br\s*\/?\s*>/gi,`
`).replace(/<\/\s*p\s*>/gi,`
`).replace(/<\s*p\b[^>]*>/gi,`
`).replace(/<\/\s*div\s*>/gi,`
`).replace(/<\s*div\b[^>]*>/gi,`
`).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g,"");e=a(e);for(const r of n)e=e.replace(r,"");return e.split(`
`).map(r=>r.replace(/[ \t\f\v]+/g," ").trim()).join(`
`).replace(/\n{3,}/g,`

`).trim()}export{s as c};
