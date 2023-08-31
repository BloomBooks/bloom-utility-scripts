import * as fs from "fs";
import * as path from "path";

interface FileData {
  content: string;
  paths: string[];
}

const boilerplate =
  '/*  Some books may need control over aspects of layout that cannot yet be adjusted\r\n    from the Bloom interface. In those cases, Bloom provides this "under the hood" method\r\n    of creating style rules using the underlying "Cascading Stylesheets" system.\r\n    These rules are then applied to all books in this collection.  EDIT THIS FILE ONLY\r\n    IN THE COLLECTION FOLDER:  changes made to a copy found in the book folder will be\r\n    lost the next time the book is edited with Bloom!\r\n\r\n Note: you can also add a file named "customBookStyles.css" in the book folder,\r\n    to limit the effects of the rules to just that one book.\r\n\r\n    You can learn about CSS from hundreds of books, or online. However chances are, if\r\n    you need this customization, you will need an expert to create a version of this file\r\n    for you, or give you rules that you can paste in below this line. */';

const boilerplate2 =
  '/*  Some books may need control over aspects of layout that cannot yet be adjusted\r\n    from the Bloom interface. In those cases, Bloom provides this "under the hood" method\r\n    of creating style rules using the underlying "Cascading Stylesheets" system. \r\n    These rules are then applied to all books in this collection.\r\n\r\n Note: you can also add a file named "customBookStyles.css" in the book folder,\r\n    to limit the effects of the rules to just that one book.\r\n \r\n    You can learn about CSS from hundreds of books, or online. However chances are, if\r\n    you need this customization, you will need an expert to create a version of this file\r\n    for you, or give you rules that you can paste in below this line. */';
let count = 0;
function readFilesRecursively(
  dir: string,
  fileMap: Map<string, FileData>
): void {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (count > 100000) return;
    if (fs.statSync(filePath).isDirectory()) {
      readFilesRecursively(filePath, fileMap);
    } else {
      const content = fs
        .readFileSync(filePath, "utf8")
        .replace(boilerplate, "")
        .replace(boilerplate2, "")
        .trim();
      if (content === "") continue;

      const fileData: FileData = fileMap.get(content) || { content, paths: [] };
      fileData.paths.push(
        dir.replace("/mnt/c/dev/BloomBulkDownloader/sync", "")
      );
      fileMap.set(content, fileData);
      console.log(++count + " " + dir);
    }
  }
}

function writeUniqueFiles(dir: string, fileMap: Map<string, FileData>): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const indexFilePath = path.join(dir, "index.json");
  const indexFileContent = JSON.stringify(
    Array.from(fileMap.values()),
    null,
    2
  );
  fs.writeFileSync(indexFilePath, indexFileContent);
}

const sourceDir = "/mnt/c/dev/BloomBulkDownloader/sync";
const targetDir = "/mnt/c/dev/BloomBulkDownloader/unique";
const fileMap = new Map<string, FileData>();
readFilesRecursively(sourceDir, fileMap);
writeUniqueFiles(targetDir, fileMap);
