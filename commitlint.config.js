// commitlint 配置 - Conventional Commits 规范
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 允许较长的 subject（中文项目描述需要）
    'subject-max-length': [2, 'always', 100],
    // 允许中文 scope（不强制小写）
    'scope-case': [0],
  },
};
