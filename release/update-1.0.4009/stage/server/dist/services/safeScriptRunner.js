"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseNodeVmFallback = canUseNodeVmFallback;
exports.runSourceScript = runSourceScript;
const config_1 = require("../config");
function canUseNodeVmFallback(options = {}) {
    const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
    const allowFallback = Object.prototype.hasOwnProperty.call(options, 'allowFallback')
        ? options.allowFallback
        : process.env.ALLOW_SOURCE_JS_VM_FALLBACK;
    return nodeEnv !== 'production' && allowFallback === 'true';
}
function isSourceJsEnabled() {
    return config_1.config.security.enableSourceJs || process.env.ENABLE_SOURCE_JS === 'true';
}
function runFallbackVm(code, context) {
    const vm = require('node:vm');
    const sandbox = {
        RESULT: context.result ?? null,
        HTML: context.html ?? '',
        SOURCE: context.source ?? {},
    };
    const ctx = vm.createContext(sandbox, {
        name: 'source-rule-fallback',
        codeGeneration: { strings: true, wasm: false },
    });
    const script = new vm.Script(`
    "use strict";
    (function(result, html, source) {
      ${code}
    })(RESULT, HTML, SOURCE);
  `);
    return script.runInContext(ctx, { timeout: 1000 });
}
function runSourceScript(code, context = {}) {
    if (!isSourceJsEnabled()) {
        return undefined;
    }
    let ivm;
    try {
        // isolated-vm 是原生模块，只有在明确启用书源 JS 时才加载。
        // 这样默认安全模式下不会因为本机 Node ABI 或编译环境问题影响启动和测试。
        ivm = require('isolated-vm');
    }
    catch (err) {
        if (!canUseNodeVmFallback()) {
            console.error('[safeScriptRunner] isolated-vm 不可用，当前环境已禁用 node:vm 后备执行:', err.message);
            return undefined;
        }
        console.warn('[safeScriptRunner] isolated-vm 不可用，使用受限 node:vm 后备执行:', err.message);
        return runFallbackVm(code, context);
    }
    const isolate = new ivm.Isolate({ memoryLimit: 32 });
    try {
        const script = isolate.compileScriptSync(`
      "use strict";
      (function(result, html, source) {
        ${code}
      })(RESULT, HTML, SOURCE);
    `);
        const ctx = isolate.createContextSync();
        const jail = ctx.global;
        // 仅暴露三个只读参数，禁止访问任何全局对象
        jail.setSync('RESULT', context.result ?? null);
        jail.setSync('HTML', context.html ?? '');
        jail.setSync('SOURCE', context.source ?? {});
        const result = script.runSync(ctx, { timeout: 5000 });
        return result;
    }
    catch (err) {
        console.error('[safeScriptRunner] 脚本执行失败:', err.message);
        return undefined;
    }
    finally {
        isolate.dispose();
    }
}
//# sourceMappingURL=safeScriptRunner.js.map