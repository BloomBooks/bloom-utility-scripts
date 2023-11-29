// This looks at all the stylesheets, groups them into unique sets of rules,
// and then outputs the results as json file. See README.md for use.
// It takes a single optional argument, which is the number of books to process.

import * as fs from "fs";
import * as path from "path";

interface FileData {
  content: string;
  paths: string[];
}

const boilerplate =
  /\/\*  Some books may need control over aspects of layout that cannot yet be adjusted(.|[\r\n])*?\*\//;

let count = 0;
function readFilesRecursively(
  dir: string,
  fileMap: Map<string, FileData>
): void {
  const files = fs.readdirSync(dir);
  let cssCount = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (Bun.argv.length > 2 && count >= Number.parseInt(Bun.argv[2])) return;
    if (fs.statSync(filePath).isDirectory()) {
      readFilesRecursively(filePath, fileMap);
    } else {
      if (file === "meta.json") continue;
      const content = fs
        .readFileSync(filePath, "utf8")
        .replace(boilerplate, "")
        .trim();
      if (content === "") continue;
      ++cssCount;

      const fileData: FileData = fileMap.get(content) || { content, paths: [] };
      fileData.paths.push(dir.replace("./output/downloads", ""));
      fileMap.set(content, fileData);
      console.log(++count + " " + filePath);
    }
  }
  if (cssCount > 1)
    console.log(`WARNING: multiple CSS files with content in ${dir}`);
  cssCount = 0;
}

const sourceDir = "./output/downloads";
const fileMap = new Map<string, FileData>();

if (!fs.existsSync("./output")) {
  fs.mkdirSync("./output");
}

if (fs.existsSync("./output/group-output.json")) {
  fs.rmSync("./output/group-output.json");
}
readFilesRecursively(sourceDir, fileMap);
fs.writeFileSync(
  "./output/group-output.json",
  JSON.stringify(Array.from(fileMap.values()), null, 2)
);
