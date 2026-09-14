import { createFileRoute } from "@tanstack/react-router";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { fetchCategories, fetchProducts } from "@/services/api";

export const Route = createFileRoute("/menu/$category")({
  loader: async () => {
    const [categories, products] = await Promise.all([
      fetchCategories().catch(() => []),
      fetchProducts().catch(() => []),
    ]);
    return { categories, products };
  },
  head: ({ params, loaderData }) => {
    const category = loaderData?.categories.find((c) => c.slug === params.category);
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
  const { categories, products } = Route.useLoaderData();
  return (
    <MenuBrowser
      activeCategory={category}
      initialCategories={categories}
      initialProducts={products}
    />
  );
}
