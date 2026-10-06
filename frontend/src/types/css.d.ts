// Ambient type augmentation, not application code.
//
// The brand system (see src/lib/brand.ts) is applied through CSS custom
// properties -- `--brand-primary`, `--tw-ring-color` and friends -- set
// inline via the `style` prop, which is how a brand change repaints without
// recompiling a screen. `@types/react`'s `CSSProperties` only lists known
// CSS properties, so passing a custom property is a type error everywhere
// the pattern is used unless the ambient type allows it. This is the one
// place that has to change for every screen's inline brand styling to
// typecheck; the screens themselves are unmodified.
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
