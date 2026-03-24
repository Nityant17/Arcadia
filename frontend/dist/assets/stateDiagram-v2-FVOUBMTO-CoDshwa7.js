import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-NQ4KR5QH-BCkApjwd.js";
import { _ as __name } from "./mermaid.core-D9eyIHT7.js";
import "./chunk-55IACEB6-Bb7AOCve.js";
import "./chunk-KX2RTZJC-C2Cs33Dd.js";
import "./index-BIuCLFr_.js";
var diagram = {
  parser: stateDiagram_default,
  get db() {
    return new StateDB(2);
  },
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
