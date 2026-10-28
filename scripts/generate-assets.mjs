import { mkdir, writeFile } from "node:fs/promises";
const dir = new URL("../public/tokens/", import.meta.url);
await mkdir(dir, { recursive: true });
const art = {
  orbit: [
    "#36344d",
    "#b2a0e5",
    '<path d="M29 43 25 20 46 31Q61 24 76 33L94 22 90 48Q104 83 64 94 25 91 29 43" fill="#c3b0ee"/><path d="m32 28 3 18 11-10m39-7-4 17-9-10" fill="#7f68ae"/><ellipse cx="48" cy="58" rx="5" ry="8" fill="#282a3a"/><ellipse cx="77" cy="58" rx="5" ry="8" fill="#282a3a"/><path d="m58 71 6 5 5-5m-5 5v5m-13-1q13 8 25-1" stroke="#463858" stroke-width="3" fill="none"/><ellipse cx="64" cy="65" rx="50" ry="18" stroke="#e4c776" stroke-width="3" fill="none" transform="rotate(-27 64 65)"/>',
  ],
  based: [
    "#1d3962",
    "#7ea4eb",
    '<path d="M32 39 43 22 83 24 97 41 91 92 35 96Z" fill="#8ba9e1"/><path d="M31 49h29v18H33zm36 0h29l-3 18H67z" fill="#1b2b46"/><path d="M59 55h9M44 84l20-6 15 5" stroke="#172d53" stroke-width="4"/><path d="m52 25 9-10 12 12" stroke="#c1d2f0" stroke-width="4"/>',
  ],
  toast: [
    "#644332",
    "#dfae72",
    '<path d="M32 48Q15 14 62 16T96 48L92 102H34Z" fill="#a95d35"/><path d="M39 48Q24 24 62 24T88 48L85 94H41Z" fill="#efd39c"/><circle cx="51" cy="61" r="4" fill="#51362a"/><circle cx="76" cy="61" r="4" fill="#51362a"/><path d="M54 75q10 12 19-1" fill="none" stroke="#51362a" stroke-width="3"/><rect x="52" y="34" width="25" height="14" rx="3" fill="#f4de75" transform="rotate(-12 64 41)"/>',
  ],
  pebble: [
    "#34423f",
    "#a3b5aa",
    '<path d="m20 84 10-39 34-18 34 14 15 36-19 24H40Z" fill="#a5b4aa"/><path d="m30 45 29 18 5-36m-5 36 35 38M59 63 20 84m39-21 39-22" stroke="#899b90" stroke-width="2"/><circle cx="50" cy="73" r="4" fill="#35453d"/><circle cx="78" cy="73" r="4" fill="#35453d"/><path d="M58 86h13" stroke="#35453d" stroke-width="3"/>',
  ],
  blob: [
    "#1c3a6a",
    "#5c92ed",
    '<path d="M20 80Q9 55 34 49 27 13 58 24 86 5 89 38 120 35 107 63 124 91 97 98 70 117 52 100 23 111 20 80" fill="#76a9ff"/><ellipse cx="49" cy="60" rx="5" ry="8" fill="#203555"/><ellipse cx="79" cy="60" rx="5" ry="8" fill="#203555"/><path d="M56 78q10 8 18-2" fill="none" stroke="#203555" stroke-width="3"/><circle cx="35" cy="72" r="6" fill="#c1d4ff" opacity=".5"/>',
  ],
  moon: [
    "#3f4d35",
    "#cbe998",
    '<circle cx="63" cy="62" r="40" fill="#d2e7a4"/><circle cx="40" cy="46" r="9" fill="#b2c78e"/><circle cx="84" cy="80" r="11" fill="#bbd195"/><circle cx="65" cy="30" r="5" fill="#bbd195"/><circle cx="54" cy="61" r="4" fill="#3a4a35"/><circle cx="77" cy="58" r="4" fill="#3a4a35"/><path d="M55 76q11 10 19-3" fill="none" stroke="#3a4a35" stroke-width="3"/><path d="m101 19 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#edf3c2"/>',
  ],
  frog: [
    "#284d48",
    "#92cbb2",
    '<ellipse cx="63" cy="69" rx="44" ry="32" fill="#8bbaa0"/><circle cx="38" cy="39" r="20" fill="#8bbaa0"/><circle cx="85" cy="39" r="20" fill="#8bbaa0"/><circle cx="38" cy="37" r="12" fill="#e8e5c8"/><circle cx="85" cy="37" r="12" fill="#e8e5c8"/><circle cx="41" cy="39" r="5" fill="#243e37"/><circle cx="81" cy="39" r="5" fill="#243e37"/><path d="M35 69q27 23 55-1" stroke="#385e4d" stroke-width="3" fill="none"/><path d="m45 96 18-10 18 10-10 12H54Z" fill="#dce1d6"/><path d="m60 91 6 0 3 26H56Z" fill="#3e5c7a"/>',
  ],
  capy: [
    "#53453b",
    "#c9ab8b",
    '<ellipse cx="37" cy="35" rx="11" ry="13" fill="#b18e6e"/><ellipse cx="87" cy="35" rx="11" ry="13" fill="#b18e6e"/><path d="M27 56Q25 28 63 30 98 30 100 66v18Q66 113 28 83Z" fill="#c7a786"/><ellipse cx="64" cy="77" rx="25" ry="19" fill="#d4b89b"/><path d="M40 56h10m28 0h10" stroke="#473b34" stroke-width="4" stroke-linecap="round"/><ellipse cx="64" cy="72" rx="8" ry="5" fill="#5b4538"/><path d="M64 77v8m-8 0h16" stroke="#5b4538" stroke-width="2"/><path d="M52 22q10-13 20 0" fill="#e3ac58"/>',
  ],
  noodle: [
    "#57503a",
    "#e5d38f",
    '<path d="M27 64h76l-12 35H40Z" fill="#d9d6bd"/><path d="M22 65h86" stroke="#f3e9c9" stroke-width="5"/><path d="M41 62Q22 40 47 34T60 15M56 61Q75 42 60 36T76 16M76 62Q99 43 81 33" fill="none" stroke="#e7c36b" stroke-width="6" stroke-linecap="round"/><path d="m82 18 14 60m-7-63 14 63" stroke="#c28a60" stroke-width="3"/><circle cx="50" cy="79" r="3" fill="#3c413d"/><circle cx="77" cy="79" r="3" fill="#3c413d"/><path d="M57 87q8 5 13-1" stroke="#3c413d" stroke-width="2" fill="none"/>',
  ],
  pixel: [
    "#443553",
    "#b6a0d9",
    '<path d="M35 22h50v12h12v12h12v40H97v12H85v12H35V98H23V46h12Z" fill="#b6a0d9"/><path d="M35 22h50v12H47v12H23V34h12Z" fill="#e1b9da"/><path d="M34 53h24v16H34zm37 0h24v16H71z" fill="#322b43"/><path d="M58 57h13M48 87h30" stroke="#322b43" stroke-width="6"/>',
  ],
  dog: [
    "#4e4130",
    "#d7b677",
    '<path d="M32 42 18 29 14 69 34 73m60-31 15-13 5 40-21 4" fill="#947044"/><path d="M28 56Q28 29 63 28 99 29 99 57l-9 34-27 16-30-18Z" fill="#d9b779"/><path d="M43 63q6-7 12 0m19 0q6-7 12 0" stroke="#4d3b2b" stroke-width="4" fill="none"/><ellipse cx="64" cy="82" rx="21" ry="16" fill="#efddb7"/><path d="m55 77 9 7 9-7" fill="#4e3a2c"/><path d="M64 84v8" stroke="#4e3a2c" stroke-width="3"/><path d="m32 18 4-8 5 8 9 1-7 6 2 9-9-5-8 5 2-9-7-6Z" fill="#e1ca78"/>',
  ],
  ufo: [
    "#304747",
    "#acc7c7",
    '<ellipse cx="64" cy="81" rx="48" ry="15" fill="#94aeb5"/><path d="M35 75q0-41 29-41t29 41Z" fill="#b8d6ca"/><path d="M43 68q0-27 21-27" stroke="#dbe9dc" stroke-width="4" fill="none"/><ellipse cx="64" cy="75" rx="28" ry="8" fill="#526a6d"/><circle cx="33" cy="83" r="4" fill="#d4e5b7"/><circle cx="64" cy="89" r="4" fill="#d4e5b7"/><circle cx="95" cy="83" r="4" fill="#d4e5b7"/><path d="m50 98-12 24m26-21v25m14-28 13 23" stroke="#c4dcad" stroke-width="2" opacity=".5"/><path d="m24 22 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#d5dfcd"/>',
  ],
  ghost: [
    "#3e3d52",
    "#cccbe0",
    '<path d="M29 106V57q0-36 35-36t35 36v49l-18-12-17 12-17-12Z" fill="#d9d7e8"/><ellipse cx="51" cy="59" rx="6" ry="9" fill="#444158"/><ellipse cx="78" cy="59" rx="6" ry="9" fill="#444158"/><ellipse cx="64" cy="81" rx="7" ry="8" fill="#858099"/><path d="M42 41q5-9 14-10" stroke="#f1eff9" stroke-width="4" stroke-linecap="round"/>',
  ],
  mush: [
    "#563c44",
    "#d8a0a1",
    '<path d="m48 71-5 35q21 11 43 0L80 71Z" fill="#e1d8bd"/><path d="M15 73Q16 19 64 19t49 54Q64 89 15 73" fill="#cb7e87"/><circle cx="43" cy="47" r="11" fill="#edcfbb"/><circle cx="82" cy="40" r="8" fill="#edcfbb"/><circle cx="92" cy="65" r="6" fill="#edcfbb"/><circle cx="53" cy="91" r="3" fill="#5c4549"/><circle cx="75" cy="91" r="3" fill="#5c4549"/><path d="M58 100q7 5 13-1" fill="none" stroke="#5c4549" stroke-width="2"/>',
  ],
  sun: [
    "#584d32",
    "#e0c87f",
    '<g stroke="#dfbb62" stroke-width="6" stroke-linecap="round"><path d="M64 11v9m0 88v9M11 64h9m88 0h9M26 26l7 7m62 62 7 7M26 102l7-7m62-62 7-7"/></g><circle cx="64" cy="64" r="34" fill="#ebd18b"/><path d="M42 57q7-9 13 0m18 0q7-9 13 0M50 74q14 16 29-1" stroke="#685333" stroke-width="3" fill="none"/><circle cx="39" cy="70" r="5" fill="#d7a478"/><circle cx="88" cy="70" r="5" fill="#d7a478"/>',
  ],
};
for (const [id, [bg, accent, paths]] of Object.entries(art)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="g"><stop stop-color="${accent}" stop-opacity=".16"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#fff" opacity=".08"/></pattern></defs><rect width="128" height="128" rx="20" fill="${bg}"/><rect width="128" height="128" rx="20" fill="url(#g)"/><rect width="128" height="128" rx="20" fill="url(#p)"/>${paths}</svg>`;
  await writeFile(new URL(`${id}.svg`, dir), svg);
}
await mkdir(new URL("../public/brand/", import.meta.url), { recursive: true });
const mark =
  '<path d="M27.2 13A10.5 10.5 0 0 0 9 10.5L5 15.5M5 7v8.5h8.5M8.8 23A10.5 10.5 0 0 0 27 25.5l4-5M31 29v-8.5h-8.5" stroke="#477bff" stroke-width="3.5" fill="none"/>';
await writeFile(
  new URL("../public/brand/retry-symbol.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${mark}</svg>`,
);
await writeFile(
  new URL("../public/brand/retry-wordmark.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 44"><g transform="translate(0 4)">${mark}</g><text x="46" y="34" font-family="Arial,sans-serif" font-size="39" font-weight="800" letter-spacing="-2" fill="#f0f1f6">retry<tspan fill="#477bff">.</tspan></text></svg>`,
);
console.log("Generated 15 original token illustrations and RETRY vectors.");
