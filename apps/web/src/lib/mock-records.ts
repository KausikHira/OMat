import { PAPER_METADATA } from "./paper-metadata";

export type ElementAmount = {
  symbol: string;
  value: number;
  unit: "mol" | "wt";
};

export type PropertyValue = {
  name: string;
  slug: string;
  value: number;
  unit: string;
};

export type Application = {
  label: string;
  slug: string;
};

export type Measurement = {
  id: string;
  pii: string;
  doi: string;
  journal: string;
  journalSlug: string;
  year: number;
  // Not present in final_data.csv; API records leave this undefined.
  table?: number;
  composition: string;
  elements: string[];
  amounts: ElementAmount[];
  property: PropertyValue;
  applications: Application[];
  // Enrichment fields; absent from the CSV and populated by the API when available.
  title?: string;
  abstract?: string;
};

const RECORDS: Measurement[] = [
  {
    id: "S0167577X2031716X_0_1",
    pii: "S0167577X2031716X",
    doi: "10.1016/j.matlet.2020.129009",
    journal: "Materials Letters",
    journalSlug: "materials-letters",
    year: 2020,
    table: 1,
    composition: "TiAl70CrN",
    elements: ["Al", "Cr", "N", "Ti"],
    amounts: [
      { symbol: "Al", value: 95.89, unit: "mol" },
      { symbol: "Cr", value: 1.37, unit: "mol" },
      { symbol: "N", value: 1.37, unit: "mol" },
      { symbol: "Ti", value: 1.37, unit: "mol" },
    ],
    property: { name: "Young's modulus", slug: "youngs-modulus", value: 467, unit: "GPa" },
    applications: [{ label: "Coatings / Barriers", slug: "coatings-barriers" }],
  },
  {
    id: "S0257890118300456_0_1",
    pii: "S0257890118300456",
    doi: "10.1016/j.surfcoat.2018.04.012",
    journal: "Surface and Coatings Technology",
    journalSlug: "surface-and-coatings-technology",
    year: 2018,
    table: 2,
    composition: "TiN",
    elements: ["N", "Ti"],
    amounts: [
      { symbol: "Ti", value: 50, unit: "mol" },
      { symbol: "N", value: 50, unit: "mol" },
    ],
    property: { name: "Hardness", slug: "hardness", value: 24, unit: "GPa" },
    applications: [{ label: "Hard coatings", slug: "hard-coatings" }],
  },
  {
    id: "S0955221919301234_0_1",
    pii: "S0955221919301234",
    doi: "10.1016/j.jeurceramsoc.2019.02.018",
    journal: "Journal of the European Ceramic Society",
    journalSlug: "journal-of-the-european-ceramic-society",
    year: 2019,
    table: 1,
    composition: "Al2O3",
    elements: ["Al", "O"],
    amounts: [
      { symbol: "Al", value: 40, unit: "mol" },
      { symbol: "O", value: 60, unit: "mol" },
    ],
    property: { name: "Dielectric constant", slug: "dielectric-constant", value: 9.2, unit: "" },
    applications: [{ label: "Electronics", slug: "electronics" }],
  },
  {
    id: "S0378775321004567_0_1",
    pii: "S0378775321004567",
    doi: "10.1016/j.jpowsour.2021.229876",
    journal: "Journal of Power Sources",
    journalSlug: "journal-of-power-sources",
    year: 2021,
    table: 3,
    composition: "LiFePO4",
    elements: ["Fe", "Li", "O", "P"],
    amounts: [
      { symbol: "Li", value: 12.5, unit: "mol" },
      { symbol: "Fe", value: 12.5, unit: "mol" },
      { symbol: "P", value: 12.5, unit: "mol" },
      { symbol: "O", value: 62.5, unit: "mol" },
    ],
    property: {
      name: "Discharge capacity",
      slug: "discharge-capacity",
      value: 160,
      unit: "mAh/g",
    },
    applications: [{ label: "Batteries", slug: "batteries" }],
  },
  {
    id: "S0003695117301234_0_1",
    pii: "S0003695117301234",
    doi: "10.1063/1.4987654",
    journal: "Applied Physics Letters",
    journalSlug: "applied-physics-letters",
    year: 2017,
    table: 1,
    composition: "BaTiO3",
    elements: ["Ba", "O", "Ti"],
    amounts: [
      { symbol: "Ba", value: 20, unit: "mol" },
      { symbol: "Ti", value: 20, unit: "mol" },
      { symbol: "O", value: 60, unit: "mol" },
    ],
    property: {
      name: "Dielectric constant",
      slug: "dielectric-constant",
      value: 1200,
      unit: "",
    },
    applications: [{ label: "Capacitors", slug: "capacitors" }],
  },
  {
    id: "S1098012115001234_0_1",
    pii: "S1098012115001234",
    doi: "10.1103/PhysRevB.91.104508",
    journal: "Physical Review B",
    journalSlug: "physical-review-b",
    year: 2015,
    table: 2,
    composition: "YBa2Cu3O7",
    elements: ["Ba", "Cu", "O", "Y"],
    amounts: [
      { symbol: "Y", value: 8.3, unit: "mol" },
      { symbol: "Ba", value: 16.7, unit: "mol" },
      { symbol: "Cu", value: 25, unit: "mol" },
      { symbol: "O", value: 50, unit: "mol" },
    ],
    property: {
      name: "Critical temperature",
      slug: "critical-temperature",
      value: 92,
      unit: "K",
    },
    applications: [{ label: "Superconductors", slug: "superconductors" }],
  },
  {
    id: "S0002782016300456_0_1",
    pii: "S0002782016300456",
    doi: "10.1111/jace.14201",
    journal: "Journal of the American Ceramic Society",
    journalSlug: "journal-of-the-american-ceramic-society",
    year: 2016,
    table: 4,
    composition: "SiC",
    elements: ["C", "Si"],
    amounts: [
      { symbol: "Si", value: 50, unit: "mol" },
      { symbol: "C", value: 50, unit: "mol" },
    ],
    property: {
      name: "Thermal conductivity",
      slug: "thermal-conductivity",
      value: 120,
      unit: "W/m·K",
    },
    applications: [{ label: "Power electronics", slug: "power-electronics" }],
  },
  {
    id: "S0003695114300567_0_1",
    pii: "S0003695114300567",
    doi: "10.1063/1.4872145",
    journal: "Applied Physics Letters",
    journalSlug: "applied-physics-letters",
    year: 2014,
    table: 1,
    composition: "GaN",
    elements: ["Ga", "N"],
    amounts: [
      { symbol: "Ga", value: 50, unit: "mol" },
      { symbol: "N", value: 50, unit: "mol" },
    ],
    property: { name: "Band gap", slug: "band-gap", value: 3.4, unit: "eV" },
    applications: [{ label: "LEDs", slug: "leds" }],
  },
  {
    id: "S1359645422007890_0_1",
    pii: "S1359645422007890",
    doi: "10.1016/j.actamat.2022.117832",
    journal: "Acta Materialia",
    journalSlug: "acta-materialia",
    year: 2022,
    table: 2,
    composition: "FeCoNiCrMn",
    elements: ["Co", "Cr", "Fe", "Mn", "Ni"],
    amounts: [
      { symbol: "Fe", value: 20, unit: "mol" },
      { symbol: "Co", value: 20, unit: "mol" },
      { symbol: "Ni", value: 20, unit: "mol" },
      { symbol: "Cr", value: 20, unit: "mol" },
      { symbol: "Mn", value: 20, unit: "mol" },
    ],
    property: { name: "Yield strength", slug: "yield-strength", value: 1200, unit: "MPa" },
    applications: [{ label: "Structural alloys", slug: "structural-alloys" }],
  },
  {
    id: "S0022369713300456_0_1",
    pii: "S0022369713300456",
    doi: "10.1021/jp406123z",
    journal: "Journal of Physical Chemistry C",
    journalSlug: "journal-of-physical-chemistry-c",
    year: 2013,
    table: 1,
    composition: "TiO2",
    elements: ["O", "Ti"],
    amounts: [
      { symbol: "Ti", value: 33.3, unit: "mol" },
      { symbol: "O", value: 66.7, unit: "mol" },
    ],
    property: { name: "Band gap", slug: "band-gap", value: 3.2, unit: "eV" },
    applications: [{ label: "Photocatalysis", slug: "photocatalysis" }],
  },
  {
    id: "S0955221920300789_0_1",
    pii: "S0955221920300789",
    doi: "10.1016/j.jeurceramsoc.2020.01.023",
    journal: "Journal of the European Ceramic Society",
    journalSlug: "journal-of-the-european-ceramic-society",
    year: 2020,
    table: 5,
    composition: "ZrO2",
    elements: ["O", "Zr"],
    amounts: [
      { symbol: "Zr", value: 33.3, unit: "mol" },
      { symbol: "O", value: 66.7, unit: "mol" },
    ],
    property: {
      name: "Fracture toughness",
      slug: "fracture-toughness",
      value: 10,
      unit: "MPa·m^0.5",
    },
    applications: [{ label: "Thermal barriers", slug: "thermal-barriers" }],
  },
  {
    id: "S2214860421003456_0_1",
    pii: "S2214860421003456",
    doi: "10.1016/j.addma.2021.102345",
    journal: "Additive Manufacturing",
    journalSlug: "additive-manufacturing",
    year: 2021,
    table: 2,
    composition: "AlSi10Mg",
    elements: ["Al", "Mg", "Si"],
    amounts: [
      { symbol: "Al", value: 90, unit: "wt" },
      { symbol: "Si", value: 10, unit: "wt" },
      { symbol: "Mg", value: 0.3, unit: "wt" },
    ],
    property: { name: "Tensile strength", slug: "tensile-strength", value: 400, unit: "MPa" },
    applications: [{ label: "Aerospace", slug: "aerospace" }],
  },
  {
    id: "S2352431619000123_0_1",
    pii: "S2352431619000123",
    doi: "10.1007/s40830-019-00212-x",
    journal: "Shape Memory and Superelasticity",
    journalSlug: "shape-memory-and-superelasticity",
    year: 2019,
    table: 1,
    composition: "NiTi",
    elements: ["Ni", "Ti"],
    amounts: [
      { symbol: "Ni", value: 50, unit: "mol" },
      { symbol: "Ti", value: 50, unit: "mol" },
    ],
    property: {
      name: "Transformation temperature",
      slug: "transformation-temperature",
      value: 65,
      unit: "°C",
    },
    applications: [{ label: "Medical devices", slug: "medical-devices" }],
  },
  {
    id: "S2542529320000456_0_1",
    pii: "S2542529320000456",
    doi: "10.1016/j.joule.2020.05.012",
    journal: "Joule",
    journalSlug: "joule",
    year: 2020,
    table: 3,
    composition: "CsPbI3",
    elements: ["Cs", "I", "Pb"],
    amounts: [
      { symbol: "Cs", value: 20, unit: "mol" },
      { symbol: "Pb", value: 20, unit: "mol" },
      { symbol: "I", value: 60, unit: "mol" },
    ],
    property: { name: "Band gap", slug: "band-gap", value: 1.7, unit: "eV" },
    applications: [{ label: "Photovoltaics", slug: "photovoltaics" }],
  },
  {
    id: "S0040609012001234_0_1",
    pii: "S0040609012001234",
    doi: "10.1016/j.tsf.2012.03.045",
    journal: "Thin Solid Films",
    journalSlug: "thin-solid-films",
    year: 2012,
    table: 1,
    composition: "CrN",
    elements: ["Cr", "N"],
    amounts: [
      { symbol: "Cr", value: 50, unit: "mol" },
      { symbol: "N", value: 50, unit: "mol" },
    ],
    property: { name: "Hardness", slug: "hardness", value: 18, unit: "GPa" },
    applications: [{ label: "Wear protection", slug: "wear-protection" }],
  },
  // AgI-GeS2-Sb2S3 chalcogenide glasses (final_data.csv, matlet.2014.06.083):
  // each composition was measured for both density and hardness, so the GSC
  // chart has real pairs to plot in mock mode.
  ...[
    {
      composition: "AgI10-GeS254-Sb2S336",
      amounts: [
        { symbol: "AgI", value: 10, unit: "mol" as const },
        { symbol: "GeS2", value: 54, unit: "mol" as const },
        { symbol: "Sb2S3", value: 36, unit: "mol" as const },
      ],
      density: 3.749,
      hardness: 1.5696,
    },
    {
      composition: "AgI20-GeS248-Sb2S332",
      amounts: [
        { symbol: "AgI", value: 20, unit: "mol" as const },
        { symbol: "GeS2", value: 48, unit: "mol" as const },
        { symbol: "Sb2S3", value: 32, unit: "mol" as const },
      ],
      density: 3.952,
      hardness: 1.39302,
    },
    {
      composition: "AgI30-GeS242-Sb2S328",
      amounts: [
        { symbol: "AgI", value: 30, unit: "mol" as const },
        { symbol: "GeS2", value: 42, unit: "mol" as const },
        { symbol: "Sb2S3", value: 28, unit: "mol" as const },
      ],
      density: 4.192,
      hardness: 1.2753,
    },
    {
      composition: "AgI40-GeS236-Sb2S324",
      amounts: [
        { symbol: "AgI", value: 40, unit: "mol" as const },
        { symbol: "GeS2", value: 36, unit: "mol" as const },
        { symbol: "Sb2S3", value: 24, unit: "mol" as const },
      ],
      density: 4.441,
      hardness: 1.11834,
    },
    {
      composition: "AgI45-GeS233-Sb2S322",
      amounts: [
        { symbol: "AgI", value: 45, unit: "mol" as const },
        { symbol: "GeS2", value: 33, unit: "mol" as const },
        { symbol: "Sb2S3", value: 22, unit: "mol" as const },
      ],
      density: 4.481,
      hardness: 1.02024,
    },
    {
      composition: "AgI50-GeS210-Sb2S340",
      amounts: [
        { symbol: "AgI", value: 50, unit: "mol" as const },
        { symbol: "GeS2", value: 10, unit: "mol" as const },
        { symbol: "Sb2S3", value: 40, unit: "mol" as const },
      ],
      density: 4.762,
      hardness: 1.04967,
    },
  ].flatMap((glass, index) => [
    {
      id: `S0167577X1401132X_${89 + index * 4}_1`,
      pii: "S0167577X1401132X",
      doi: "10.1016/j.matlet.2014.06.083",
      journal: "Materials Letters",
      journalSlug: "materials-letters",
      year: 2014,
      composition: glass.composition,
      elements: ["Ag", "Ge", "I", "S", "Sb"],
      amounts: glass.amounts,
      property: {
        name: "Density",
        slug: "density",
        value: glass.density,
        unit: "g/cm³",
      },
      applications: [{ label: "Energy", slug: "energy" }],
    },
    {
      id: `S0167577X1401132X_${91 + index * 4}_1`,
      pii: "S0167577X1401132X",
      doi: "10.1016/j.matlet.2014.06.083",
      journal: "Materials Letters",
      journalSlug: "materials-letters",
      year: 2014,
      composition: glass.composition,
      elements: ["Ag", "Ge", "I", "S", "Sb"],
      amounts: glass.amounts,
      property: {
        name: "Hardness",
        slug: "hardness",
        value: glass.hardness,
        unit: "GPa",
      },
      applications: [{ label: "Energy", slug: "energy" }],
    },
  ]),
  // BaO-La2O3/LaF3-TeO2 tellurite glasses (final_data.csv, S0167-577X(01)00625-5):
  // measured for both density and glass transition temperature.
  ...[
    {
      composition: "BaO20-La2O310-TeO270",
      elements: ["Ba", "La", "O", "Te"],
      amounts: [
        { symbol: "BaO", value: 20, unit: "mol" as const },
        { symbol: "La2O3", value: 10, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.5003,
      tg: 748.15,
    },
    {
      composition: "BaO20-La2O35-LaF35-TeO270",
      elements: ["Ba", "F", "La", "O", "Te"],
      amounts: [
        { symbol: "BaO", value: 20, unit: "mol" as const },
        { symbol: "La2O3", value: 5, unit: "mol" as const },
        { symbol: "LaF3", value: 5, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.4591,
      tg: 691.15,
    },
    {
      composition: "BaO20-LaF310-TeO270",
      elements: ["Ba", "F", "La", "O", "Te"],
      amounts: [
        { symbol: "BaO", value: 20, unit: "mol" as const },
        { symbol: "LaF3", value: 10, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.3399,
      tg: 673.15,
    },
    {
      composition: "BaF25-BaO15-LaF310-TeO270",
      elements: ["Ba", "F", "La", "O", "Te"],
      amounts: [
        { symbol: "BaF2", value: 5, unit: "mol" as const },
        { symbol: "BaO", value: 15, unit: "mol" as const },
        { symbol: "LaF3", value: 10, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.2603,
      tg: 671.15,
    },
    {
      composition: "BaF2-10-BaO10-LaF310-TeO270",
      elements: ["Ba", "F", "La", "O", "Te"],
      amounts: [
        { symbol: "BaF2", value: 10, unit: "mol" as const },
        { symbol: "BaO", value: 10, unit: "mol" as const },
        { symbol: "LaF3", value: 10, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.2196,
      tg: 672.15,
    },
    {
      composition: "BaF220-LaF310-TeO270",
      elements: ["Ba", "F", "La", "O", "Te"],
      amounts: [
        { symbol: "BaF2", value: 20, unit: "mol" as const },
        { symbol: "LaF3", value: 10, unit: "mol" as const },
        { symbol: "TeO2", value: 70, unit: "mol" as const },
      ],
      density: 5.1006,
      tg: 674.15,
    },
  ].flatMap((glass, index) => [
    {
      id: `S0167577X01006255_${29 + index * 4}_1`,
      pii: "S0167577X01006255",
      doi: "10.1016/S0167-577X(01)00625-5",
      journal: "Materials Letters",
      journalSlug: "materials-letters",
      year: 2001,
      composition: glass.composition,
      elements: glass.elements,
      amounts: glass.amounts,
      property: {
        name: "Density",
        slug: "density",
        value: glass.density,
        unit: "g/cm³",
      },
      applications: [{ label: "Optical / Photonics", slug: "optical-photonics" }],
    },
    {
      id: `S0167577X01006255_${30 + index * 4}_1`,
      pii: "S0167577X01006255",
      doi: "10.1016/S0167-577X(01)00625-5",
      journal: "Materials Letters",
      journalSlug: "materials-letters",
      year: 2001,
      composition: glass.composition,
      elements: glass.elements,
      amounts: glass.amounts,
      property: {
        name: "Glass transition temperature",
        slug: "glass_transition_temperature",
        value: glass.tg,
        unit: "K",
      },
      applications: [{ label: "Optical / Photonics", slug: "optical-photonics" }],
    },
  ]),
];

export const MEASUREMENTS: Measurement[] = RECORDS.map((record) => ({
  ...record,
  ...(PAPER_METADATA[record.doi] ?? {}),
}));

export const datasetStats = (() => {
  const years = MEASUREMENTS.map((record) => record.year);
  const journals = new Set(MEASUREMENTS.map((record) => record.journalSlug));
  const elements = new Set(MEASUREMENTS.flatMap((record) => record.elements));

  return {
    records: MEASUREMENTS.length,
    journals: journals.size,
    elements: elements.size,
    from: Math.min(...years),
    to: Math.max(...years),
  };
})();
