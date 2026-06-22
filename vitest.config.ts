/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试文件约定：src/**/*.test.ts 或 test/**/*.test.ts
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node', // 游戏逻辑是纯 TS，不需要 DOM 环境
    globals: false, // 不注入全局，鼓励显式 import
    coverage: {
      provider: 'v8',
      include: ['src/game/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/game/audio.ts', 'src/ui/**'],
      // 核心逻辑覆盖率门槛：战斗与状态管理是命脉
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
