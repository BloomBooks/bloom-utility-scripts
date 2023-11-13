// This reads in a json of the unique custom sets of rules that need migration.
// For each one, it outputs a folder that serves as a draft "migration" for Bloom.
// See README.md for use.

import fs from "fs";
import crypto from "crypto";
import { migrateCssToAppearance } from "./migrateCssToAppearance";

const data = fs.readFileSync("./output/filter-output.json", "utf8");
const records = JSON.parse(data);

/* a typical rule looks like this:
  {
    "book_count": 1,
    "unique_named_books": 1,
    "first_book": "https://bloomlibrary.org/:search:bookInstanceId%3Arajib_mitra@sil-lead.org",
    "css": ".marginBox{left:3mm}",
    "paths": [
        "output/downloads/rajib_mitra@sil-lead.org/019ec209-8918-4d0b-b4ac-1ce3f146e256/Koni ni Ɲɔhɔɲɛgɛnɛ Jojo"
      ],
      "uniqueified_paths": [
        "output/downloads/rajib_mitra@sil-lead.org/019ec209-8918-4d0b-b4ac-1ce3f146e256/Koni ni Ɲɔhɔɲɛgɛnɛ Jojo"
      ]
    }
*/

// Delete all files and folders in the output folder
fs.rmdirSync("./output/migration", { recursive: true });
fs.mkdirSync("./output/migration");

// For each record, get a checksum of the css, and use that as the name of the folder.
// Then create a folder with that name, and copy the css into it.

let count = 0;
for (const record of records) {
  if (record.css === undefined) continue;

  ++count;
  if (Bun.argv.length > 2 && count >= Number.parseInt(Bun.argv[2])) break;
  console.log(`css = ${record.css}`);
  const checksum = crypto.createHash("md5").update(record.css).digest("hex");
  const folder = `./output/migration/${count} ${checksum}`;
  fs.mkdirSync(folder);

  fs.writeFileSync(
    `${folder}/customBookStyles.css`,
    migrateCssToAppearance(record.css) +
      `\n\n /*  ----- ORIGINAL ---- */\n/*${record.css.replaceAll(
        "*/",
        "#/"
      )}*/`
  );

  const uniqueUploaders = [
    ...new Set(
      record.paths.map((path: string) => {
        const email = path.split("/")[2];
        const emailParts = email.split("@");
        const obfuscatedEmail =
          emailParts[0].slice(0, -2) + "..." + "@" + emailParts[1];
        return obfuscatedEmail;
      })
    ),
  ].slice(0, 3); // first 3 are enough to give a sense of who uploaded these books

  fs.writeFileSync(
    `${folder}/appearance.json`,
    `// Matches customBookStyles.css with checksum ${checksum}
// This was used by ${record.book_count} books (${record.unique_named_books} unique).` +
      // enhance: +`// Affected branding projects include "Mali-ACR-2020-Soninke".`
      `// Uploaders included ${JSON.stringify(uniqueUploaders)}.
// Example Book: ${record.first_book}
// A replacement customBookStyles.css has been generated.
{
}`
  );
}
