// This reads in a json of the unique custom sets of rules that need migration.
// For each one, it outputs a folder that serves as a draft "migration" for Bloom.
// See README.md for use.

import fs from "fs";

const data = fs.readFileSync("./output/filter-output.json", "utf8");

// TODO: see https://issues.bloomlibrary.org/youtrack/issue/BL-12857
