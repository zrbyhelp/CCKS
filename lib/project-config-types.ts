import type { AiProviderSummary } from '@/lib/ai-presets'
import type { RecipeVariableCategory } from '@/lib/recipe-variables'

export const ZLEX_EXTENSION = '.zlex'
export const ZAMF_EXTENSION = '.zamf'

export type ProjectConfigDiagnostic = {
  path: string
  kind: 'zlex' | 'zamf'
  message: string
}

export type ProjectAiProviderSummary = AiProviderSummary & {
  filePath: string
  apiKey: string
  schemaVersion: number
}

export type ProjectConfigCatalog = {
  providers: ProjectAiProviderSummary[]
  recipeCategories: RecipeVariableCategory[]
  diagnostics: ProjectConfigDiagnostic[]
}

export function isZlexFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith(ZLEX_EXTENSION)
}

export function isZamfFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith(ZAMF_EXTENSION)
}

export function isProjectConfigFilePath(filePath: string) {
  return isZlexFilePath(filePath) || isZamfFilePath(filePath)
}
