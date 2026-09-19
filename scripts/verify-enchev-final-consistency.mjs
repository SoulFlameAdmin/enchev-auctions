import fs from "node:fs";
import path from "node:path";

const REQUIRED_ROUTE_FILES=[
  "app/page.tsx",
  "app/inventory/page.tsx",
  "app/lot/[id]/page.tsx",
  "app/live-auctions/page.tsx",
  "app/profile/page.tsx",
  "app/support/page.tsx",
  "app/transport/page.tsx",
  "app/vehicle-history/page.tsx",
];

const INTERNAL_EXCLUDES=new Set([
  "app/components/MasterSystemPlanV1.tsx",
  "app/components/SeedAuditGaps.tsx",
  "app/components/BulgarianStageLabels.tsx",
  "app/components/DesignPlanExtension.tsx",
  "app/components/VerifiedPlanEvidenceSync.tsx",
  "app/components/TestPassGreenGuard.tsx",
  "app/components/GapAppendOnlyGuard.tsx",
  "app/components/PlanStatusAuditTrail.tsx",
  "app/components/CloudPlanStateSync.tsx",
]);

const TEXT_EXTENSIONS=new Set([".ts",".tsx",".js",".jsx",".css",".svg",".html",".txt"]);
const FORBIDDEN_PATTERNS=[
  {label:"AutoBidMaster",regex:/\bAutoBidMaster\b/i},
  {label:"Copart",regex:/\bCopart\b/i},
  {label:"EasyHaul",regex:/\bEasyHaul\b/i},
  {label:"ClearVin",regex:/\bClearVin\b/i},
  {label:"CarKiosk",regex:/\bCarKiosk\b/i},
  {label:"LightStream",regex:/\bLightStream\b/i},
  {label:"SalvageBid",regex:/\bSalvageBid\b/i},
  {label:"AuctionExport",regex:/\bAuctionExport\b/i},
  {label:"IAA",regex:/\bIAA\b/},
  {label:"autobidmaster.com",regex:/autobidmaster\.com/i},
  {label:"copart.com",regex:/copart\.com/i},
];

function fail(message){
  throw new Error(`ENCHEV_FINAL_CONSISTENCY FAIL: ${message}`);
}

function normalize(file){
  return file.split(path.sep).join("/");
}

