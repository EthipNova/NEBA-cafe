import { createFileRoute } from "@tanstack/react-router";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { getCategory } from "@/lib/menu-data";

export const Route = createFileRoute("/menu/$category")({
  head: ({ params }) => {
    const category = getCategory(params.category);
    const title = category ? `${category.name} — NEBA Café Menu` : "Menu — NEBA Café";
    const description = category
      ? `${category.name}: ${category.tagline}. Order online from NEBA Café.`
      : "Browse the NEBA Café menu.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  return <MenuBrowser activeCategory={category} />;
}
