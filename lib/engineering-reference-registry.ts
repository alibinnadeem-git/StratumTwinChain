export type EngineeringReference={
 id:string;publisher:string;code:string;edition:string|null;title:string;category:string;
 publisherUrl:string;publishedReferenceVerifiedAsOf:string;
 applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION';
};

export const ENGINEERING_REFERENCE_REGISTRY:EngineeringReference[]=[
 {id:'nfpa-70-2026',publisher:'NFPA',code:'NFPA 70',edition:'2026',title:'National Electrical Code',category:'ELECTRICAL_CODE',publisherUrl:'https://www.nfpa.org/70',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'nfpa-70e-2024',publisher:'NFPA',code:'NFPA 70E',edition:'2024',title:'Standard for Electrical Safety in the Workplace',category:'ELECTRICAL_SAFETY',publisherUrl:'https://www.nfpa.org/70e',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'ashrae-90-1-2025',publisher:'ASHRAE/IES',code:'ASHRAE 90.1',edition:'2025',title:'Energy Standard for Sites and Buildings Except Low-Rise Residential Buildings',category:'BUILDING_ENERGY',publisherUrl:'https://www.ashrae.org/technical-resources/standards-and-guidelines/read-only-versions-of-ashrae-standards',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'ashrae-62-1-2025',publisher:'ASHRAE',code:'ASHRAE 62.1',edition:'2025',title:'Ventilation and Acceptable Indoor Air Quality',category:'VENTILATION_IAQ',publisherUrl:'https://www.ashrae.org/technical-resources/standards-and-guidelines/titles-purposes-and-scopes',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'ashrae-15-2024',publisher:'ASHRAE',code:'ASHRAE 15',edition:'2024',title:'Safety Standard for Refrigeration Systems',category:'REFRIGERATION_SAFETY',publisherUrl:'https://www.ashrae.org/technical-resources/bookstore/ashrae-refrigeration-resources',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'iso-16739-1-2024',publisher:'ISO',code:'ISO 16739-1',edition:'2024',title:'Industry Foundation Classes (IFC) for data sharing — Part 1: Data schema',category:'BIM_INTEROPERABILITY',publisherUrl:'https://www.iso.org/standard/84123.html',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'iso-55001-2024',publisher:'ISO',code:'ISO 55001',edition:'2024',title:'Asset management — Asset management system — Requirements',category:'ASSET_MANAGEMENT',publisherUrl:'https://www.iso.org/standard/83054.html',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'iso-27001-2022',publisher:'ISO/IEC',code:'ISO/IEC 27001',edition:'2022',title:'Information security management systems — Requirements',category:'INFORMATION_SECURITY',publisherUrl:'https://www.iso.org/standard/27001',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'},
 {id:'iso-42001-2023',publisher:'ISO/IEC',code:'ISO/IEC 42001',edition:'2023',title:'Artificial intelligence — Management system',category:'AI_GOVERNANCE',publisherUrl:'https://www.iso.org/standard/42001',publishedReferenceVerifiedAsOf:'2026-09-22',applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'}
];

export function engineeringReference(id:string){return ENGINEERING_REFERENCE_REGISTRY.find(item=>item.id===id)||null}
