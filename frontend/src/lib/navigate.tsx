/**
 * Thin wrapper over react-router's `useNavigate`.
 *
 * Every generated screen calls `navigate("chat")`, `navigate("documents")`,
 * etc. -- the bare route name, no leading slash -- which is the spelling the
 * Builder prompt gives screens for in-app navigation. `App.tsx` mounts each
 * screen at `/<route>`, so this hook only has to add the slash the screens
 * never bothered to type and hand the rest straight to react-router.
 *
 * This file is the one piece of scaffolding every screen imports
 * (`@/lib/navigate`) that the template did not generate alongside
 * `@/lib/ui`, `@/lib/icons` and `@/lib/brand` -- without it nothing compiles.
 */
import { useNavigate as useRouterNavigate } from "react-router-dom";

export function useNavigate() {
  const routerNavigate = useRouterNavigate();
  return (to: string) => {
    const path = to.startsWith("/") ? to : `/${to}`;
    routerNavigate(path);
  };
}
