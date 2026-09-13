import { createFileRoute } from "@tanstack/react-router";
import { MenuBrowser } from "@/components/site/MenuBrowser";

export const Route = createFileRoute("/menu/")({
  head: () => ({
    meta: [
      { title: "Menu — NEBA Café" },
      {
        name: "description",
        content:
          "Browse the full NEBA Café menu: burgers, pizza, chips & sides and soft drinks with live availability and prices in ETB.",
      },
      { property: "og:title", content: "Menu — NEBA Café" },
      { property: "og:description", content: "Burgers, pizza, sides and drinks, freshly prepared." },
    ],
  }),
  component: () => <MenuBrowser />,
});
