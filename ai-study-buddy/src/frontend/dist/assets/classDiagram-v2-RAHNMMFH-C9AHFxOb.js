import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-D0B_FjYC.js";
import { _ as __name } from "./mermaid.core-CIoT9Hm5.js";
import "./chunk-FMBD7UC4-B1jVbNxy.js";
import "./chunk-JSJVCQXG-Cn8a1vss.js";
import "./chunk-55IACEB6-K7boEKyi.js";
import "./chunk-KX2RTZJC-DWS_qlQz.js";
import "./index-BPFE1eK5.js";
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
