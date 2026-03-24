import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-Bl4BDR9Z.js";
import { _ as __name } from "./mermaid.core-D9eyIHT7.js";
import "./chunk-FMBD7UC4-CDgBeig5.js";
import "./chunk-JSJVCQXG-BNCaOGG6.js";
import "./chunk-55IACEB6-Bb7AOCve.js";
import "./chunk-KX2RTZJC-C2Cs33Dd.js";
import "./index-BIuCLFr_.js";
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
