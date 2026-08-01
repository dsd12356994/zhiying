export interface TemplateTransition {
  type: "crossDissolve" | "slide" | "wipe" | "fade";
  duration: number;
}

export interface TemplateColorGrade {
  filterName: string;
  intensity: number;
}

export interface TemplateSlowMo {
  speed: number;
}

export interface TemplateTitleText {
  content: string;
  duration: number;
  fontSize?: number;
  color?: string;
}

export interface TemplateEditingRules {
  clipPaddingBefore: number;
  clipPaddingAfter: number;
  transition: TemplateTransition;
  colorGrade: TemplateColorGrade;
  slowMo?: TemplateSlowMo;
  titleText?: TemplateTitleText;
  subtitlePool: string[];
  subtitleDuration?: number;
}

export interface FpsTemplate {
  id: string;
  name: string;
  description: string;
  ratio: string;
  durationRange: [number, number];
  fps: number;
  audio: { gameSoundRatio: number; bgmRatio: number };
  editingRules: TemplateEditingRules;
  hashtags: string[];
  bgmStyle: string[];
}
