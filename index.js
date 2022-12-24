const express = require('express');
const app = express();
const port = 3010;
const path = require('path');
const glob = require('glob');
const dlv = require('dlv');
const NegateValue = require('tailwindcss/lib/util/negateValue');
const NameClass = require('tailwindcss/lib/util/nameClass');
const corePlugins = require('tailwindcss/lib/corePlugins.js');
const corePluginList = require('tailwindcss/lib/corePluginList.js');
const defaultConfig = require('tailwindcss/resolveConfig')(
  require('tailwindcss/defaultConfig')
);

function normalizeProperties(input) {
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(normalizeProperties);
  return Object.keys(input).reduce((newObj, key) => {
    let val = input[key];
    let newVal = typeof val === 'object' ? normalizeProperties(val) : val;
    newObj[
      key.replace(/([a-z])([A-Z])/g, (m, p1, p2) => `${p1}-${p2.toLowerCase()}`)
    ] = newVal;
    return newObj;
  }, {});
}

const getPlugins = () => {
  return corePluginList.default;
};

function getUtilities(plugin, { includeNegativeValues = false } = {}) {
  if (!plugin) return {};
  const utilities = {};

  function addUtilities(utils) {
    utils = Array.isArray(utils) ? utils : [utils];
    for (let i = 0; i < utils.length; i++) {
      for (let prop in utils[i]) {
        for (let p in utils[i][prop]) {
          if (p.startsWith('@defaults')) {
            delete utils[i][prop][p];
          }
        }
        utilities[prop] = normalizeProperties(utils[i][prop]);
      }
    }
  }

  plugin({
    addBase: () => {},
    addDefaults: () => {},
    addComponents: () => {},
    corePlugins: () => true,
    prefix: (x) => x,
    addUtilities,
    theme: (key, defaultValue) => dlv(defaultConfig.theme, key, defaultValue),
    matchUtilities: (matches, { values, supportsNegativeValues } = {}) => {
      if (!values) return;

      let modifierValues = Object.entries(values);

      if (includeNegativeValues && supportsNegativeValues) {
        let negativeValues = [];
        for (let [key, value] of modifierValues) {
          let negatedValue = NegateValue.default(value);
          if (negatedValue) {
            negativeValues.push([`-${key}`, negatedValue]);
          }
        }
        modifierValues.push(...negativeValues);
      }

      let result = Object.entries(matches).flatMap(
        ([name, utilityFunction]) => {
          return modifierValues
            .map(([modifier, value]) => {
              let declarations = utilityFunction(value, {
                includeRules(rules) {
                  addUtilities(rules);
                },
              });

              if (!declarations) {
                return null;
              }

              return {
                [NameClass.default(name, modifier)]: declarations,
              };
            })
            .filter(Boolean);
        }
      );

      for (let obj of result) {
        for (let key in obj) {
          let deleteKey = false;
          for (let subkey in obj[key]) {
            if (subkey.startsWith('@defaults')) {
              delete obj[key][subkey];
              continue;
            }
            if (subkey.includes('&')) {
              result.push({
                [subkey.replace(/&/g, key)]: obj[key][subkey],
              });
              deleteKey = true;
            }
          }

          if (deleteKey) delete obj[key];
        }
      }

      addUtilities(result);
    },
  });
  return utilities;
}

app.use(express.static('static'));

/*app.get('/property/:plugin', (req, res) => {
  let plugin = corePlugins.corePlugins[req.params.plugin || 'width'];
  const data = `<pre>${JSON.stringify(getUtilities(plugin))}</pre>`;
  res.send(data);
});*/

app.get('/', (req, res) => {
  /*  const all = {};
  getPlugins().map((plugin) => {
    let pluginFn = corePlugins.corePlugins[plugin];
    all[plugin] = {}; // getUtilities(pluginFn);
  });
*/
  let pluginFn = corePlugins.corePlugins['padding'];
  const result = getUtilities(pluginFn);

  console.log(result);
  res.send(result);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
