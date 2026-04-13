# Design System: High-End Editorial & Liquid Glass

## 1. Overview & Creative North Star: "The Digital Atelier"

This design system moves away from the rigid, boxed-in constraints of traditional mobile apps to embrace the fluid, sophisticated world of high-end fashion. Our Creative North Star is **The Digital Atelier**. 

We treat the screen not as a flat canvas, but as a layered composition of translucent silk, frosted glass, and premium paper. By utilizing intentional asymmetry, generous white space, and a "liquid" approach to motion and shape, we create an experience that feels curated rather than programmed. The goal is to make the user feel as though they are leafing through a bespoke lookbook, where the interface breathes and responds with organic grace.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule

Our palette is rooted in the tactile world of luxury fabrics. We use a sophisticated range of off-whites and charcoals, punctuated by gold and indigo to signify premium actions and status.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or tonal transitions. To separate a header from a body, transition from `surface` to `surface-container-low`.

### Surface Hierarchy & Nesting
Treat the UI as physical layers. Each inner container should use a slightly different tier to define importance:
- **Base Layer:** `surface` (#fafaf5) – The primary canvas.
- **Structural Sections:** `surface-container-low` (#f4f4ef) – For large background areas.
- **Interactive Elements:** `surface-container-lowest` (#ffffff) – To make cards "pop" against the background.
- **Elevated Modals:** `surface-bright` (#fafaf5) – For high-priority overlays.

### The "Glass & Gradient" Rule
Floating elements (Navigation bars, Action sheets) must utilize **Glassmorphism**. Use `surface` at 70% opacity with a `backdrop-filter: blur(20px)`. This allows the "liquid" colors of the fashion photography to bleed through the UI, softening the edges of the digital experience.

### Signature Textures
Main CTAs and Hero backgrounds should utilize a subtle linear gradient from `primary` (#000000) to `primary-container` (#1c1b1b). This adds "soul" and a sense of material depth that flat black cannot achieve.

---

## 3. Typography: Editorial Authority

We use a high-contrast typography scale to mimic the layout of a luxury fashion magazine.

*   **Display & Headlines (Newsreader/Playfair Display):** These are our "Style Statements." They should be large, assertive, and often used with tighter tracking to feel like a masthead. 
    *   *Role:* Evokes heritage, craftsmanship, and editorial authority.
*   **UI & Body Text (Inter):** Our "Utility." Inter provides the necessary clarity for styling tips and garment details.
    *   *Role:* Modernity, readability, and functional precision.

**The Hierarchy:**
- **Display-LG (3.5rem):** Use for "OOTD" or brand names.
- **Headline-MD (1.75rem):** Use for section titles like "Your Wardrobe."
- **Title-SM (1rem):** Use for garment names or button labels.
- **Label-SM (0.6875rem):** Use for metadata (e.g., "Last worn 3 days ago") in all-caps with increased letter spacing (0.05rem).

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too heavy for a "Liquid Softness" aesthetic. We achieve depth through light and transparency.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift.
- **Ambient Shadows:** For floating "Liquid" buttons, use a shadow with a 32px blur, 0px spread, and 6% opacity using a tint of `on-surface` (#1a1c19). It should feel like a soft glow, not a hard shadow.
- **The "Ghost Border" Fallback:** If a container sits on an identical color and needs definition, use `outline-variant` (#c4c7c7) at **15% opacity**. 
- **Glassmorphism:** Use `backdrop-blur` (12px to 24px) combined with a thin, 10% white inner-glow (stroke) to simulate the edge of a glass pane.

---

## 5. Components: Liquid & Organic

### Buttons (Liquid-Inspired)
- **Primary:** `primary` background with `on-primary` text. Corners should be `xl` (3rem) to create a pill shape. On press, the button should subtly "swell" (scale 1.02) rather than just changing color.
- **Tertiary:** No background. Use `primary` text with a subtle `primary-fixed-dim` underline that expands on hover/active states.

### Soft Glass Cards
- **Construction:** Use `surface-container-lowest` at 80% opacity with a `backdrop-filter: blur(10px)`. 
- **Rounding:** Use `lg` (2rem) for main feed cards; `md` (1.5rem) for nested items.
- **Spacing:** Forbid divider lines. Use a `2rem` vertical gap between cards to let the layout breathe.

### Input Fields
- **Style:** Underline-only style using `outline-variant` at 40% opacity. When active, the underline transitions to `secondary` (Gold - #775a19) with a smooth 300ms ease.

### Context-Specific: The "Outfit Flow" Chip
- For styling suggestions, use selection chips with `secondary-fixed` (#ffdea5) backgrounds and `on-secondary-fixed` text. Shape must be `full` (pill).

---

## 6. Do’s and Don’ts

### Do:
- **Do** use asymmetrical margins. A photo might be flush to the left edge while the text is indented 15% from the right.
- **Do** use "Liquid" transitions. Elements should slide and fade with `cubic-bezier(0.23, 1, 0.32, 1)` (Ease Out Quint).
- **Do** prioritize high-quality imagery. The UI is the frame; the clothes are the art.

### Don’t:
- **Don’t** use 100% black text on pure white. Use `on-surface` on `surface` for a softer, premium contrast.
- **Don’t** use hard 90-degree corners. Everything must feel "eroded" and soft to the touch.
- **Don’t** crowd the screen. If you feel like you need a divider line, you actually need more white space.
- **Don’t** use standard "Material" blue for links. Use `secondary` (Gold) or `tertiary-fixed-variant` (Indigo) to maintain the luxury palette.