export type PaperMetadata = {
  title: string;
  abstract: string;
};

/**
 * Local paper metadata for the mock fallback.
 *
 * The source CSV has no title or abstract columns. Live API records may carry
 * enriched `title`/`abstract` fields; these entries keep the mock path
 * representative until the enrichment pipeline is wired up.
 */
export const PAPER_METADATA: Record<string, PaperMetadata> = {
  "10.1016/j.matlet.2020.129009": {
    title: "Compositional control of Young's modulus in Ti–Al–Cr–N nitride films",
    abstract:
      "Ti–Al–Cr–N films with an Al-rich composition were deposited by reactive magnetron sputtering and characterized by nanoindentation. The measured Young's modulus reaches 467 GPa, and the role of the Al content in the film's elastic response is discussed alongside its coating application.",
  },
  "10.1016/j.surfcoat.2018.04.012": {
    title: "Hardness of reactive-sputtered TiN coatings",
    abstract:
      "Stoichiometric TiN coatings were grown by reactive sputtering and tested for hardness. The study reports a hardness of 24 GPa and relates the coating microstructure to its wear-resistant behavior.",
  },
  "10.1016/j.jeurceramsoc.2019.02.018": {
    title: "Dielectric response of dense alumina ceramics",
    abstract:
      "Dense Al2O3 ceramics were prepared by conventional sintering and their dielectric properties measured at room temperature. A dielectric constant of 9.2 is reported, with the influence of porosity and grain size on the response highlighted.",
  },
  "10.1016/j.jpowsour.2021.229876": {
    title: "Discharge capacity of olivine LiFePO4 cathodes",
    abstract:
      "Olivine LiFePO4 electrodes were cycled in lithium cells to evaluate their accessible capacity. The material delivers 160 mAh/g, and the relationship between the olivine composition and capacity retention is examined.",
  },
  "10.1063/1.4987654": {
    title: "Grain-size effects on the dielectric constant of BaTiO3 ceramics",
    abstract:
      "BaTiO3 ceramics with controlled grain size were fabricated and characterized electrically. The room-temperature dielectric constant reaches 1200, and the results are discussed in the context of capacitor applications.",
  },
  "10.1103/PhysRevB.91.104508": {
    title: "Critical-temperature optimization in YBa2Cu3O7−δ",
    abstract:
      "The superconducting transition of YBa2Cu3O7−δ was studied as a function of processing. A critical temperature of 92 K is reported, together with a discussion of oxygen ordering and phase purity.",
  },
  "10.1111/jace.14201": {
    title: "Thermal conductivity of pressureless-sintered SiC",
    abstract:
      "Silicon carbide ceramics were densified without applied pressure and their thermal transport measured. The samples exhibit a thermal conductivity of 120 W/m·K, relevant to power-electronics packaging.",
  },
  "10.1063/1.4872145": {
    title: "Optical band gap of MOCVD-grown GaN epilayers",
    abstract:
      "GaN epilayers grown by metal-organic chemical vapor deposition were characterized by optical spectroscopy. The measured band gap of 3.4 eV is consistent with wurtzite GaN and supports its use in LEDs.",
  },
  "10.1016/j.actamat.2022.117832": {
    title: "Yield strength of the single-phase FeCoNiCrMn high-entropy alloy",
    abstract:
      "A single-phase equiatomic FeCoNiCrMn alloy was processed and tested in compression. The alloy reaches a yield strength of 1200 MPa, and the contributions of solid-solution strengthening and grain size are discussed.",
  },
  "10.1021/jp406123z": {
    title: "Band-gap engineering in anatase TiO2",
    abstract:
      "Anatase TiO2 powders were examined by diffuse-reflectance spectroscopy to determine their optical gap. A band gap of 3.2 eV is reported, with implications for photocatalytic activity.",
  },
  "10.1016/j.jeurceramsoc.2020.01.023": {
    title: "Fracture toughness of yttria-stabilized zirconia",
    abstract:
      "Yttria-stabilized ZrO2 ceramics were sintered and tested by indentation. The measured fracture toughness of 10 MPa·m^0.5 is interpreted in terms of the tetragonal-to-monoclinic transformation and thermal-barrier performance.",
  },
  "10.1016/j.addma.2021.102345": {
    title: "Tensile response of laser powder-bed-fused AlSi10Mg",
    abstract:
      "AlSi10Mg specimens were additively manufactured by laser powder-bed fusion and tested in tension. The as-built material reaches a tensile strength of 400 MPa, and the effects of the Si-rich cellular microstructure are considered.",
  },
  "10.1007/s40830-019-00212-x": {
    title: "Transformation temperatures in near-equiatomic NiTi",
    abstract:
      "Near-equiatomic NiTi was characterized by differential scanning calorimetry to determine its martensitic transformation temperatures. A transformation temperature of 65 °C is reported, with relevance to medical-device actuation.",
  },
  "10.1016/j.joule.2020.05.012": {
    title: "Band-gap stability in cesium lead iodide perovskites",
    abstract:
      "CsPbI3 films were prepared and their optical properties tracked during processing. A band gap of 1.7 eV is measured, and the phase stability relevant to photovoltaic absorbers is discussed.",
  },
  "10.1016/j.tsf.2012.03.045": {
    title: "Hardness and wear resistance of CrN thin films",
    abstract:
      "CrN films deposited by reactive magnetron sputtering were evaluated for hardness and wear. The coatings exhibit a hardness of 18 GPa and are discussed as wear-protection layers.",
  },
  "10.1016/j.matlet.2014.06.083": {
    title: "Composition dependence of density and hardness in AgI–GeS2–Sb2S3 glasses",
    abstract:
      "AgI–GeS2–Sb2S3 chalcogenide glasses were prepared across a wide AgI range and characterized for density and hardness. Both properties increase with AgI content, and the results are discussed for energy-related glass applications.",
  },
  "10.1016/S0167-577X(01)00625-5": {
    title: "Density and glass transition behaviour of BaO–La2O3/LaF3–TeO2 tellurite glasses",
    abstract:
      "Tellurite glasses in the BaO–La2O3–LaF3–TeO2 system were synthesized and measured for density and glass transition temperature. Substituting LaF3 for La2O3 lowers both properties, consistent with fluorine modifying the tellurite network.",
  },
};
