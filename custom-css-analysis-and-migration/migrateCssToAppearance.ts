 /**
 *  function that is called by create-migrations.ts
 * **/

// These are documented at https://www.npmjs.com/package/css/v/3.0.0.
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
    cssObject.stylesheet.rules.forEach((rule: Rule, index: number) => {
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
        // (A rule like .marginBox .narrowStyle { width: 200px; } is also fine.  But there's no reason for
        // such a rule to mention .marginBox, so there's no point in improving this code unless we
        // encounter a large number of such rules.)
        // We're looking for rules that affect the marginBox's size and position (top/left/height/width)
        // because the new theme system controls these with variables that affect the .bloom-page margin
        // instead of absolutely positioning the .marginBox, so setting its top or left will have no effect,
        // and setting its height or width will probably do something unwanted.  If such a rule also has
        // safe properties, we split it into two rules, one that has only the problem declarations (which
        // we try to fix to have the new values needed) and one that has only the safe declarations.
        // The .marginBox class is removed from the selectors for the rules with the updated new
        // declarations since it's no longer needed.
        // Producing split rules also helps human reviewers to see what's going on, and to check that the
        // new rules are correct.
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
          sortClassesInSelectors(newRule);
          AddWarningCommentsIfNeeded(newRule);
          otherRules.push(newRule);
          ruleIndices.push(index + 1);
          rule.declarations = rule.declarations.filter(
            (d: Declaration) =>
              d.property === "height" ||
              d.property === "width" ||
              d.property === "top" ||
              d.property === "left"
          );
        }

        // The remaining declarations in this rule are all safe to keep, but we need to change them
        // to use the new variables instead and to change the height and width to bottom and right.
        // Also, the .marginBox class is no longer needed in the selector since the new variable
        // settings apply to the page outside the .marginBox proper.
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
                // Calculate the new value for the declaration from the old value, and round
                // off to zero if it's very close to zero.  (The new value is either a bottom
                // or a right margin instead of a height or width.)  Something less than 0.05mm
                // is effectively just a rounding error from these floating point subtractions.
                // We use val.toFixed(1) since precision greater than 0.1mm isn't worthwhile.
                // (Not rounding off to zero explicitly can results in values like -0.0 which
                // look odd even if they work okay.)
                if (key === "width") {
                  let val = size.width - v - left;
                  if (Math.abs(val) < 0.05) val = 0;
                  declaration.value = val.toFixed(1) + "mm";
                }
                if (key === "height") {
                  let val = size.height - v - top;
                  if (Math.abs(val) < 0.05) val = 0;
                  declaration.value = val.toFixed(1) + "mm";
                }
              }
            }

            const isCover = rule.selectors!.some((sel) =>
              sel.includes("Cover")
            );
            // Map the existing property name to the new variable name.
            // (This takes care of having changed the value from width or height
            // to right or bottom above.)
            const map = isCover
              ? coverPropertyConversions
              : propertyConversions;
            if (declaration.property! in map) {
              declaration.property = map[declaration.property!];
              declaration.value = declaration.value?.replace("!important", "");
            }
          }
        });

        sortClassesInSelectors(rule);
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
    "--cover-margin-top": 0,
    "--cover-margin-bottom": 1,
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

function sortClassesInSelectors(rule: any): void {
  // Sort the classes in the selectors if feasible.
  // This makes the rules easier to read and to compare.
  if (!rule.selectors || !rule.selectors.length) return;
  for (let i = 0; i < rule.selectors.length; ++i) {
    // Note that rule.selectors is an Array of Strings split on commas.
    const selector = rule.selectors[i].trim();
    // If the selector is just a list of classes in the same element, sort them.
    // We don't try to sort selectors that have multiple element levels or that
    // have something other than classes.
    if (/^\.[A-Za-z][-.A-Za-z0-9]*$/.test(selector))
    {
      const classes = selector.split(".").filter(Boolean).sort();
      const sortedSelector = "." + classes.join(".");
      // We don't need to worry about leading or trailing spaces in the selector
      // because the output stringify function has its own ideas about how to format.
      rule.selectors[i] = sortedSelector;
    }
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
        d.property?.includes("margin:") ||
        d.property?.includes("padding-") ||
        d.property?.includes("padding:")) {
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

