import { useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { searchArticles, articles, categories } from "@/data/helpContent";
import { Search, FileText, ArrowRight, X } from "lucide-react";

export default function HelpSearch() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const query = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";

  const updateParams = (next: URLSearchParams) => {
    const qs = next.toString();
    setLocation(qs ? `/help/search?${qs}` : "/help/search");
  };

  const results = useMemo(() => {
    let filtered = query ? searchArticles(query) : articles;
    if (categoryFilter) {
      filtered = filtered.filter((a) => a.categoryId === categoryFilter);
    }
    return filtered;
  }, [query, categoryFilter]);

  const activeCategory = categories.find((c) => c.id === categoryFilter);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Search header */}
      <div className="mb-8">
        {query && (
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Results for "{query}"
          </h1>
        )}
        {activeCategory && !query && (
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {activeCategory.title}
          </h1>
        )}
        <p className="text-muted-foreground">
          {results.length} {results.length === 1 ? "article" : "articles"} found
          {activeCategory && ` in ${activeCategory.title}`}
        </p>

        {/* Active filters */}
        {(query || categoryFilter) && (
          <div className="flex items-center gap-2 mt-4">
            {query && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#e85d04]/15 text-[#e85d04] text-xs rounded-full">
                Search: {query}
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("q");
                    updateParams(next);
                  }}
                  className="hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-muted text-foreground text-xs rounded-full">
                Category: {activeCategory?.title}
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("category");
                    updateParams(next);
                  }}
                  className="hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results list */}
      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((article) => (
            <Link
              key={article.id}
              href={`/help/article/${article.slug}`}
              className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-[#e85d04]/30 hover:bg-muted/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-[#e85d04]/10 transition-colors">
                <FileText className="w-5 h-5 text-muted-foreground group-hover:text-[#e85d04] transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-medium text-foreground">
                    {article.title}
                  </h3>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {article.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {article.excerpt}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#e85d04] transition-colors shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">
            No results found
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Try adjusting your search terms, or browse categories from the Help
            home page to find what you need.
          </p>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 mt-4 text-sm text-[#e85d04] hover:underline"
          >
            Back to Help Center
          </Link>
        </div>
      )}
    </div>
  );
}
