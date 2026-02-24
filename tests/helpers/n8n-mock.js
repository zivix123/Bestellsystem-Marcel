/**
 * Führt den JavaScript-Code eines n8n Code-Nodes in einer Sandbox aus.
 *
 * @param {string} jsCode - Der JS-Code aus dem n8n Code-Node (als String)
 * @param {object} options
 * @param {object} options.inputJson       - Simuliert $input.first().json
 * @param {object} options.staticData      - Simuliert $getWorkflowStaticData('global')
 * @param {object} [options.nodeOutputs]   - Simuliert $('NodeName').first().json
 * @returns {Array} Rückgabewert des Code-Nodes
 */
function runN8nCode(jsCode, { inputJson = {}, staticData = {}, nodeOutputs = {} } = {}) {
  const vm = require('vm');

  const sandbox = {
    $input: {
      first: () => ({ json: inputJson })
    },
    $getWorkflowStaticData: (_scope) => staticData,
    $: (nodeName) => ({
      first: () => ({ json: nodeOutputs[nodeName] || {} })
    }),
    console,
    Date,
    Math,
  };

  const wrappedCode = `(function() { ${jsCode} })()`;
  return vm.runInNewContext(wrappedCode, sandbox);
}

module.exports = { runN8nCode };
