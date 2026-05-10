import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Rocket,
  LayoutDashboard,
  Kanban,
  Building2,
  Shield,
  Link2,
  Users,
  CreditCard,
  ArrowRight,
  BookOpen,
  FileText,
} from "lucide-react";
import { categories, articles, searchArticles } from "@/data/helpContent";

const iconMap: Record<string, React.ElementType> = {
  Rocket,
  LayoutDashboard,
  Kanban,
  Building2,
  Shield,
  Link: Link2,
  Users,
  CreditCard,
};

export default function HelpHome() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const popularArticles = articles.slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/help/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const quickResults =
    searchQuery.length >= 2 ? searchArticles(searchQuery).slice(0, 4) : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#e85d04]/15 mb-6">
          <BookOpen className="w-8 h-8 text-[#e85d04]" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-3">
          How can we help?
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Search the knowledge base for answers about Valoxi features, workflows,
          and best practices.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for topics, features, or questions..."
            className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e85d04]/50 focus:ring-1 focus:ring-[#e85d04]/20 transition-all"
          />
        </div>

        {/* Quick search dropdown */}
        {quickResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50">
            {quickResults.map((result) => (
              <Link
                key={result.id}
                href={`/help/article/${result.slug}`}
                onClick={() => setSearchQuery("")}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <FileText className="w-4 h-4 text-[#e85d04] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground font-medium">
                    {result.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.category}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </form>

      {/* Category cards */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Browse by Category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] || BookOpen;
            const count = articles.filter((a) => a.categoryId === cat.id).length;
            return (
              <Link
                key={cat.id}
                href={`/help/search?category=${cat.id}`}
                className="group bg-card border border-border rounded-xl p-5 hover:border-[#e85d04]/30 hover:bg-muted/50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#e85d04]/10 flex items-center justify-center mb-4 group-hover:bg-[#e85d04]/20 transition-colors">
                  <Icon className="w-5 h-5 text-[#e85d04]" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {cat.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {cat.description}
                </p>
                <div className="flex items-center gap-1 text-xs text-[#e85d04]">
                  <span>{count} articles</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Popular articles */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Popular Articles
        </h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {popularArticles.map((article) => (
            <Link
              key={article.id}
              href={`/help/article/${article.slug}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-[#e85d04]/10 transition-colors">
                <FileText className="w-4 h-4 text-muted-foreground group-hover:text-[#e85d04] transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground">
                  {article.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {article.excerpt}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                {article.category}
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#e85d04] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
