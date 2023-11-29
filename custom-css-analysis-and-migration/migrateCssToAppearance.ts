 /**
 *  function that is called by create-migrations.ts
 * **/

import { parse, stringify, Rule, Stylesheet, Declaration } from "css";
export interface Migration {
  modifiedCss: string;
  hideL2TitleOnCover: boolean;
}

const sizes = [
  {
    name: ".A5Portrait",
    height: 210,
    width: 148,
  },
  {
    name: ".A5Landscape",
    height: 148,
    width: 210,
  },
  {
    name: ".A4Landscape",
    height: 210,
    width: 297,
  },
  {
    name: ".A4Portrait",
    height: 297,
    width: 210,
  },
  {
    name: ".A3Landscape",
    height: 297,
    width: 420,
  },
  {
    name: ".A3Portrait",
    height: 420,
    width: 297,
  },
  {
    name: ".A6Portrait",
    height: 148,
    width: 105,
  },
  {
    name: ".A6Landscape",
    height: 105,
    width: 148,
  },

  {
    name: ".Cm13Landscape",
    height: 130,
    width: 130,
  },
  { name: ".Device16x9Portrait", height: 177.77777778, width: 100 },
  { name: ".Device16x9Landscape", height: 100, width: 177.77777778 },
  { name: ".PictureStoryLandscape", height: 100, width: 177.77777778 },
];
interface PropertyConversions {
  [key: string]: string;
}
const propertyConversions: PropertyConversions = {
  left: "--page-margin-left",
  top: "--page-margin-top",
  height: "--page-margin-bottom",
  width: "--page-margin-right",
};
const coverPropertyConversions: PropertyConversions = {
  left: "--page-margin-left",
  top: "--cover-margin-top",
  height: "--cover-margin-bottom",
  width: "--page-margin-right",
};

export function migrateCssToAppearance(cssFileContent: string): Migration {
  let cssObject: Stylesheet;
  let error: string;
  try {
    cssObject = parse(cssFileContent);
  } catch (e) {
    cssObject = null;
    error = e as string;
  }
  if (error && !cssObject) {
    try {
      const fixedCss = fixCssIfPossible(cssFileContent, error);
      cssObject = parse(fixedCss);
    } catch (e) {
      console.log("Error parsing css: " + error);
      return cssFileContent;
    }
  }

  const otherRules: Rule[] = [];
  const ruleIndices: number[] = [];
  let hideL2TitleOnCover = false;

  if (cssObject.stylesheet && cssObject.stylesheet.rules) {
    let ruleIndex = 0;
    cssObject.stylesheet.rules.forEach((rule: Rule) => {
      ++ruleIndex;
      //console.log(`DEBUG rule = ${JSON.stringify(rule)}`);
      if (
        rule.type === "rule" &&
        rule.selectors?.some((s: string) => s.includes(".Title-On-Cover-style[lang=") &&
        rule.declarations?.some(
          (d: Declaration) => d.property === "display" && d.value === "none"))
      ) {
          hideL2TitleOnCover = true;
      }
      if (
        rule.type === "rule" &&
        rule.selectors &&
        rule.selectors.some((s: string) => s.includes(".marginBox"))
      ) {
        // find the sizes element that has the same name as one of the selectors
        const size = sizes.find((sz) =>
          rule.selectors!.some((sel) => sel.includes(sz.name))
        );

        const leftValue = (
          rule.declarations?.find(
            (d: Declaration) => d.property === "left"
          ) as Declaration
        )?.value!;
        const left = parseFloatOrUndefined(leftValue);

        const topValue = (
          rule.declarations?.find(
            (d: Declaration) => d.property === "top"
          ) as Declaration
        )?.value!;
        const top = parseFloatOrUndefined(topValue);

        if (!size || !leftValue || !topValue) {
          AddWarningCommentsIfNeeded(rule);
          return; // leave this rule unchanged.
        }
        // A rule like .marginBox { background-color: red; } is just fine.
        // We preserve rules like this and add them after this loop changes the current rules.

        const unknownDeclarations = rule.declarations?.filter(
          (d: Declaration) =>
            d.property !== "height" &&
            d.property !== "width" &&
            d.property !== "top" &&
            d.property !== "left"
        );

        if (unknownDeclarations && unknownDeclarations.length) {
          const newRule: Rule = {
            type: "rule",
            selectors: rule.selectors,
            declarations: unknownDeclarations,
          };
          sortClassesInSelector(newRule);
          AddWarningCommentsIfNeeded(newRule);
          otherRules.push(newRule);
          ruleIndices.push(ruleIndex);
          rule.declarations = rule.declarations.filter(
            (d: Declaration) =>
              d.property === "height" ||
              d.property === "width" ||
              d.property === "top" ||
              d.property === "left"
          );
        }

        // remove the .marginBox class from the selectors
        rule.selectors = rule.selectors.map((s: string) =>
          s.replace(".marginBox", "")
        );

        rule.declarations?.forEach((declaration: Declaration) => {
          if (declaration.type === "declaration") {
            const key = (declaration as Declaration).property;

            if (size) {
              const v = parseFloatOrUndefined(declaration.value!);
              if (v === undefined || left === undefined || top === undefined)
                declaration.value = ` ignore /* error: ${rule.declarations?.toString()} */`;
              else {
                if (key === "width") {
                  let val = size.width - v - left; // round off to 0 if less than 0.05
                  if (Math.abs(val) < 0.05) val = 0;
                  declaration.value = val.toFixed(1) + "mm";
                }
                if (key === "height") {
                  let val = size.height - v - top; // round off to 0 if less than 0.05
                  if (Math.abs(val) < 0.05) val = 0;
                  declaration.value = val.toFixed(1) + "mm";
                }
              }
            }

            const isCover = rule.selectors!.some((sel) =>
              sel.includes("Cover")
            );
            const map = isCover
              ? coverPropertyConversions
              : propertyConversions;
            if (declaration.property! in map) {
              declaration.property = map[declaration.property!];
              declaration.value = declaration.value?.replace("!important", "");
            }
          }
        });

        sortClassesInSelector(rule);
        sortDeclarations(rule);
      }
    });

    if (otherRules && otherRules.length) {
      // put the new rules immediately after the rule they were extracted from
      for (let i = otherRules.length - 1; i >= 0; --i) {
        cssObject.stylesheet.rules.splice(ruleIndices[i], 0, otherRules[i]);
      }
    }
  }

  const modifiedCss: string = stringify(cssObject);
  return { modifiedCss, hideL2TitleOnCover };
}

