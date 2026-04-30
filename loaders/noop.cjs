// This loader is used to handle *.LICENSE.txt files bundled by @cursor/sdk that
// Turbopack cannot process natively. It returns an empty ES module export so
// the file is safely ignored during the build.
module.exports = function () {
  return "export default ''";
};
