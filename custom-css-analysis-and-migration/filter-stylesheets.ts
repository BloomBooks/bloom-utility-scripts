// This reads in a json of all unique custom sets of rules, drops the ones that don't need to be migrated,
// and then outputs the results as json file. See README.md for use.

import fs from "fs";

interface Record {
  content: string;
  paths: string[];
}

const data = fs.readFileSync("./output/group-output.json", "utf8");
const records: Record[] = JSON.parse(data);

const count = records.reduce((acc, record) => acc + record.paths.length, 0);
console.write(`total books with custom css rules: ${count}\r\n`);
console.write(`total unique css files: ${records.length}\r\n`);

const kProbablyWillInterfere = `\\.marginBox\\s*\\{[^\\}]*?(?<![-\\w])(padding-|left:|top:|right:|bottom:|margin-|width:|height:)[^\\}]*\\}`;
const kProbablyWillInterfereRegex = new RegExp(kProbablyWillInterfere, "gi");

const filteredRecords = records.filter((record) => {
  return kProbablyWillInterfereRegex.test(record.content);
});

// in filteredRecords.paths, we want to remove any path that has the same filename as another path
const recordsWithUniqueifiedPaths = filteredRecords.map((record) => {
  const paths = record.paths;
  const filenames = paths.map((path) => path.split("/").pop() || "error");
  const uniqueFilenames = Array.from(new Set(filenames));
  const uniquePaths = uniqueFilenames.map((filename) => {
    return paths.find((path) => path.endsWith(filename));
  });
  const instanceId = paths[0].split("/")[2];
  return {
    book_count: paths.length,
    unique_named_books: uniquePaths.length,
    first_book: `https://bloomlibrary.org/:search:bookInstanceId%3A${instanceId}`,
    css: record.content,
    paths,
    uniqueified_paths: uniquePaths,
  };
});

const sortedRecords = recordsWithUniqueifiedPaths.sort((a, b) => {
  return b.uniqueified_paths.length - a.uniqueified_paths.length;
});

// insert a metadata record into the first position
(sortedRecords as any).unshift({
  "total books with custom css rules": count,
  "total books with problematic rules": filteredRecords.reduce(
    (acc, record) => acc + record.paths.length,
    0
  ),
  "total unique css files": records.length,
  "unique CSS files with problematic rules": filteredRecords.length,
  "counts of unique books for each unique css file": sortedRecords
    .map((record) => record.uniqueified_paths.length)
    .join(" "),
});

fs.writeFileSync(
  "./output/filter-output.json",
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

// console.write(
//   `${recordsWithUniqueifiedPaths.reduce(
//     (acc, record) => acc + record.uniqueified_paths.length,
//     0
//   )} of which have unique names (should remove most rebrands).\r\n`
// );
