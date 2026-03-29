import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-NQ4KR5QH-DTgtCiOr.js";
import { _ as __name } from "./mermaid.core-BA8xRTj0.js";
import "./chunk-55IACEB6-CpO7-m3i.js";
import "./chunk-KX2RTZJC-1IR5C6TH.js";
import "./index-25aGJTig.js";
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
