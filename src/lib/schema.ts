// JSON Schema של הפלט מ-Claude.
// זהו המימוש הטכני של "מבחן הביסוס": grounding ו-epistemic_type הם שדות חובה,
// כך שהמודל *חייב* לספק ביסוס לכל עדשה — הוא לא יכול לדלג על זה.

export const ENTRY_JSON_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string", description: "הנושא" },
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
  required: ["topic", "topic_kind", "lenses"],
  additionalProperties: false,
} as const;
