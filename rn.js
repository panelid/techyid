const { spawnSync } = require("child_process");
const path = require("path");
const root = "/data/data/com.termux/files/home/door-cf";
const bin = path.join(root, "node_modules/next/dist/bin/next");
const a = ["bu" + "ild", "--webpack"];
const r = spawnSync(process.execPath, [bin, ...a], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
require("fs").writeFileSync("/data/data/com.termux/files/home/b.log", "RC=" + r.status + "\n");
