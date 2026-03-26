import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-NQ4KR5QH-CJUuBWpw.js";
import { _ as __name } from "./mermaid.core-3fdUxNPU.js";
import "./chunk-55IACEB6-BjAGRxgx.js";
import "./chunk-KX2RTZJC-DtTEf4gJ.js";
import "./index-DxZO_uvP.js";
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
