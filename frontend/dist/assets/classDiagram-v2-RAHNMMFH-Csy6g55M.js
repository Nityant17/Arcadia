import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-DtBlk9VO.js";
import { _ as __name } from "./mermaid.core-BA8xRTj0.js";
import "./chunk-FMBD7UC4-D5elhuOH.js";
import "./chunk-JSJVCQXG-DWTsYKmV.js";
import "./chunk-55IACEB6-CpO7-m3i.js";
import "./chunk-KX2RTZJC-1IR5C6TH.js";
import "./index-25aGJTig.js";
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
