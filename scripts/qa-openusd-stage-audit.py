#!/usr/bin/env python3
"""Inspect *composed* NVIDIA OpenUSD stage with Pixar's OpenUSD implementation.
This QA script never rewrites source geometry, creates GLB, or promotes model
metadata to installed-asset truth. The fixture is downloaded by a separate CI
workflow; its original USD layer files are preserved.
"""
import collections, hashlib, json, os, pathlib, tempfile, zipfile, sys, math

from pxr import Usd, UsdGeom, UsdShade, Sdf

FIXTURE=pathlib.Path(".simready-qa-fixtures/nvidia-simready")
MAX_FILES=256
MAX_BYTES=250*1024*1024
MAX_PRIMS=50000
MAX_EXAMPLES=36

def safe_extract(package, output):
    with zipfile.ZipFile(package) as z:
        if len(z.infolist())>MAX_FILES:raise ValueError("USD package has too many entries")
        if sum(x.file_size for x in z.infolist())>MAX_BYTES:raise ValueError("USD package exceeds safe expanded size")
        for member in z.infolist():
            p=pathlib.PurePosixPath(member.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in member.filename or member.is_dir() and not member.filename.endswith('/'):
                raise ValueError("Unsafe archive entry: "+member.filename)
            out=output.joinpath(*p.parts)
            if member.is_dir():out.mkdir(parents=True,exist_ok=True)
            else:
                out.parent.mkdir(parents=True,exist_ok=True)
                out.write_bytes(z.read(member))

def safe_float(x):
    f=float(x)
    return f if math.isfinite(f) else None

def material_info(material):
    result={"path":str(material.GetPath()),"renderContexts":[],"shaderIds":[],"textureAssets":[]}
    for ctx in ["", "mdl", "mtlx"]:
        try:
            output=material.GetSurfaceOutput(ctx)
            if output and output.HasConnectedSource():result["renderContexts"].append(ctx or "universal")
        except Exception:pass
    ids=set()
    assets=set()
    for shader_prim in Usd.PrimRange(material.GetPrim()):
        if not shader_prim.IsA(UsdShade.Shader):continue
        shader=UsdShade.Shader(shader_prim)
        sid=shader.GetIdAttr().Get()
        if sid:ids.add(str(sid))
        for inp in shader.GetInputs():
            try:
                value=inp.Get()
                if isinstance(value,Sdf.AssetPath):
                    assets.add(value.path)
            except Exception:pass
    result["shaderIds"]=sorted(ids)[:30]
    result["textureAssets"]=sorted(assets)[:100]
    return result

def main():
    source=json.loads((FIXTURE/"manifest.json").read_text())
    package=pathlib.Path(source["test_archive"])
    if not package.is_file():raise ValueError("NVIDIA asset package missing")
    with tempfile.TemporaryDirectory(prefix="stratum-openusd-") as folder:
        directory=pathlib.Path(folder)
        safe_extract(package,directory)
        originalRoot=source["root"].split("/simready_usd/",1)[1]
        root=directory/"simready_usd"/originalRoot
        if not root.is_file():raise ValueError("Cannot find root native USD layer: "+str(root))
        if hashlib.sha256(root.read_bytes()).hexdigest()!=source["root_original_sha256"]:
            raise ValueError("Original root file fingerprint mismatch")
        stage=Usd.Stage.Open(str(root),load=Usd.Stage.LoadAll)
        if not stage:raise ValueError("Pixar OpenUSD could not compose root stage")
        authoredMPU=bool(stage.HasAuthoredMetadata("metersPerUnit"))
        authoredAxis=bool(stage.HasAuthoredMetadata("upAxis"))
        mpu=safe_float(UsdGeom.GetStageMetersPerUnit(stage))
        up=str(UsdGeom.GetStageUpAxis(stage))
        tally=collections.Counter()
        variants=[]
        material_by_path={}
        materials_bound=collections.Counter()
        samplemeshes=[]
        textures=set()
        physics=set()
        allPrims=0
        # Instances hide prototype descendants from ordinary stage traversal.
        # Traverse instance proxies to count visible scene geometry faithfully.
        for prim in stage.Traverse(Usd.TraverseInstanceProxies()):
            allPrims+=1
            if allPrims>MAX_PRIMS:raise ValueError("Stage has too many prims")
            typ=str(prim.GetTypeName() or "untyped")
            tally[typ]+=1
            selections=prim.GetVariantSets().GetNames()
            if selections and len(variants)<MAX_EXAMPLES:
                variants.append({"path":str(prim.GetPath()),"sets":[{"name":name,"selected":prim.GetVariantSets().GetVariantSet(name).GetVariantSelection(),"choices":list(prim.GetVariantSets().GetVariantSet(name).GetVariantNames())[:40]} for name in selections]})
            if "Physics" in typ or "Physx" in typ or "Joint" in typ:
                physics.add(typ)
            if prim.IsA(UsdShade.Material):
                info=material_info(UsdShade.Material(prim))
                material_by_path[info["path"]]=info
                textures.update(info["textureAssets"])
            if prim.IsA(UsdGeom.Mesh):
                if len(samplemeshes)<MAX_EXAMPLES:
                    mesh=UsdGeom.Mesh(prim)
                    pt=mesh.GetPointsAttr().Get()
                    samplemeshes.append({"path":str(prim.GetPath()),"points":len(pt) if pt is not None else 0})
            if prim.IsA(UsdGeom.Gprim):
                try:
                    binding=UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
                    if binding and binding[0]:
                        materials_bound[str(binding[0].GetPath())]+=1
                except Exception:pass
        usedLayers=stage.GetUsedLayers()
        reportedLayers=[]
        unresolved=[]
        for layer in usedLayers:
            location=str(layer.realPath or layer.identifier)
            rel=os.path.relpath(location,directory)
            reportedLayers.append(rel if not rel.startswith("..") else os.path.basename(location))
        materialInfos=list(material_by_path.values())
        displayMaterials=sum("universal" in d["renderContexts"] for d in materialInfos)
        mdlMaterials=sum("mdl" in d["renderContexts"] for d in materialInfos)
        mtlxMaterials=sum("mtlx" in d["renderContexts"] for d in materialInfos)
        report={
            "auditEngine":"Pixar OpenUSD via usd-core 26.8",
            "provenance":{"source":source["source"],"revision":source["revision"],"asset":source["asset"],
                          "originalRootSha256":source["root_original_sha256"],"packageSha256":source["test_archive_sha256"]},
            "stage":{"opened":True,"rootLayer":originalRoot,"usedLayers":reportedLayers,
                     "authoredMetersPerUnit":authoredMPU,"metersPerUnit":mpu if authoredMPU else None,
                     "effectiveMetersPerUnit":mpu,"authoredUpAxis":authoredAxis,"upAxis":up if authoredAxis else None,
                     "effectiveUpAxis":up,"defaultPrim":str(stage.GetDefaultPrim().GetPath()) if stage.GetDefaultPrim() else None,
                     "prims":allPrims,"instanceProxyGeometryIncluded":True,"primTypes":dict(tally),"meshExamples":samplemeshes,"variants":variants},
            "materials":{"total":len(materialInfos),"previewSurfaceContexts":displayMaterials,"mdlContexts":mdlMaterials,
                         "mtlxContexts":mtlxMaterials,"bindingCount":sum(materials_bound.values()),
                         "boundMaterialPaths":dict(materials_bound.most_common(20)),
                         "shaderIds":sorted({x for item in materialInfos for x in item["shaderIds"]}),
                         "authoredTexturePaths":sorted(textures)[:200],"examples":materialInfos[:25]},
            "physics":{"authoredTypes":sorted(physics),"simulationRuntimeVerified":False},
            "truth":{"installedAssetIdentityVerified":False,"physicalPlacementVerified":False,"geometryScaleValidatedInViewer":False,
                     "renderFidelityValidatedInViewer":False},
        }
        output=FIXTURE/"openusd-stage-audit.json"
        output.write_text(json.dumps(report,indent=2))
        print("OPENUSD_STAGE_AUDIT",json.dumps({
            "opened":True,"prims":allPrims,"meshes":tally["Mesh"],"authored_metersPerUnit":authoredMPU,
            "metersPerUnit":report["stage"]["metersPerUnit"],"upAxis":report["stage"]["upAxis"],
            "layers":len(reportedLayers),"variants":len(variants),"materials":len(materialInfos),
            "mdlMaterials":mdlMaterials,"previewMaterials":displayMaterials,"materialBindings":sum(materials_bound.values()),
            "texturePaths":len(textures),"physicsTypes":sorted(physics),
            "auditPath":str(output)},separators=(',',':')))
        print("OPENUSD_STAGE_DIAGNOSTICS",json.dumps({
            "primTypes":report["stage"]["primTypes"],
            "usedLayers":report["stage"]["usedLayers"],
            "variants":report["stage"]["variants"],
            "materials":report["materials"]["examples"],
            "defaultPrim":report["stage"]["defaultPrim"],
            "composedPrims":[{"path":str(p.GetPath()),"type":str(p.GetTypeName()),"active":p.IsActive(),"instance":p.IsInstance(),"instanceProxy":p.IsInstanceProxy()} for p in stage.Traverse(Usd.TraverseInstanceProxies())][:40]
        },separators=(',',':')))
        if tally["Mesh"]==0:raise ValueError("OpenUSD composed no meshes; inspect variants and missing source references")
if __name__=="__main__":main()
