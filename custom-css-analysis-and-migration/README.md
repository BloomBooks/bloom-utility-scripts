In Bloom 5.7, we introduce a modernized, parameterized page layout CSS system, known as "Appearance". This new system conflicts with the arbitrary custom css that was used in prior Bloom versions, mostly in the area of margins.

As of this writing, we are only looking at `customBookStyles.css`, but `customCollectionsStyles.css` have the same problem.

When Bloom encounters a pre-5.7 book with a `customBookStyles.css` that would conflict with the new system, it goes into a kind of "safe mode" that keeps things working by using a legacy `basePage.css`. Better, though, is to migrate the old css to the new system. Conceivably, a reliable program could be written to do this automatically. However at the moment what we do is to write the migrations using the utilities here, and then have a dev evaluate individual migrations and then copy them over to the shipping Bloom. So when Bloom encounters one of these books, we may already have a tested migration for it.

# How to use this system

⚠️ Be careful what you commit to an open source repo. We do not want to expose emails or other private data.

1.  As of this writing, bun only works on linux. If you are on windows, just install Windows Subsystem for Linux (not as big of a deal as it sounds), then run in a WSL terminal in VSCODE.

1.  Get [bun](https://bun.sh/) installed

1.  Install dependencies: `bun install`

1.  Download all the `customBookStyles.css` from blorg

    `./some-path/BloomBulkDownloader.exe --include "*/*/custom*Styles.css" --syncfolder ./output/downloads --bucket production customBookStyles-files`

Each of the following take an optional argument that will limit the number of records processed.

5.  Process those, grouping them into bins of duplicate stylesheets

    `bun run group-stylesheets.ts 13`

1.  Process those groups, discarding ones that don't need migration

    `bun run filter-stylesheets.ts 7`

1.  Create draft migration files for each one

    `bun run create-migrations.ts 3`
