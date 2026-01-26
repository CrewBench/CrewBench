import { Config } from '@office-ai/aioncli-core';

async function main() {
  try {
    const config = new Config({
      sessionId: 'test',
      targetDir: process.cwd(),
      cwd: process.cwd(),
      debugMode: true,
      question: '',
      interactive: false,
      model: 'gemini-1.5-flash-latest',
    });

    await config.initialize();
    const registry = config.getToolRegistry();
    console.log('Registry keys:', Object.keys(registry));
    // Try to access internal tools map if possible, or just log the registry object
    console.log('Registry:', registry);
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
