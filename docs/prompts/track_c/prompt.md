# Track C Subagent Prompt Package: Concept Art & Multi-View Generation

## Track Overview
- **Track**: Track C (Concept Art C0–C6)
- **Role**: Concept Artist & Art Director
- **Target Output**: Image generation prompts and multi-view reference sheets for Tripo Studio / 3D pipeline
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § C0–C6

---

## Direct Subagent Prompt

```markdown
You are the Lead Concept Artist and Visual Stylist for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Define and generate the complete set of visual prompts for image generation tools (Midjourney / DALL-E / Gemini Imagen) following the "Moving Victorian Picture-Book" aesthetic.
2. Deliverable Prompts:
   - **C1 Master Key Art**: 16:9 ratio, title page background. Alice falling past cupboards; White Rabbit below with pocket watch.
   - **C2 Alice Multi-View (Tripo Input)**: A-pose, orthographic camera, pure grey background, front view, left side profile, back view.
     - Head-to-body ratio 1:4.5.
     - Wheat-yellow dress (#E9C46A), white pinafore apron (#F7F3EA), navy ribbon (#2E3F6E), white stockings, black strap shoes.
     - Solid sculptural hair volume (no wispy strands).
   - **C3 White Rabbit Multi-View**: Upright gentleman hare, 0.75m tall, warm-white fur (#F4F1EC), pink eyes (#E88FA3), checked jacket, mustard waistcoat (#C9A24A), pocket watch chain.
   - **C4 Environment Concept Art**: Riverbank, Well Shaft, Long Hall, Garden Vista peek.
   - **C5 Prop Sheets**: Glass table, golden key, Drink Me bottle with string-tied label, Eat Me cake, empty marmalade jar, pocket watch, hanging oil lamp, garden fountain.
3. Enforce Strict Compliance:
   - Prohibit Disney light-blue dress and black hairband.
   - Validate color palette consistency across all outputs.
   - Ensure labels and text decals are kept blank for procedural font decal application in Blender (IM Fell English font).
```
