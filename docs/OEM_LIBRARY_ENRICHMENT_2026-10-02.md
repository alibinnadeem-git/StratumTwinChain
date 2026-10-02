# OEM library enrichment — 2026-10-02 UTC

Research/acquisition expansion only: 9 sources and 8 exact-SKU download records added. Eight STEP responses were downloaded and signature/hash inspected, representing seven unique byte sequences. No GLB activation, project identity, geometry validation or redistribution approval is implied.

## Official source evidence

| Source | Observed route / limitation |
|---|---|
| [LOVATO Electric](https://www.lovatoelectric.com/gb_en/document-hub/library-for-cad-software/) | Official CAD library and SKU-specific STEP links. Eight downloads inspected, seven distinct hashes. Family names and mismatched model headers require identity review; no geometry or redistribution approval. |
| [Weidmüller](https://www.weidmuller.com/en/service/consulting_and_digital_engineering/weidmueller_configurator/weidmueller_configurator_wmc.jsp) | Official WMC documentation specifies 3D STEP export. Select exact parts and accessories; software license and exported-model reuse terms must be checked separately. |
| [Leviton](https://leviton.com/support/resources/csi-specs---design-support/wiring-devices) | Official design-support page routes to ARCAT BIM objects. Verify selected SKU, region, file contents and model terms; do not treat a 2D DWG as 3D geometry. |
| [PULS](https://products.pulspower.com/chf/cs5-241.html) | Manufacturer product pages advertise STEP mechanical models. Direct retrieval was blocked in this research environment; files not acquired. DC power-supply class mapping pending; do not map these to a UPS. |
| [Acopian](https://www.acopian.com/autocad.aspx) | Official library provides case-size STEP files. Case geometry is not an exact electrical SKU: reconcile output rating, options and mounting kit separately. File retrieval blocked in this environment; rights and contents unverified. Power-supply class pending. |
| [Finder](https://www.findernet.com/en/worldwide/news/finder-introduces-its-new-cad-model-catalogue-on-partcommunity/) | Official announcement links the Finder PARTcommunity catalog and mentions STP files. Configure exact coil/contact variant. Relay and DC power-supply class mapping pending; availability does not establish reuse rights. |
| [Hammond Manufacturing](https://www.hammfg.com/dci/products/cabinet-systems/h1) | Official H1 page links a BIM package and notes a rolling door-design change. Match cabinet dimensions and door revision. ZIP contents and license not inspected; do not assume the family package contains every accessory. |
| [Pfannenberg](https://www.pfannenbergusa.com/thermal-management-downloads/cooling-units-datasheets-and-downloads/) | Official downloads directory links DTS product records with model/drawing sections. DTS 3021 lists separate 115 V and 230 V order codes; exact file format and coverage remain unverified. Enclosure-cooling class mapping pending. |
| [Pro-face by Schneider Electric](https://www.proface.com/en-us/node/23575) | Official download page identifies PFXZCDADEXR1 and simplified design geometry. Downloads are EXE packages with terms of use; none downloaded or executed. HMI/display-adapter class mapping and redistribution rights pending. |

## Download inspection evidence

The source URLs and hashes below permit reacquisition. CAD originals are not redistributed in this repository.

| SKU | Bytes | SHA-256 | Internal filename |
|---|---:|---|---|
| [BF3200D024](https://catalogue.lovatoelectric.com/ca_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF3200D024.stp) | 12405453 | `799d5b7c6fcb198d50f4a86869943d4e9c3b52654fb0bf797d47b2f3f10ef5ca` | FILE_STP_CAD_DRAWING_3d_BF26_38_D_L_prt.stp. |
| [BF2501D110](https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF2501D110.stp) | 12745384 | `122ad0a0c69987b7c0cab16edb0a7626f6a09e870f23ec149baccee821ebecc8` | 3d_BF09_25_D_L.stp. |
| [BF2501A110](https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF2501A110.stp) | 11367812 | `c4bbb97d3cc476830c88c52565e161e9d4db1cfc3824ddd3b64fd23f87654f24` | 3d_BF09_25_A.stp. |
| [BF1801D024](https://catalogue.lovatoelectric.com/it_it/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF1801D024.stp) | 12745384 | `122ad0a0c69987b7c0cab16edb0a7626f6a09e870f23ec149baccee821ebecc8` | 3d_BF09_25_D_L.stp. |
| [GA025ARY](https://catalogue.lovatoelectric.com/es_es/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_GA025ARY.stp) | 380560 | `7e0f5b3f715e3f6f3bf983e66de9da76bc0b97e8992215a81eb0a2b535ed7a06` | 3d_GA016A.stp. |
| [DMG110](https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG110.stp) | 201485 | `c5e3d337b058751bdafd269d2231502425ba769763184a98d191d5025f7cfe70` | 3d_DMG200.stp. |
| [DMG210L01](https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG210L01.stp) | 201488 | `e41b1a2caea5afc4f145893ca520f5d161246a75e4620e61bbee352cca62f881` | 3d_DMG210L01.stp. |
| [DMG8000](https://catalogue.lovatoelectric.com/de_de/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG8000.stp) | 7981841 | `dba28fc44806b1dc1700401725df4557f61f591592ae0981db584c7451a3cfbd` | FILE_STP_CAD_DRAWING_3D_DMG8000_prt.stp. |

## Interpretation and remaining work

BF2501D110 and BF1801D024 resolve to identical files. BF headers refer to shared families. GA025ARY references GA016A internally and DMG110 references DMG200. These may reflect shared housings or stale mappings; the available evidence cannot distinguish them. Preserve the discrepancy rather than silently approving identity.

Class-pending sources remain searchable in the source directory without assigning them an unrelated electrical class. PULS page links identify exact products; Acopian files identify cases, not electrical SKUs; Hammond H1 is a family package.

Before activating geometry: reconcile exact SKU/configuration and document revision, establish reuse permission, validate source units and measured dimensions, convert and inspect GLB, and pass the existing structured activation gates.
