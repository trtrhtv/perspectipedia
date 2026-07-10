// JSON Schema של הפלט מ-Claude.
// זהו המימוש הטכני של "מבחן הביסוס": grounding ו-epistemic_type הם שדות חובה,
// כך שהמודל *חייב* לספק ביסוס לכל עדשה — הוא לא יכול לדלג על זה.

export const ENTRY_JSON_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string", description: "הנושא" },
    // מנגנון סירוב — למודל חייבת להיות "לא" חוקית. בלי זה הסכמה מכריחה אותו לייצר.
    refused: {
      type: "boolean",
      description:
        "true אם הנושא מחוץ לתחום המוצר: הסתה/שנאה, ערך על אדם פרטי חי, או תוכן מזיק אופרטיבית. אחרת false.",
    },
    refusal_reason: {
      type: "string",
      description: "אם refused=true — הסבר קצר ומכובד למשתמש למה הנושא אינו מתאים.",
    },
    topic_kind: {
      type: "string",
      enum: ["meaning", "mixed", "empirical"],
      description:
        "meaning=שאלת משמעות/נרטיב; empirical=נושא עובדתי-מדיד; mixed=יש בו את שניהם",
    },
    lenses: {
      type: "array",
      description: "2 עד 5 עדשות מבוססות ורלוונטיות לנושא הזה",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "שם העדשה, למשל 'יהדות דתית' או 'מדע'",
          },
          family: {
            type: "string",
            enum: [
              "religious",
              "scientific",
              "philosophical",
              "political",
              "cultural",
              "historical",
            ],
          },
          summary: {
            type: "string",
            description: "תמצית של 1-2 משפטים: איך העולם הזה מבין את הנושא",
          },
          body: {
            type: "string",
            description:
              "גוף הערך מהעדשה הזו: כמה פסקאות, בטון גוף-ראשון של אותו עולם-תוכן, בכבוד",
          },
          grounding: {
            type: "array",
            description:
              "על מה זה מבוסס — מקורות/אסכולות/ראיות אמיתיים וספציפיים (חובה)",
            items: {
              type: "object",
              properties: {
                source: {
                  type: "string",
                  description: "המקור: פסוק, טקסט, אסכולה, מחקר, הוגה",
                },
                explanation: {
                  type: "string",
                  description: "הסבר קצר איך המקור מבסס את העמדה",
                },
              },
              required: ["source", "explanation"],
              additionalProperties: false,
            },
          },
          epistemic_type: {
            type: "string",
            enum: [
              "meaning-narrative",
              "value-position",
              "empirical-grounded",
              "methodological-critique",
            ],
          },
          confidence: {
            type: "string",
            description:
              "סייג אופציונלי, למשל 'הצגה כללית של הזרם; יש בו מחלוקות פנימיות'",
          },
        },
        required: ["name", "family", "summary", "body", "grounding", "epistemic_type"],
        additionalProperties: false,
      },
    },
  },
  required: ["topic", "topic_kind", "refused", "lenses"],
  additionalProperties: false,
} as const;

// סכמת הפלט של מבקר הסימטריה (ראו docs/BIAS_STRATEGY.md §3).
export const AUDIT_JSON_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      description: "ציון 1-5 לכל ממד (5 = סימטרי לחלוטין)",
      properties: {
        charity: { type: "integer" },
        depth: { type: "integer" },
        language: { type: "integer" },
        missing: { type: "integer" },
        grounding_strength: { type: "integer" },
        meta_framing: { type: "integer" },
      },
      required: [
        "charity",
        "depth",
        "language",
        "missing",
        "grounding_strength",
        "meta_framing",
      ],
      additionalProperties: false,
    },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string" },
          severity: { type: "string", enum: ["minor", "major"] },
          lens: { type: "string" },
          evidence: { type: "string", description: "ציטוט מדויק מהערך" },
          fix_instruction: { type: "string" },
        },
        required: ["dimension", "severity", "lens", "evidence", "fix_instruction"],
        additionalProperties: false,
      },
    },
    missing_lenses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          why_grounded: { type: "string" },
        },
        required: ["name", "why_grounded"],
        additionalProperties: false,
      },
    },
    verdict: { type: "string", enum: ["pass", "revise", "fail"] },
  },
  required: ["scores", "flags", "verdict"],
  additionalProperties: false,
} as const;
