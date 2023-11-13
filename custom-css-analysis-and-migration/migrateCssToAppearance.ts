/**
 *
 * I'm not clear what state this is in, it was an experiment I was working on.
 * It probably should become a function that is called by create-migrations.ts
 *
 * **/

import fs from "fs";
import { parse, stringify, Rule, Stylesheet, Declaration } from "css";

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

export function migrateCssToAppearance(cssFileContent: string): string {
  var cssObject: Stylesheet;
  try {
    cssObject = parse(cssFileContent);
  } catch (e) {
    console.log("Error parsing css: " + e);
    return cssFileContent;
  }

  if (cssObject.stylesheet && cssObject.stylesheet.rules) {
    cssObject.stylesheet.rules.forEach((rule: Rule) => {
      if (
        rule.type === "rule" &&
        rule.selectors &&
        rule.selectors.some((s: string) => s.includes(".marginBox"))
      ) {
        // THE Following removal, LIKE A LOT OF THIS FILE, IS GARBAGE. A RULE LIKE
        // .marginBox { background-color: red; } is just fine.

        // remove the .marginBox class from the selectors
        rule.selectors = rule.selectors.map((s: string) =>
          s.replace(".marginBox", "")
        );

        // find the sizes element that has the same name as one of the selectors
        const size = sizes.find((sz) =>
          rule.selectors!.some((sel) => sel.includes(sz.name))
        );

        var x = rule.declarations?.find(
          (d: Declaration) => d.property === "left"
        ) as Declaration;

        const l = (
          rule.declarations?.find(
            (d: Declaration) => d.property === "left"
          ) as Declaration
        )?.value!;

        const t = (
          rule.declarations?.find(
            (d: Declaration) => d.property === "top"
          ) as Declaration
        )?.value!;

        if (!l || !t) return; // todo log it?

        var left = parseFloatOrUndefined(l);
        var top = parseFloatOrUndefined(t);
        rule.declarations?.forEach((declaration: Declaration) => {
          if (declaration.type === "declaration") {
            const key = (declaration as Declaration).property;

            if (size) {
              const v = parseFloatOrUndefined(declaration.value!);
              if (v === undefined || left === undefined || top === undefined)
                declaration.value = ` ignore /* error: ${rule.declarations?.toString()} */`;
              else {
                if (key === "width") {
                  declaration.value = size.width - v - left + "mm";
                }
                if (key === "height") {
                  declaration.value = size.height - v - top + "mm";
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

        // danger, this would probably break if there is anything but classes in the selector
        sortClassesInSelector(rule);

        // TODO: this doesn't yet move top and bottom margins with .outsideFrontCover and .outsideBackCover to --cover-margin-top and --cover-margin-bottom

        sortDeclarations(rule);
      }
    });

    // danger, normally sorting rules is not a good idea!
    cssObject.stylesheet.rules = sortRules(cssObject.stylesheet.rules);
  }

  const modifiedCss: string = stringify(cssObject);
  return modifiedCss;
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
  // sort the classes in the first selector
  const classes = rule.selectors[0].trim().split(".").filter(Boolean).sort();
  const sortedSelector = "." + classes.join(".");
  rule.selectors[0] = sortedSelector;
}

function sortRules(rules: Rule[]): Rule[] {
  return rules.sort((a: Rule, b: Rule) => {
    if (a.type !== "rule" || b.type !== "rule") return 0;

    // sort rules by first selector
    const aSelector = a.selectors ? a.selectors[0] : undefined;
    const bSelector = b.selectors ? b.selectors[0] : undefined;
    if (
      aSelector === bSelector ||
      aSelector === undefined ||
      bSelector === undefined
    ) {
      return 0;
    } else if (aSelector > bSelector) {
      return 1;
    } else {
      return -1;
    }
  });
}

function parseFloatOrUndefined(value: string): number | undefined {
  try {
    const result = parseFloat(value);
    return isNaN(result) ? undefined : result;
  } catch (e) {
    return undefined;
  }
}
