import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-NQ4KR5QH-CEl1VQ3q.js";
import { _ as __name } from "./mermaid.core-DKMXP2GM.js";
import "./chunk-55IACEB6-BRRW4KSl.js";
import "./chunk-KX2RTZJC-jIg_eQrY.js";
import "./index-DiOmJOvx.js";
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
