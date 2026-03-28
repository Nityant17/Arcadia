import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-D0Ry6tjJ.js";
import { _ as __name } from "./mermaid.core-DKMXP2GM.js";
import "./chunk-FMBD7UC4-CHnZQ2Gr.js";
import "./chunk-JSJVCQXG-DRKp1Id6.js";
import "./chunk-55IACEB6-BRRW4KSl.js";
import "./chunk-KX2RTZJC-jIg_eQrY.js";
import "./index-DiOmJOvx.js";
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
