import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-DOlVA-3G.js";
import { _ as __name } from "./mermaid.core-k0tqvYgB.js";
import "./chunk-FMBD7UC4-B3oLYwro.js";
import "./chunk-JSJVCQXG-xU1uWLyc.js";
import "./chunk-55IACEB6-CFNmAQAx.js";
import "./chunk-KX2RTZJC-Dm6OPzOC.js";
import "./index-CfiuZPKT.js";
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
