import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

// 共用規則放在這裡。之後 apps/cms（Next.js）可在下方陣列追加：
//   { files: ['apps/cms/**/*.{ts,tsx}'], plugins: {...}, rules: {...} }
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/.next/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Express 錯誤處理器需要保留 4 個參數，允許底線開頭的未使用參數
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // 必須放最後，關閉與 Prettier 衝突的格式規則
  prettier,
)
