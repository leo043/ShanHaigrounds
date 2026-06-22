// ESLint 9 flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      'dist/',
      'node_modules/',
      'android/',
      '.workbuddy/',
      'coverage/',
      '*.config.ts',
      '*.config.js',
    ],
  },

  // 基础规则集
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 关闭与 Prettier 冲突的格式化规则
  prettierConfig,

  // 项目特定配置
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        // 浏览器环境
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        AudioContext: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLElementEventMap: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        screen: 'readonly',
        performance: 'readonly',
      },
    },
    rules: {
      // 配合 tsconfig 的 noUnusedLocals；先 warn，配合 Prettier 渐进清理
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // prefer-const 由 recommended 提供（error），保留以长期保障 const 优先
      // 游戏开发阶段 console 先 warn（音效/渲染调试会用）
      'no-console': 'warn',
      // 允许未处理的 promise（项目里大量 async/await，渐进式收紧）
      '@typescript-eslint/no-floating-promises': 'off',
      // 循环里 await 的情况在战斗回放中可接受
      'no-await-in-loop': 'off',
      // 空函数（回调占位）允许
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
