import { _ as __name, l as log, I as selectSvgElement, e as configureSvgSize } from "./mermaid.core-yj2sqqcc.js";
import { p as parse } from "./treemap-KZPCXAKY-BkdRwEWA.js";
import "./index-qVehtlCR.js";
import "./_baseUniq-C1JmC09o.js";
import "./_basePickBy-DZsDMP5u.js";
import "./clone-DCA0xus0.js";
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};
var DEFAULT_INFO_DB = {
  version: "11.13.0"
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
