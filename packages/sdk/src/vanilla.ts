/**
 * Vanilla JS mounting — the entire non-React integration:
 *
 *   <script src="https://cdn.soverity.xyz/sdk.js"></script>
 *   Soverity.mount("#signin", { scopes: ["openid"], onSuccess: console.log });
 */

import { SoverityButton } from "./button/SoverityButton";
import { mount as mountReact, unmount as unmountReact } from "./button/mount";

export interface MountOptions {
  scopes?: string[];
  onSuccess?: (result: unknown) => void;
  soverityOrigin?: string;
}

const DEFAULT_ORIGIN = "https://soverity.xyz";

/**
 * Full element-level fallback when React is unavailable: renders the same
 * four-state glass pill with plain DOM APIs.
 */
function mountVanilla(selector: string | HTMLElement, options: MountOptions) {
  const target = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!target) throw new Error(`Soverity: no element matches ${String(selector)}`);

  const root = document.createElement("div");
  root.className = "sv-btn-root";
  target.appendChild(root);

  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "sv-btn";
  pill.setAttribute("aria-label", "Sign in with Soverity");
  pill.innerHTML = `<span class="sv-btn-mark" aria-hidden="true">◇</span><span>Sign in with Soverity</span>`;
  root.appendChild(pill);

  const onSuccess = options.onSuccess;
  pill.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("soverity:signin", {
        detail: {
          scopes: options.scopes ?? ["openid"],
          acknowledge: (result: unknown) => onSuccess?.(result),
        },
      }),
    );
  });

  return { unmount: () => root.remove() };
}

export function mount(selector: string | HTMLElement, options: MountOptions = {}) {
  if (typeof window !== "undefined" && (window as any).React) {
    return mountReact(selector, options as any, (window as any).React, (window as any).ReactDOM);
  }
  return mountVanilla(selector, options);
}

export function unmount(instance: { unmount: () => void }) {
  instance.unmount();
}

export { SoverityButton };
