import js from "@eslint/js";
import { defineConfig } from 'eslint/config';
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierPlugin from "eslint-plugin-prettier/recommended";
import globals from "globals";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const requireExtensionsPlugin = require("eslint-plugin-require-extensions");

const sharedTsRules = {
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-expressions": ["error", { "allowShortCircuit": true, "allowTernary": true }],
};

export default defineConfig(
    {
        ignores: [
            "**/node_modules/**",
            "**/.github/**",
            "**/.claude/**",
            "eslint.config.mjs",
            "**/.next/**",
            "**/.prettierignore",
            "**/.parcel-cache/**",
            "**/.swc/**",
            "**/docs/**",
            "**/lib/**",
            "**/build/**",
            "**/dist/**",
            "**/out/**",
            "**/public/**",
            "**/*.tsbuildinfo",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierPlugin,
    {
        linterOptions: {
            reportUnusedDisableDirectives: "off",
        },
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
        plugins: {
            "require-extensions": requireExtensionsPlugin,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            ...(requireExtensionsPlugin.configs?.recommended?.rules || {}),
            ...sharedTsRules,
        },
    },
    // React 专用配置
    {
        files: [
            "packages/react/**/*.{ts,tsx}",
            "demos/dev-demo/**/*.{ts,tsx}",
            "demos/react-ui/**/*.{ts,tsx}"
        ],
        plugins: {
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
        },
        settings: {
            react: {
                version: "18.3.1",
            },
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            "react/no-unescaped-entities": ["error", { forbid: [">"] }],
            "react/react-in-jsx-scope": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/unsupported-syntax": "off",
            "react-hooks/refs": "off",
        },
    },
    {
        files: ["packages/vue/**/*.{js,ts,vue}", "demos/vue-ui/**/*.{js,ts,vue}"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,
                ecmaVersion: 2022,
                sourceType: "module",
                extraFileExtensions: [".vue"],
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            vue: vuePlugin,
        },
        rules: {
            ...vuePlugin.configs["flat/recommended"].rules,
            ...sharedTsRules,
            "vue/multi-word-component-names": "off",
            "no-undef": "off",
        },
    },
    {
        files: ["demos/**/*"],
        rules: {
            "require-extensions/require-extensions": "off",
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
    {
        files: ["demos/dev-demo/**/*", "demos/react-ui/**/*"],
        rules: {
            "react-hooks/exhaustive-deps": "off",
        }
    },
    {
        files: ["scripts/**/*", "packages/**/tests/**/*"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    {
        files: ["**/*.test.tsx", "**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-unused-expressions": "off",
        },
    }
);
