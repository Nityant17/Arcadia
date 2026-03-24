import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-CJSvUfTL.js";
import { _ as __name } from "./mermaid.core-DKxg3PIr.js";
import "./chunk-FMBD7UC4-CTHXmKHT.js";
import "./chunk-JSJVCQXG-CiobcyXd.js";
import "./chunk-55IACEB6-ED-ewqA3.js";
import "./chunk-KX2RTZJC-CFH_nLbB.js";
import "./index-DiP34-bT.js";
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
