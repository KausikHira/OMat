// plotly.js-cartesian-dist-min ships no TypeScript declarations. The module
// is only consumed by react-plotly.js's factory, whose parameter is typed as
// `object` (@types/react-plotly.js/factory.d.ts), so a structural `object`
// declaration is all the type system needs.
declare module "plotly.js-cartesian-dist-min" {
  const Plotly: object;
  export default Plotly;
}
