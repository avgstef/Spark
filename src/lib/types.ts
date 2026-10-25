export type Category =
  | 'Coding'
  | 'Websites'
  | 'Apps'
  | 'Images/Video'
  | 'Writing'
  | 'Business'
  | 'Research'
  | 'General'

export type OutputStyle = 'Quick' | 'Detailed' | 'Expert'

/** Capability level chosen by the user. Maps to an upstream model internally —
 *  the provider and model names are never exposed. */
export type TargetModel = 'Low' | 'Medium' | 'High'

export type LabAction =
  | 'Improve'
  | 'Expand'
  | 'Simplify'
  | 'Change tone'
  | 'Fix ambiguity'
  | 'Adapt model'

export type Tone = 'Professional' | 'Friendly' | 'Direct' | 'Playful' | 'Academic' | 'Persuasive'

export interface Quality {
  clarity: number
  completeness: number
  specificity: number
}

export interface GeneratedPrompt {
  id: string
  title: string
  category: Category
  targetModel: TargetModel
  outputStyle: OutputStyle
  objective: string
  brief?: string
  prompt: string
  assumptions: string[]
  tips?: string[]
  quality: Quality
  createdAt: number
  source: 'ai' | 'local'
}

export interface SavedPrompt extends GeneratedPrompt {
  tags: string[]
  favorite: boolean
}

export interface HistoryEntry {
  id: string
  idea: string
  category: Category
  targetModel: TargetModel
  outputStyle: OutputStyle
  result: GeneratedPrompt
  createdAt: number
}

export interface ClarifyResult {
  needsClarification: boolean
  reason?: string
  questions: string[]
}

export interface LabResult {
  prompt: string
  changes: string[]
  notes?: string
}

export interface Analysis {
  overall: number
  scores: {
    clarity: number
    completeness: number
    specificity: number
    structure: number
    constraints: number
  }
  strengths: string[]
  weaknesses: string[]
  fixes: string[]
  rewritten?: string
}

export interface AppSettings {
  hasKey: boolean
  keyHint: string
  tier: 'low' | 'medium' | 'high'
  temperature: number
  theme: 'obsidian' | 'ember'
  outputStyle: OutputStyle
  defaultCategory: Category
  encryption: string
  keySource?: 'settings' | 'file' | 'env' | 'built-in' | 'none'
  dataDir?: string
  tiers?: { id: string; label: string; note: string }[]
  hasBuiltIn?: boolean
}

export interface Template {
  id: string
  name: string
  category: Category
  targetModel: TargetModel
  blurb: string
  idea: string
  tags: string[]
}
