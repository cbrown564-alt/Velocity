
import type { OrderedScoring, OrderedStyle } from '../types';

// Common ordinal scale keywords for detecting Likert-type scales.
const ORDINAL_PATTERNS = {
    agreement: ['strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree'],
    satisfaction: ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
    frequency: ['never', 'rarely', 'sometimes', 'often', 'always'],
    likelihood: ['very unlikely', 'unlikely', 'neutral', 'likely', 'very likely'],
    quality: ['very poor', 'poor', 'fair', 'good', 'excellent'],
    importance: ['not important', 'somewhat important', 'important', 'very important'],
    amount: ['none', 'a little', 'some', 'a lot', 'a great deal'],
};

// Comparative/ordering words that suggest ordinal scale
const ORDINAL_KEYWORDS = ['more', 'less', 'better', 'worse', 'higher', 'lower', 'most', 'least', 'very', 'extremely', 'somewhat', 'slightly', 'moderate', 'average'];

/**
 * Infer the variable type based on value labels and patterns.
 * Distinguishes between:
 * - categorical: Unordered categories
 * - ordered: Ordered categories
 */
export interface InferredVariableTyping {
    type: 'categorical' | 'ordered';
    orderedStyle?: OrderedStyle;
    orderedScoring?: OrderedScoring;
}

export function inferVariableTyping(valueLabels: { value: number; label: string }[]): InferredVariableTyping {
    if (!valueLabels || valueLabels.length < 2) return { type: 'categorical' };

    // Normalize labels
    const labels = valueLabels.map(vl => vl.label.toLowerCase().trim());

    // 1. Check for specific Scale/Likert patterns
    // ------------------------------------------

    // Pattern A: Likert Agreement/Satisfaction/etc.
    for (const pattern of Object.values(ORDINAL_PATTERNS)) {
        let matchCount = 0;
        for (const label of labels) {
            if (pattern.some(p => label.includes(p) || p.includes(label))) {
                matchCount++;
            }
        }
        // If we match enough standard Likert terms, it's a Scale
        if (matchCount >= 2) return { type: 'ordered', orderedStyle: 'rating', orderedScoring: 'allow_numeric_stats' };
    }

    // Pattern B: Ordinal Keywords that suggest intensity/rating (Scale)
    // words like "very", "somewhat", "highly", "low", "high"
    let intensityMatches = 0;
    for (const label of labels) {
        if (ORDINAL_KEYWORDS.some(kw => label.includes(kw))) {
            intensityMatches++;
        }
    }
    if (intensityMatches >= 2) return { type: 'ordered', orderedStyle: 'rating', orderedScoring: 'allow_numeric_stats' };

    // Pattern C: Numeric Labels (e.g. 1="1", 2="2", or 1="1 - Low")
    // If the label *is* the number, or starts with the number, it's likely a Scale
    const numericLabelCount = valueLabels.filter(vl => {
        // Label implies the value (e.g. label "5" for value 5)
        if (vl.label.trim() === vl.value.toString()) return true;

        // Label starts with number (e.g. "1 - Not at all")
        return /^\d+(\.\d+)?\s*[-–—:]?/.test(vl.label);
    }).length;

    // If most labels are numeric-ish, it's a Scale
    if (numericLabelCount === valueLabels.length) return { type: 'ordered', orderedStyle: 'rating', orderedScoring: 'allow_numeric_stats' };

    // Mixed numeric/text: often checking if endpoints are labeled (1="Low", 10="High") and others are missing/numeric
    const hasPureNumericLabels = valueLabels.some(vl => vl.label.trim() === vl.value.toString());
    if (hasPureNumericLabels && valueLabels.length >= 3) return { type: 'ordered', orderedStyle: 'rating', orderedScoring: 'allow_numeric_stats' };

    // 2. Check for Ordinal (Ordered Categories)
    // ------------------------------------------

    // Sequential integers check (Likert-like structure but with text labels)
    if (valueLabels.length >= 2 && valueLabels.length <= 15) {
        const values = valueLabels.map(vl => vl.value).sort((a, b) => a - b);
        const isSequential = values.every((v, i) => i === 0 || v - values[i - 1] === 1);

        if (isSequential) {
            // It has Sequential Values. 
            // If labels are things like "Primary", "Secondary", "Tertiary" -> Ordinal
            // If labels are "Never", "Rarely" -> Scale (caught by Likert patterns usually)

            // Default sequential categoricals to Ordinal if they weren't caught as Scales
            return { type: 'ordered', orderedStyle: 'sequence', orderedScoring: 'categorical_only' };
        }
    }

    // Default to Nominal if no order/scale detected
    return { type: 'categorical' };
}

export function inferVariableType(valueLabels: { value: number; label: string }[]): InferredVariableTyping['type'] {
    return inferVariableTyping(valueLabels).type;
}
