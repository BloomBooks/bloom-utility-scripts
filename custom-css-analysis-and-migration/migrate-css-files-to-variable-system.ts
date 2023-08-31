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

const cssFileContent: string = fs.readFileSync("./zebra.css", "utf8");
const cssObject: Stylesheet = parse(cssFileContent);

if (cssObject.stylesheet && cssObject.stylesheet.rules) {
  cssObject.stylesheet.rules.forEach((rule: Rule) => {
    if (
      rule.type === "rule" &&
      rule.selectors &&
      rule.selectors.some((s: string) => s.includes(".marginBox"))
    ) {
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

      var left = Number.parseFloat(
        (
          rule.declarations?.find(
            (d: Declaration) => d.property === "left"
          ) as Declaration
        ).value!
      );
      var top = Number.parseFloat(
        (
          rule.declarations?.find(
            (d: Declaration) => d.property === "top"
          ) as Declaration
        ).value!
      );
      rule.declarations?.forEach((declaration: Declaration) => {
        if (declaration.type === "declaration") {
          const key = (declaration as Declaration).property;
          interface PropertyConversions {
            [key: string]: string;
          }
          if (size) {
            if (key === "width") {
              declaration.value =
                size.width -
                Number.parseFloat(declaration.value!) -
                left +
                "mm";
            }
            if (key === "height") {
              declaration.value =
                size.height -
                Number.parseFloat(declaration.value!) -
                top +
                "mm";
            }
          }
          const propertyConversions: PropertyConversions = {
            left: "--page-margin-left",
            top: "--page-margin-top",
            height: "--page-margin-bottom",
            width: "--page-margin-right",
          };

          if (declaration.property! in propertyConversions) {
            declaration.property = propertyConversions[declaration.property!];
            declaration.value = declaration.value?.replace("!important", "");
          }
        }
      });
    }
  });
}

const modifiedCss: string = stringify(cssObject);
console.log(modifiedCss);
