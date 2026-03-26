import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-AiCLxHXs.js";
import { _ as __name } from "./mermaid.core-3fdUxNPU.js";
import "./chunk-FMBD7UC4-pYFL4w_N.js";
import "./chunk-JSJVCQXG-BuYTVQjX.js";
import "./chunk-55IACEB6-BjAGRxgx.js";
import "./chunk-KX2RTZJC-DtTEf4gJ.js";
import "./index-DxZO_uvP.js";
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
