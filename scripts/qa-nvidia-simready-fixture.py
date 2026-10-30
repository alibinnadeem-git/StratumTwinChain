#!/usr/bin/env python3
"""Fetch one authentic NVIDIA CC BY 4.0 SimReady package at an immutable HF revision.
Use a bounded, local test fixture. Never commit upstream asset binaries to git.
The derived USDZ is only an *automated testing package* of original USD files; it does
not convert source geometry to GLB or establish SimReady physics/runtime semantics.
"""
import os,sys,json,io,zipfile,urllib.request,urllib.parse,hashlib,re,time
from concurrent.futures import ThreadPoolExecutor,as_completed

HOST="https://huggingface.co"
REPO="nvidia/simready-assets"
REV=os.getenv("SIMREADY_REV","4763fbfaa4f8e97658e68b57d01b4c86659e08b5")
ASSET=os.getenv("SIMREADY_NAME","tool_hammer_a03")
MAX_BYTES=110*1024*1024
MAX_FILE_BYTES=50*1024*1024
OUT=".simready-qa-fixtures/nvidia-simready"

def request(url):
 req=urllib.request.Request(url,headers={"User-Agent":"STRATUM-Spatial-Verified-Compatibility/1.0"})
 with urllib.request.urlopen(req,timeout=100) as f:
  return f.read()

def getjson(url):return json.loads(request(url))

def safe_filename(p):
 if not p.startswith(f"{ASSET}/simready_usd/") or ".." in p.split("/") or "\\" in p:
  raise ValueError("Unsafe/non-USD-package path: "+p)
 return p[len(ASSET)+1:]

def download(row):
 file=row["path"]
 suffix=urllib.parse.quote(file,safe="/")
 url=f"{HOST}/datasets/{REPO}/resolve/{REV}/{suffix}"
 for i in range(3):
  try:
   data=request(url)
   if len(data)!=row["size"]:raise IOError(f"Unexpected length for {file}: {len(data)} vs {row['size']}")
   return row,data
  except Exception:
   if i==2:raise
   time.sleep(i+1)
 raise AssertionError

def main():
 tree=getjson(f"{HOST}/api/datasets/{REPO}/tree/{REV}/{ASSET}?recursive=true&expand=false&limit=1000")
 if not isinstance(tree,list):raise ValueError("Missing NVIDIA package tree")
 files=[{"path":r["path"],"size":int(r.get("size") or 0)} for r in tree if r.get("type")=="file" and r["path"].startswith(f"{ASSET}/simready_usd/") and "/.thumbs/" not in r["path"]]
 for row in files:safe_filename(row["path"])
 if not files:raise ValueError("No actual USD source files")
 if sum(x["size"] for x in files)>MAX_BYTES:raise ValueError("Package exceeds bounded test fixture limit")
 if any(x["size"]>MAX_FILE_BYTES for x in files):raise ValueError("Single dependency too large")
 roots=[x for x in files if "/" not in safe_filename(x["path"])[len("simready_usd/"):] and x["path"].lower().endswith((".usd",".usda",".usdc",".usdz"))]
 if len(roots)!=1:raise ValueError("Expected exactly one root USD, found "+str(roots))
 root=roots[0]
 os.makedirs(OUT,exist_ok=True)
 saved={}
 with ThreadPoolExecutor(max_workers=6) as pool:
  for fut in as_completed([pool.submit(download,row) for row in files]):
   row,raw=fut.result()
   saved[row["path"]]=raw
   print("Downloaded",row["path"],len(raw),flush=True)
 root_bytes=saved[root["path"]]
 metadata=(root_bytes.decode("utf8","replace") if not root_bytes.startswith(b"PXR-USDC") else "")
 refs=re.findall(r"@([^@]+)@",metadata)
 # Paths are scene-authored; recording them is evidence, not proof of complete loading.
 local_paths=set(safe_filename(r["path"]) for r in files)
 root_dir=os.path.dirname(safe_filename(root["path"]))
 uncontained=[]
 for ref in refs:
  ref=ref.replace("\\","/")
  if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*://",ref) or ref.startswith("/"):
   uncontained.append(ref);continue
  normalized=os.path.normpath(os.path.join(root_dir,ref)).replace("\\","/")
  if normalized not in local_paths:uncontained.append(ref)
 out_file=f"{OUT}/nvidia-{ASSET}-original-layer-package.usdz"
 with zipfile.ZipFile(out_file,"w",compression=zipfile.ZIP_STORED,allowZip64=True) as archive:
  # Root layer must appear first as required by OpenUSD USDZ conventions.
  for row in [root]+[r for r in sorted(files,key=lambda r:r["path"]) if r["path"]!=root["path"]]:
   archive.writestr(safe_filename(row["path"]),saved[row["path"]],compress_type=zipfile.ZIP_STORED)
 original_file=f"{OUT}/{os.path.basename(root['path'])}"
 with open(original_file,"wb") as f:f.write(root_bytes)
 report={
 "source":"https://huggingface.co/datasets/nvidia/simready-assets",
 "revision":REV,"asset":ASSET,"license":"CC BY 4.0","credit":"NVIDIA SimReady Assets",
 "root":root["path"],"root_original_sha256":hashlib.sha256(root_bytes).hexdigest(),
 "files":len(files),"payload_files":sum("/payloads/" in r["path"] for r in files),
 "texture_files":sum(r["path"].lower().endswith((".png",".jpg",".jpeg",".exr",".tif",".tiff",".dds")) for r in files),
 "references_in_root":refs[:100],"uncontained_references":uncontained[:100],"reference_inspection":"TEXT_USDA" if metadata else "BINARY_USD_UNINSPECTED",
 "unpacked_bytes":sum(r["size"] for r in files),
 "test_archive":out_file,"test_archive_bytes":os.stat(out_file).st_size,
 "test_archive_sha256":hashlib.sha256(open(out_file,"rb").read()).hexdigest(),
 "root_file":original_file,"packaging":"ZIP_STORED layer package; geometry unchanged; compatibility only"
 }
 with open(f"{OUT}/manifest.json","w") as f:json.dump(report,f,indent=2)
 print("NVIDIA_SIMREADY_FIXTURE",json.dumps(report),flush=True)
 if uncontained:print("WARNING: uncontained root references detected; production fidelity cannot be certified.")
if __name__=="__main__":
 try:main()
 except Exception as e:print("NVIDIA_SIMREADY_FIXTURE_ERROR",repr(e),file=sys.stderr);raise
