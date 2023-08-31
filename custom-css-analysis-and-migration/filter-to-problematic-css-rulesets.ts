import fs from "fs";

interface Record {
  content: string;
  paths: string[];
}

const data = fs.readFileSync("have-custom.json", "utf8");
const records: Record[] = JSON.parse(data);

const count = records.reduce((acc, record) => acc + record.paths.length, 0);
console.write(`total books with custom css rules: ${count}\r\n`);
console.write(`total unique css files: ${records.length}\r\n`);

const filteredRecords = records.filter((record) => {
  return record.content.includes("left") || record.content.includes("width");
});

// in filteredRecords.paths, we want to remove any path that has the same filename as another path
const recordsWithUniqueifiedPaths = filteredRecords.map((record) => {
  const paths = record.paths;
  const filenames = paths.map((path) => path.split("/").pop() || "error");
  const uniqueFilenames = Array.from(new Set(filenames));
  const uniquePaths = uniqueFilenames.map((filename) => {
    return paths.find((path) => path.endsWith(filename));
  });
  return {
    book_count: paths.length,
    unique_named_books: uniquePaths.length,
    css: record.content,
    paths,
    uniqueified_paths: uniquePaths,
  };
});

const sortedRecords = recordsWithUniqueifiedPaths.sort((a, b) => {
  return a.uniqueified_paths.length - b.uniqueified_paths.length;
});

fs.writeFileSync(
  "problematic-rules.json",
  JSON.stringify(sortedRecords, null, 2)
);

console.write(
  `unique CSS files with problematic rules: ${filteredRecords.length}`
);
console.write(
  `, covering ${filteredRecords.reduce(
    (acc, record) => acc + record.paths.length,
    0
  )} books, `
);

console.write(
  `${recordsWithUniqueifiedPaths.reduce(
    (acc, record) => acc + record.uniqueified_paths.length,
    0
  )} of which have unique names (should remove most rebrands).\r\n`
);
