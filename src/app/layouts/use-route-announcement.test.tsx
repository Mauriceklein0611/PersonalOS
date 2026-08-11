import { render, screen } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { useRouteAnnouncement } from "./use-route-announcement";

function Layout() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteAnnouncement(mainRef, false);

  return (
    <main ref={mainRef} tabIndex={-1}>
      <Outlet />
    </main>
  );
}

/**
 * Eine Seite, deren Überschrift erst nach dem Navigationsende im DOM steht.
 * Genau das tun die echten Seiten: Sie laden ihre Daten selbst, und wann ihre
 * `h1` erscheint, hängt daran und nicht am Router.
 */
function LateHeading({ children }: { children: string }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return isReady ? <h1>{children}</h1> : <p>Wird geladen …</p>;
}

function renderRoutes(path: string) {
  const router = createMemoryRouter(
    [
      {
        children: [
          { element: <h1>Heute</h1>, index: true },
          {
            element: <LateHeading>Aufgaben</LateHeading>,
            path: "aufgaben",
          },
        ],
        element: <Layout />,
        path: "/",
      },
    ],
    { initialEntries: [path] },
  );

  return { ...render(<RouterProvider router={router} />), router };
}

describe("useRouteAnnouncement", () => {
  afterEach(() => {
    document.title = "";
  });

  it("names the rendered heading in the title", async () => {
    renderRoutes("/");

    await screen.findByRole("heading", { level: 1, name: "Heute" });
    expect(document.title).toBe("Heute – PersonalOS");
  });

  /*
   * Der Fehler aus #144: Der Titel wurde einmal am Ende der Navigation
   * gelesen. Baut die Seite ihre Überschrift erst danach auf, blieb der alte
   * Titel stehen — und wurde nie korrigiert, weil der Effekt nicht erneut lief.
   */
  it("follows a heading that appears after the navigation has finished", async () => {
    const { router } = renderRoutes("/");

    await screen.findByRole("heading", { level: 1, name: "Heute" });
    await router.navigate("/aufgaben");

    await screen.findByRole("heading", { level: 1, name: "Aufgaben" });
    expect(document.title).toBe("Aufgaben – PersonalOS");
  });

  it("moves the focus into the content area on a navigation", async () => {
    const { router } = renderRoutes("/");

    await screen.findByRole("heading", { level: 1, name: "Heute" });
    expect(screen.getByRole("main")).not.toHaveFocus();

    await router.navigate("/aufgaben");
    await screen.findByRole("heading", { level: 1, name: "Aufgaben" });

    expect(screen.getByRole("main")).toHaveFocus();
  });
});
