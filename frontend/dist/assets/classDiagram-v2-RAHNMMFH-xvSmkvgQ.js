import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-BJbgyCdJ.js";
import { _ as __name } from "./mermaid.core-yj2sqqcc.js";
import "./chunk-FMBD7UC4-Bj9cP6Mf.js";
import "./chunk-JSJVCQXG-jeB3T_1K.js";
import "./chunk-55IACEB6-xQM4fIsO.js";
import "./chunk-KX2RTZJC-zs_ao3Rh.js";
import "./index-qVehtlCR.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
