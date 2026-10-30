#!/usr/bin/env python3
"""Read-only bounded NVIDIA SimReady metadata probe. No asset redistribution."""
import json, urllib.request, urllib.parse, sys, os
HOST="https://huggingface.co"
REPO="nvidia/simready-assets"
CANDIDATES=["tool_hammer_a03","rack_long_empty_a01","grid_ceiling_a01","paint_container_tube_a01","box_corrugated_brown_b20","stationery_pencil_watercolor_red_a01"]
def get(url):
  req=urllib.request.Request(url,headers={"User-Agent":"STRATUM-Spatial-Verified-SimReady-Compatibility/1.0","Accept":"application/json"})
  with urllib.request.urlopen(req, timeout=40) as f:return json.load(f)
info=get(f"{HOST}/api/datasets/{REPO}")
rev=info["sha"]
report={"source":f"{HOST}/datasets/{REPO}","commit":rev,"license":info.get("cardData",{}).get("license"),"candidates":[]}
for name in CANDIDATES:
  url=f"{HOST}/api/datasets/{REPO}/tree/{rev}/{name}?recursive=true&expand=false&limit=1000"
  try:
    files=get(url)
    if not isinstance(files,list):raise ValueError("non-list tree response")
    rows=[{"path":x["path"],"size":int(x.get("size") or 0)} for x in files if x.get("type")=="file"]
    roots=[x for x in rows if x["path"].startswith(name+"/simready_usd/") and x["path"].lower().endswith((".usd",".usda",".usdc",".usdz")) and "/payloads/" not in x["path"] and "/.thumbs/" not in x["path"] and "/materials/" not in x["path"]]
    tex=[x for x in rows if x["path"].lower().endswith((".png",".jpg",".jpeg",".tiff",".exr",".dds")) and "/.thumbs/" not in x["path"]]
    payload=[x for x in rows if "/payloads/" in x["path"]]
    report["candidates"].append({"name":name,"file_count":len(rows),"total_mb":round(sum(x["size"] for x in rows)/1e6,2),"roots":roots[:10],"texture_count":len(tex),"texture_mb":round(sum(x["size"] for x in tex)/1e6,2),"payload_count":len(payload),"payload_mb":round(sum(x["size"] for x in payload)/1e6,2),"json_meta_count":sum(x["path"].endswith(".json") for x in rows),"tree_truncated":len(files)>=1000})
  except Exception as e:
    report["candidates"].append({"name":name,"error":str(e)[:250]})
os.makedirs("test-results",exist_ok=True)
with open("test-results/nvidia-simready-asset-probe.json","w") as f:json.dump(report,f,indent=2)
print("NVIDIA_SIMREADY_PACKAGE_PROBE",json.dumps(report))
if not any(x.get("roots") for x in report["candidates"]):
 print("No candidate root USD was discoverable",file=sys.stderr)
 sys.exit(1)
