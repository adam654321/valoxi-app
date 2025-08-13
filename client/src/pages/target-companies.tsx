import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function TargetCompanies() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-semibold text-textPrimary">M&A Pipeline</span>
              </div>
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link href="/dashboard" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/target-companies" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                  Target Companies
                </Link>
                <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Contacts
                </a>
                <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Reports
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button className="bg-primary text-white hover:bg-blue-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Target Company
              </Button>
              <div className="relative">
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-textPrimary">Target Companies</h1>
          <p className="mt-1 text-textSecondary">
            Manage businesses you're interested in acquiring
          </p>
        </div>

        {/* Coming Soon Message */}
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Target Company Management</h3>
              <p className="mt-1 text-sm text-gray-500">
                This feature will be available in the next development phase.
                <br />
                You'll be able to add, track, and manage potential acquisition targets.
              </p>
              <div className="mt-6">
                <Link href="/dashboard">
                  <Button variant="outline">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}