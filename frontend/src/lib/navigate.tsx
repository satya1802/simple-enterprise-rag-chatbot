import { useNavigate as useRouterNavigate } from "react-router-dom";

/**
 * `navigate(route)` in the preview posted a message to the host. Here it is
 * real routing, so the route slug the screen was written against has to
 * become the router path the scaffold mounted it at. This mirrors
 * `route_to_url_path` on the Python side; the two must agree or a link goes
 * nowhere.
 *
 * NOTE: this hook used to be defined twice -- once here and once, with a
 * simpler (and behaviourally weaker: no slug normalisation) implementation,
 * in `navigate.ts` beside it. A bundler resolves the bare specifier
 * `@/lib/navigate` to exactly one of `navigate.ts`/`navigate.tsx` depending
 * on its extension-resolution order, which silently made whichever file it
 * did *not* pick dead code -- and left the two free to drift out of sync.
 * Both files now carry this same implementation so it no longer matters
 * which one actually gets resolved.
 */
export function toPath(route: string): string {
  const trimmed = route.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "/";
  return (
    "/" +
    trimmed
      .split("/")
      .map((segment) =>
        segment.startsWith(":")
          ? segment
          : segment.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      )
      .join("/")
  );
}

export function useNavigate(): (route: string) => void {
  const navigate = useRouterNavigate();
  return (route: string) => navigate(toPath(route));
}
