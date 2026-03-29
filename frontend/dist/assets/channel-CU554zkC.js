import { aq as Utils, ar as Color } from "./mermaid.core-BA8xRTj0.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
