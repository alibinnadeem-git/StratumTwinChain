import ModelRegistryManager from '@/components/ModelRegistryManager';
import OemCadAcquisitionQueue from '@/components/OemCadAcquisitionQueue';
import OemCadVerificationWorkbench from '@/components/OemCadVerificationWorkbench';
import OemSourceDirectory from '@/components/OemSourceDirectory';
import {ELECTRICAL_CATEGORIES,ELECTRICAL_COMPONENTS} from '@/lib/electrical-component-library';
import styles from './page.module.css';

export default function ComponentLibraryPage(){
 return <div className={styles.page}>
  <header className={styles.hero}>
   <div><span>STRATUM SPATIAL ENGINE</span><h1>Electrical Component Library</h1><p>Canonical real-world electrical object classes used by the Spatial Compiler and STRATUM Spatial Verified. Recognized equipment is represented as attributable equipment—not anonymous geometry—and source, confidence and review state remain explicit.</p></div>
   <div className={styles.stats}><b>{ELECTRICAL_COMPONENTS.length}</b><span>component classes</span></div>
  </header>
  <div className={styles.notice}>Each class carries recognition aliases, a visual fallback, whether it should normally become a durable STRATUM Asset identity, and an optional detailed GLB/GLTF/OpenUSD model mapping. Representative geometry does not establish an OEM, SKU or installed dimensions.</div>
  <OemCadAcquisitionQueue/>
  <OemCadVerificationWorkbench/>
  <OemSourceDirectory/>
  <ModelRegistryManager/>
  <div className={styles.grid}>{ELECTRICAL_CATEGORIES.map(category=>{
   const items=ELECTRICAL_COMPONENTS.filter(c=>c.category===category);
   return <section className={styles.category} key={category}><div className={styles.categoryHead}><h2>{category}</h2><span>{items.length}</span></div><div className={styles.cards}>{items.map(item=><article id={item.key} key={item.key} className={styles.card}><div className={`${styles.icon} ${styles[item.twinShape]||''}`}><i/><i/><i/></div><h3>{item.name}</h3><div className={styles.meta}><span>{item.twinShape.replaceAll('-',' ')}</span><b>{item.trackAsAsset?'TRACKED ASSET':'CONTEXT OBJECT'}</b></div><small>{item.aliases.slice(0,3).join(' · ')}</small></article>)}</div></section>;
  })}</div>
  <section className={styles.attributes}><h2>Spatial Asset Object Attributes</h2><div>{['Unique ID / Tag','Component Class','Manufacturer','Model / Type','Serial Number','Electrical Rating','Voltage / Current / kW / kVA','Phase','Project / Site','Floor / Room / Zone','XYZ Position + Rotation','Source Drawing / Sheet','Design Revision','Install Date','Lifecycle Status','Commissioning State','Warranty','Maintenance Plan','Operational Health','Evidence Package','Linked Documents','QR / NFC / Barcode','DIR Record / Proof'].map(x=><span key={x}>{x}</span>)}</div></section>
 </div>;
}
