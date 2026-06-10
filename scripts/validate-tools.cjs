/**
 * 智映工具注册表验证脚本
 * 检查所有已注册工具是否能正确绑定到 store actions
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

const results = { passed: [], failed: [], warnings: [] };

// 1. 检查 stores 中的 action 方法
function scanStoreActions() {
  const stores = ["project-store.ts", "editor-store.ts", "chat-store.ts", "ai-service.ts"];
  
  stores.forEach((file) => {
    const fp = path.join(SRC, "stores", file);
    if (!fs.existsSync(fp)) {
      results.warnings.push(`Store file not found: ${file}`);
      return;
    }
    
    const content = fs.readFileSync(fp, "utf-8");
    
    // Extract exported function names
    const actions = content.match(/\b(\w+):\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>)/g);
    if (actions) {
      results.passed.push({
        file,
        actions: actions.map((a) => a.split(":")[0].trim()),
      });
    }
  });
}

// 2. Check ai-service command definitions
function checkAICommands() {
  const fp = path.join(SRC, "stores", "ai-service.ts");
  if (!fs.existsSync(fp)) {
    results.failed.push("ai-service.ts not found - AI commands unavailable");
    return;
  }
  
  const content = fs.readFileSync(fp, "utf-8");
  
  const expectedActions = ["trim", "split", "delete", "speed", "addText", "export", "unknown"];
  const found = expectedActions.filter((a) => content.includes(`action: "${a}"`));
  const missing = expectedActions.filter((a) => !content.includes(`action: "${a}"`));
  
  if (missing.length === 0) {
    results.passed.push({ aiCommands: "All expected actions found" });
  } else {
    results.failed.push(`Missing AI command actions: ${missing.join(", ")}`);
  }
}

// 3. Check component-store bindings
function checkComponentBindings() {
  const components = ["Toolbar.tsx", "Preview.tsx", "Timeline.tsx", "ChatBox.tsx", "MediaPanel.tsx"];
  
  components.forEach((comp) => {
    const fp = path.join(SRC, "components", "editor", comp);
    if (!fs.existsSync(fp)) {
      results.warnings.push(`Component not found: ${comp}`);
      return;
    }
    
    const content = fs.readFileSync(fp, "utf-8");
    
    // Check if component uses store
    if (content.includes("useProjectStore") || content.includes("useEditorStore") || content.includes("useChatStore")) {
      results.passed.push(`${comp}: Store connected`);
    } else {
      results.warnings.push(`${comp}: No store connection found`);
    }
  });
}

// 4. Check export service
function checkExportService() {
  const fp = path.join(SRC, "services", "export-service.ts");
  if (fs.existsSync(fp)) {
    const content = fs.readFileSync(fp, "utf-8");
    if (content.includes("exportTimeline") && content.includes("downloadBlob")) {
      results.passed.push("Export service: exportTimeline + downloadBlob found");
    } else {
      results.failed.push("Export service: Missing required functions");
    }
  } else {
    results.warnings.push("Export service not found");
  }
}

// 5. Check diffusion studio integration
function checkDiffusionStudio() {
  const fp = path.join(SRC, "services", "composition-service.ts");
  if (fs.existsSync(fp)) {
    const content = fs.readFileSync(fp, "utf-8");
    const hasInit = content.includes("initComposition");
    const hasBuild = content.includes("buildFromProject");
    const hasPlay = content.includes("function play") || content.includes("export function play");
    
    if (hasInit && hasBuild && hasPlay) {
      results.passed.push("DiffusionStudio: Core integration functions found");
    } else {
      results.failed.push(`DiffusionStudio: Missing functions (init:${hasInit}, build:${hasBuild}, play:${hasPlay})`);
    }
  } else {
    results.warnings.push("DiffusionStudio composition service not found");
  }
}

// 6. Check waveform service
function checkWaveform() {
  const fp = path.join(SRC, "services", "waveform.ts");
  if (fs.existsSync(fp)) {
    const content = fs.readFileSync(fp, "utf-8");
    if (content.includes("extractWaveform")) {
      results.passed.push("Waveform service: extractWaveform found");
    }
  }
}

// Run all checks
console.log("🔍 智映工具注册表验证中...\n");

scanStoreActions();
checkAICommands();
checkComponentBindings();
checkExportService();
checkDiffusionStudio();
checkWaveform();

// Output
console.log("=== 验证结果 ===\n");
console.log(`✅ 通过: ${results.passed.length}`);
console.log(`❌ 失败: ${results.failed.length}`);
console.log(`⚠️  警告: ${results.warnings.length}\n`);

results.passed.forEach((r) => console.log(`  ✅ ${JSON.stringify(r)}`));
results.failed.forEach((r) => console.log(`  ❌ ${r}`));
results.warnings.forEach((r) => console.log(`  ⚠️  ${r}`));

// Summary
console.log("\n=== 汇总 ===");
const hasErrors = results.failed.length > 0;
console.log(`验证状态: ${hasErrors ? "❌ 存在问题" : "✅ 全部通过"}`);
process.exit(hasErrors ? 1 : 0);
