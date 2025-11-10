import type { DocsContext } from '../types.js';

/**
 * RGB color specification
 */
export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/**
 * Text style options
 */
export interface TextStyleOptions {
  /** Bold formatting */
  bold?: boolean;
  /** Italic formatting */
  italic?: boolean;
  /** Underline formatting */
  underline?: boolean;
  /** Font size in points */
  fontSize?: number;
  /** Text color (RGB values 0-1) */
  foregroundColor?: RgbColor;
}

/**
 * Options for applying text style
 */
export interface ApplyTextStyleOptions {
  /** Document ID */
  documentId: string;
  /** Start index of text range */
  startIndex: number;
  /** End index of text range (exclusive) */
  endIndex: number;
  /** Style properties to apply */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  foregroundColor?: RgbColor;
}

/**
 * Result of applying text style
 */
export interface ApplyTextStyleResult {
  documentId: string;
  startIndex: number;
  endIndex: number;
  stylesApplied: string[];
  message: string;
}

/**
 * Text style for Google Docs API
 */
interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: {
    magnitude: number;
    unit: string;
  };
  foregroundColor?: {
    color: {
      rgbColor: {
        red: number;
        green: number;
        blue: number;
      };
    };
  };
}

/**
 * Apply text formatting to a range in a document
 *
 * Supports bold, italic, underline, font size, and text color.
 * Indices are based on character positions in the document.
 *
 * @param options Text style parameters
 * @param context Docs API context
 * @returns Style application confirmation
 *
 * @example
 * ```typescript
 * // Make title bold and larger
 * await applyTextStyle({
 *   documentId: 'abc123',
 *   startIndex: 1,
 *   endIndex: 20,
 *   bold: true,
 *   fontSize: 18
 * }, context);
 *
 * // Highlight important text in red
 * await applyTextStyle({
 *   documentId: 'abc123',
 *   startIndex: 100,
 *   endIndex: 150,
 *   bold: true,
 *   foregroundColor: { red: 0.8, green: 0, blue: 0 }
 * }, context);
 * ```
 */
export async function applyTextStyle(
  options: ApplyTextStyleOptions,
  context: DocsContext
): Promise<ApplyTextStyleResult> {
  const {
    documentId,
    startIndex,
    endIndex,
    bold,
    italic,
    underline,
    fontSize,
    foregroundColor,
  } = options;

  const textStyle: Partial<TextStyle> = {};
  const stylesApplied: string[] = [];

  if (bold !== undefined) {
    textStyle.bold = bold;
    stylesApplied.push('bold');
  }
  if (italic !== undefined) {
    textStyle.italic = italic;
    stylesApplied.push('italic');
  }
  if (underline !== undefined) {
    textStyle.underline = underline;
    stylesApplied.push('underline');
  }
  if (fontSize !== undefined) {
    textStyle.fontSize = {
      magnitude: fontSize,
      unit: "PT",
    };
    stylesApplied.push('fontSize');
  }
  if (foregroundColor) {
    textStyle.foregroundColor = {
      color: {
        rgbColor: foregroundColor,
      },
    };
    stylesApplied.push('foregroundColor');
  }

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: {
            startIndex,
            endIndex,
          },
          textStyle,
          fields: Object.keys(textStyle).join(","),
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:applyTextStyle', Date.now() - context.startTime);
  context.logger.info('Text style applied', { documentId, startIndex, endIndex, stylesApplied });

  return {
    documentId,
    startIndex,
    endIndex,
    stylesApplied,
    message: `Text style applied successfully from index ${startIndex} to ${endIndex}`,
  };
}
