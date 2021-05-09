const {
  removeModuleScopePlugin,
  override,
  babelInclude,
  addPostcssPlugins
} = require("customize-cra");
const path = require("path");

module.exports = override(
  removeModuleScopePlugin(),
  babelInclude([
    path.resolve("src"),
    path.resolve("../hardhat"), // or some other path where your symlinked files are
  ]),
  addPostcssPlugins([require("tailwindcss"), require("autoprefixer")])
);