function sortDeclarations(rule: Rule) {
  // Define the type of propertyConversions
  type PropertyConversions = {
    [key: string]: number;
  };

  // Define the property conversions object
  const orderedProperties: PropertyConversions = {
    "--page-margin-top": 0,
    "--page-margin-bottom": 1,
    "--page-margin-left": 2,
    "--page-margin-right": 3,
  };

  // sort the declarations according to the order in propertyConversions
  rule.declarations?.sort((a: Declaration, b: Declaration) => {
    const aProp = orderedProperties[a.property!];
    const bProp = orderedProperties[b.property!];
    if (aProp === undefined && bProp === undefined) {
      return 0;
    } else if (aProp === undefined) {
      return 1;
    } else if (bProp === undefined) {
      return -1;
    } else {
      return aProp - bProp;
    }
  });
}

function sortClassesInSelector(rule: any): void {
  // sort the classes in the first selector if appropriate
  if (!rule.selectors || !rule.selectors.length) return;
  var selector = rule.selectors[0].trim();
  if (/^.[A-Za-z][-.A-Za-z0-9]*$/.test(selector))
  {
    const classes = rule.selectors[0].trim().split(".").filter(Boolean).sort();
    const sortedSelector = "." + classes.join(".");
    rule.selectors[0] = sortedSelector;
  }
}

function parseFloatOrUndefined(value: string): number | undefined {
  try {
    const result = parseFloat(value);
    return isNaN(result) ? undefined : result;
  } catch (e) {
    return undefined;
  }
}

// This function fixes the input css for the parse errors found in the various CSS
// files that pass the filtering process.  The fixes shouldn't affect the semantics
// of the parsed CSS object.
function fixCssIfPossible(cssFileContent: string, error: string) {
  let linesOfCss = cssFileContent.split("\r\n");
  if (linesOfCss.length === 1) linesOfCss = cssFileContent.split("\n");
  if (linesOfCss.length === 1) linesOfCss = cssFileContent.split("\r");
  const parsedError = /^Error: [^:]*:([0-9]+):([0-9]+): (.*)$/.exec(error);
  if (parsedError && parsedError.length === 4) {
    const lineNumber = parseInt(parsedError[1]);
    switch (parsedError[3]) {
      case "selector missing": // 1 occurrence of a strange contruct
        if (linesOfCss[lineNumber - 1].includes("} {")) {
          linesOfCss[lineNumber - 1] = linesOfCss[lineNumber - 1].replace(
            "} {",
            " "
          );
          return linesOfCss.join("\r\n");
        }
        break;
      case "missing '}'": // 2 occurrences of lines missing an obvious '}'
        linesOfCss[lineNumber - 1] = "} " + linesOfCss[lineNumber - 1];
        return linesOfCss.join("\r\n");
      case "missing '{'": // 2 occurrences of a '.' on the final line by itself
        if (linesOfCss[lineNumber - 1] === ".") {
          linesOfCss.splice(lineNumber - 1, 1);
          return linesOfCss.join("\r\n");
        }
        break;
      case "End of comment missing": // 36 occurrences
        if (lineNumber === linesOfCss.length) {
          return cssFileContent + "*/";
        }
        // There's one file with an empty line and a spurious close } by itself on a line
        // following the comment that isn't closed properly at the end of the file.
        let emptyLines = true;
        for (let i = lineNumber; emptyLines && i < linesOfCss.length; ++i) {
          if (linesOfCss[i].length >= 2) emptyLines = false;
        }
        if (emptyLines) return cssFileContent + "*/";
        break;
      default:
        break;
    }
  }
  return cssFileContent;
}

function AddWarningCommentsIfNeeded(rule: Rule) {
  const comments: Declaration[] = [];
  const commentIndices: number[] = [];
  rule.declarations?.forEach((d: Declaration, index: number) => {
    if (d.property === "bottom" ||
        d.property === "right" ||
        d.property?.includes("margin-") ||
        d.property?.includes("padding-")) {
      const comment: Declaration = {} as Declaration;
      comment.type = "comment";
      comment.comment = ` ${d.property}: NOT MIGRATED `;
      comments.push(comment);
      commentIndices.push(index);
    }
  });
  if (comments && comments.length) {
    for (let i = comments.length - 1; i >= 0; --i) {
      rule.declarations!.splice(commentIndices[i], 0, comments[i]);
    }
  }
}

