import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'scripts/**',
		'smoke.cjs',
		'docs/**',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mjs', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			// 默认热键豁免：「在文档中搜索」命令必须默认绑定 Mod+F——用户明确要求
			// 快捷键出现在系统快捷键设置中且开箱即用；Markdown 编辑器场景下核心
			// 编辑器搜索优先，本命令仅在 Any Viewer 标签页内生效，冲突面可控。
			'obsidianmd/commands/no-default-hotkeys': 'off',
		},
	},
);
