# Lead Desk Visual System

## Direction

Leadscale is a premium editorial lead desk: composed, tactile, and quietly decisive, like a well-kept property journal rather than an analytics console. Fraunces headlines bring a warm editorial voice; DM Sans keeps controls, body copy, and data crisp at working speed. The page gives the highest-priority lead room to breathe, then keeps the remaining ranked rows compact and comparable. Warm paper, ink, and a single oxidized-copper accent establish the base; priority is also encoded with distinct marks and explicit labels. Motion is limited to a short list entrance and restrained hover/focus transitions, and is removed when reduced motion is requested. At 375px the feature leads into a single-column list; at 768px the same stacked order remains; at 1280px the featured lead and ranked queue sit side by side.

## Type

- Display and headings: Fraunces, loaded with `next/font/google`; its high-contrast, soft-edged forms give the desk its editorial character.
- UI and body: DM Sans, loaded with `next/font/google`; its open forms stay legible in dense rows and compact controls.
- Scale: display 44px, heading 30px, section 20px, body 15px, label 12px. Scores use the section size with tabular numerals.

## Color

- Paper `#F5F2EB`, raised paper `#FFFEFA`, ink `#202923`, muted ink `#59625A`, and line `#DCD8CF`.
- Primary accent: oxidized copper `#8A452D`; interactive text and borders use higher-contrast ink/copper treatments.
- Priority treatments: LOW slate-green `#E5EAE4` / `#34473A` with a circle; MEDIUM ochre `#F2E8D3` / `#5A431B` with a diamond; HIGH clay `#F1DED1` / `#713D21` with a triangle; URGENT rose `#F0D9D7` / `#762B26` with a double diamond. Every mark includes a visible text label and accessible name.
- Text colors are chosen for at least 4.5:1 contrast on their paired surfaces; large display text exceeds 3:1. Priority color is never the only signal.

## Layout Tokens

- Space: 4, 8, 12, 16, 24, 32, 48, 64px.
- Radius: 4px controls and chips; 8px framed panels.
- Border: 1px solid `#DCD8CF`; strong dividers use `#C9C3B7`.
- Shadow: `0 12px 32px rgb(32 41 35 / 8%)`, reserved for the open lead detail surface.
