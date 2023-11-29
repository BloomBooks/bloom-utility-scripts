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
  if (Bun.argv.length > 2 && count > Number.parseInt(Bun.argv[2])) break;
  console.log(`css = ${record.css}`);
  const checksum = crypto.createHash("md5").update(record.css).digest("hex");
  const folder = `./output/migration/${count} ${checksum}`;
  console.log(`output folder=${folder}`);
  fs.mkdirSync(folder);

  let cssPath = `${folder}/customBookStyles.css`;
  if (fs.existsSync(cssPath)) {
    cssPath = `${folder}/customBookStyles2.css`;
    console.log(`WARNING: multiple migrations in ${folder}`);
  }

  const migration = migrateCssToAppearance(record.css);

  fs.writeFileSync(
    cssPath,
    migration.modifiedCss +
      `

/*  ----- ORIGINAL ---- */
/*${record.css.replaceAll("*/", "#/")}*/
`
  );

  const brandingSet = new Set();
  for (let i = 0; i < record.paths.length; ++i) {
    const metaPath = record.paths[i] + "/meta.json";
    try {
      const metaString: string = fs.readFileSync(metaPath, "utf8");
      const metadata = JSON.parse(metaString);
      const brandingProject = metadata.brandingProjectName as string;
      if (brandingProject &&
          brandingProject.toLowerCase() !== "default" &&
          brandingProject.toLowerCase() !== "local-community")
        brandingSet.add(brandingProject);
    } catch (e) {
      console.log("Could not extract brandingProject from " + metaPath);
    }
  }

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

  const brandings = [...brandingSet];
  const date = new Date();
  const outputString: string =
    `// Matches customBookStyles.css with checksum ${checksum}
// On ${date.toDateString()} this was used by ${record.book_count} books (${record.unique_named_books} unique).
` +
    (brandings && brandings.length > 0
      ? `// Affected branding projects included ${JSON.stringify(brandings)}.
`
      : ``) +
    `// Uploaders included ${JSON.stringify(uniqueUploaders)}.
// Example Book: ${record.first_book}
// A replacement customBookStyles.css has been generated.
{
  "cssThemeName": "default",
  "coverShowTitleL2": ${migration.hideL2TitleOnCover ? "false" : "true"},
  "coverShowTitleL3": false,
}
`;
  let appearancePath = `${folder}/appearance.json`;
  if (fs.existsSync(appearancePath))
    appearancePath = `${folder}/appearance2.json`;
  fs.writeFileSync(appearancePath, outputString);
}