function walk(root){
  if(!fs.existsSync(root))return [];
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const full=path.join(root,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function isProductionUiSource(file){
  const normalized=normalize(file);
  if(normalized.startsWith("app/api/"))return false;
  if(INTERNAL_EXCLUDES.has(normalized))return false;
  return TEXT_EXTENSIONS.has(path.extname(normalized));
}

function collectProductionSources(){
  const files=[...walk("app"),...walk("public")];
  const sources={};
  for(const file of files){
    const normalized=normalize(file);
    if(normalized.startsWith("public/")){
      const lower=normalized.toLowerCase();
      for(const forbidden of FORBIDDEN_PATTERNS){
        if(forbidden.regex.test(normalized))fail(`foreign reference appears in public asset path: ${normalized} (${forbidden.label})`);
      }
      if(TEXT_EXTENSIONS.has(path.extname(lower))){
        sources[normalized]=fs.readFileSync(file,"utf8");
      }
      continue;
    }
    if(isProductionUiSource(file)){
      sources[normalized]=fs.readFileSync(file,"utf8");
    }
  }
  return sources;
}

function assertNoForeignReferences(sources){
  const violations=[];
  for(const [file,source] of Object.entries(sources)){
    for(const forbidden of FORBIDDEN_PATTERNS){
      if(forbidden.regex.test(source)){
        violations.push(`${file}: ${forbidden.label}`);
      }
    }
  }
  if(violations.length)fail(`foreign reference brand/domain found in production UI: ${violations.join("; ")}`);
}

function assertEnchevIdentity(sources){
  for(const file of REQUIRED_ROUTE_FILES){
    const source=sources[file];
    if(typeof source!=="string")fail(`required user-facing route source missing from scan: ${file}`);
    if(!/ENCHEV/.test(source))fail(`ENCHEV identity marker missing from ${file}`);
    if(!/<strong>ENCHEV<\/strong>/.test(source)&&file!=="app/page.tsx"){
      fail(`ENCHEV header brand marker missing from ${file}`);
    }
  }

  const home=sources["app/page.tsx"];
  const appShell=sources["app/components/EnchevAppShell.tsx"]||"";
  const legacyHomeBrand=/className="eaBrand"[\s\S]*?<strong>ENCHEV<\/strong>[\s\S]*?<span>AUCTIONS<\/span>/.test(home);
  const unifiedShellBrand=/className="eaAppBrand"[\s\S]*?<strong>ENCHEV<\/strong>[\s\S]*?<span>AUCTIONS<\/span>/.test(appShell);
  if(!legacyHomeBrand&&!unifiedShellBrand){
    fail("homepage ENCHEV AUCTIONS brand lockup missing");
  }

  const layout=sources["app/layout.tsx"];
  if(!/title:\s*"ENCHEV Auctions"/.test(layout))fail('metadata title must be exactly "ENCHEV Auctions"');
  if(!/description:\s*"[^"]*ENCHEV[^"]*"/.test(layout))fail("metadata description must explicitly carry ENCHEV identity");
}

function assertNoReferenceAssetUrls(sources){
  const violations=[];
  const referenceHosts=[
    "autobidmaster.com",
    "www.autobidmaster.com",
    "copart.com",
    "www.copart.com",
    "easyhaul.com",
    "www.easyhaul.com",
    "clearvin.com",
    "www.clearvin.com",
  ];

  for(const [file,source] of Object.entries(sources)){
    for(const match of source.matchAll(/https?:\/\/[^\s"'<>)}]+/g)){
      let host="";
      try{host=new URL(match[0]).hostname.toLowerCase();}catch{continue;}
      if(referenceHosts.includes(host)){
        violations.push(`${file}: ${host}`);
      }
    }
  }

  if(violations.length)fail(`reference-site/partner asset URL found: ${violations.join("; ")}`);
}

export function validateSources(sources){
  assertNoForeignReferences(sources);
  assertEnchevIdentity(sources);
  assertNoReferenceAssetUrls(sources);
  return true;
}

function makeGoodFixture(){
  const route=(name)=>`export default function ${name}(){return <main><a className="brand"><strong>ENCHEV</strong><span>AUCTIONS</span></a></main>}`;
  return {
    "app/layout.tsx":'export const metadata={title:"ENCHEV Auctions",description:"ENCHEV международна платформа за автомобилни търгове"};',
    "app/page.tsx":'export default function Home(){return <main><a className="eaBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a></main>}',
    "app/inventory/page.tsx":route("Inventory"),
    "app/lot/[id]/page.tsx":route("Lot"),
    "app/live-auctions/page.tsx":route("Live"),
    "app/profile/page.tsx":route("Profile"),
    "app/support/page.tsx":route("Support"),
    "app/transport/page.tsx":route("Transport"),
    "app/vehicle-history/page.tsx":route("History"),
    "app/theme.css":'.hero{background-image:url("https://images.unsplash.com/photo-demo")}',
  };
}

function expectRejected(label,mutate){
  const fixture=makeGoodFixture();
  mutate(fixture);
  let rejected=false;
  try{validateSources(fixture);}catch{rejected=true;}
  if(!rejected)fail(`negative self-test was not rejected: ${label}`);
}

if(process.argv.includes("--self-test")){
  validateSources(makeGoodFixture());
  expectRejected("foreign reference brand",(fixture)=>{fixture["app/page.tsx"]+=" AutoBidMaster";});
  expectRejected("reference asset URL",(fixture)=>{fixture["app/theme.css"]='.x{background:url("https://www.autobidmaster.com/logo.svg")}';});
  expectRejected("missing route identity",(fixture)=>{fixture["app/profile/page.tsx"]="export default function Profile(){return <main>profile</main>}";});
  expectRejected("wrong metadata brand",(fixture)=>{fixture["app/layout.tsx"]='export const metadata={title:"Enchev Auctions",description:"ENCHEV platform"};';});
  console.log("ENCHEV_FINAL_CONSISTENCY_SELF_TEST PASS negative_cases=4");
}else{
  const sources=collectProductionSources();
  validateSources(sources);
  console.log(`ENCHEV_FINAL_CONSISTENCY PASS files=${Object.keys(sources).length} routes=${REQUIRED_ROUTE_FILES.length} forbidden_refs=0`);
}
