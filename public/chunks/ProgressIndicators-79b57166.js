import{j as r,i as x,l as m,G as g}from"../assets/index-39ab9c4a.js";import{R as u}from"./vendor-b4eaa5bd.js";const y=({steps:s,direction:d="horizontal",className:a=""})=>{const n=e=>{switch(e){case"completed":return r.jsx(g,{className:"w-5 h-5 text-green-500"});case"current":return r.jsx(m,{className:"w-5 h-5 text-primary"});case"error":return r.jsx(x,{className:"w-5 h-5 text-red-500"});default:return r.jsx("div",{className:"w-5 h-5 rounded-full border-2 border-gray-300 bg-white"})}},i=e=>{const t={completed:"text-green-600 bg-green-50 border-green-200",current:"text-primary bg-muted/50 border-border",error:"text-red-600 bg-red-50 border-red-200",pending:"text-gray-600 bg-gray-50 border-gray-200"};return t[e]||t.pending},l=(e,t)=>{if(e===t.length-1)return"hidden";const c=t[e].status,o=t[e+1].status;return c==="completed"?"bg-green-500":c==="current"&&o==="pending"?"bg-gradient-to-r from-primary-500 to-gray-300":"bg-gray-300"};return d==="vertical"?r.jsx("div",{className:`space-y-4 ${a}`,dir:"rtl",children:s.map((e,t)=>r.jsxs("div",{className:"flex",children:[r.jsxs("div",{className:"flex flex-col items-center ml-4",children:[r.jsx("div",{className:`
                flex items-center justify-center w-10 h-10 rounded-full border-2
                ${i(e.status)}
              `,children:n(e.status)}),t<s.length-1&&r.jsx("div",{className:`
                  w-0.5 h-8 mt-2
                  ${l(t,s)}
                `})]}),r.jsxs("div",{className:"flex-1 min-w-0",children:[r.jsx("h3",{className:`
                text-sm font-semibold font-reisinger-yonatan
                ${e.status==="completed"?"text-green-600":e.status==="current"?"text-primary":e.status==="error"?"text-red-600":"text-gray-600"}
              `,children:e.label}),e.description&&r.jsx("p",{className:"text-xs text-gray-500 mt-1 font-reisinger-yonatan",children:e.description})]})]},e.id))}):r.jsx("div",{className:`flex items-center ${a}`,dir:"rtl",children:s.map((e,t)=>r.jsxs(u.Fragment,{children:[r.jsxs("div",{className:"flex flex-col items-center",children:[r.jsx("div",{className:`
              flex items-center justify-center w-10 h-10 rounded-full border-2
              ${i(e.status)}
            `,children:n(e.status)}),r.jsxs("div",{className:"mt-2 text-center",children:[r.jsx("h3",{className:`
                text-xs font-semibold font-reisinger-yonatan
                ${e.status==="completed"?"text-green-600":e.status==="current"?"text-primary":e.status==="error"?"text-red-600":"text-gray-600"}
              `,children:e.label}),e.description&&r.jsx("p",{className:"text-xs text-gray-500 mt-1 font-reisinger-yonatan max-w-20",children:e.description})]})]}),t<s.length-1&&r.jsx("div",{className:`
              flex-1 h-0.5 mx-4
              ${l(t,s)}
            `})]},e.id))})};export{y as S};
