import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, Phone, User, Building, Eye, UserPlus } from "lucide-react";
import type { TargetContact, TargetCompany } from "@shared/schema";

// Extended contact type that includes company information
interface ContactWithCompany extends TargetContact {
  company: {
    id: number;
    companyName: string;
    industry?: string;
  };
}

export default function Contacts() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Get all contacts across all target companies
  const { data: allContacts = [], isLoading } = useQuery<ContactWithCompany[]>({
    queryKey: ["/api/contacts/all"],
    enabled: !!user,
  });

  // Filter contacts based on search term
  const filteredContacts = allContacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(searchLower) ||
      contact.lastName.toLowerCase().includes(searchLower) ||
      (contact.title && contact.title.toLowerCase().includes(searchLower)) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      contact.company.companyName.toLowerCase().includes(searchLower)
    );
  });

  // Separate primary and other contacts
  const primaryContacts = filteredContacts.filter(c => c.isPrimary);
  const otherContacts = filteredContacts.filter(c => !c.isPrimary);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
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
                  <Link href="/target-companies" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                    Target Companies
                  </Link>
                  <Link href="/contacts" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                    Contacts
                  </Link>
                  <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                    Reports
                  </a>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/target-companies">
                  <Button className="bg-primary text-white hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Target Company
                  </Button>
                </Link>
                <div className="relative">
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 text-textSecondary hover:text-textPrimary"
                    onClick={handleLogout}
                  >
                    {user && (
                      <span className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    )}
                    <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Loading Content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="grid gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
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
                <Link href="/target-companies" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Target Companies
                </Link>
                <Link href="/contacts" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                  Contacts
                </Link>
                <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Reports
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/target-companies">
                <Button className="bg-primary text-white hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Target Company
                </Button>
              </Link>
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-textSecondary hover:text-textPrimary"
                  onClick={handleLogout}
                >
                  {user && (
                    <span className="text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                  )}
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Contacts</h1>
              <p className="mt-2 text-gray-600">
                Manage contacts across all your target companies
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contacts and companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contacts List */}
          {filteredContacts.length === 0 && !searchTerm && (
            <Card>
              <CardContent className="p-12 text-center">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
                <p className="text-gray-600 mb-4">
                  Start by adding target companies, then add contacts to them.
                </p>
                <Link href="/target-companies">
                  <Button>
                    <Building className="w-4 h-4 mr-2" />
                    View Target Companies
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {filteredContacts.length === 0 && searchTerm && (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="w-8 h-8 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or check a different spelling.
                </p>
              </CardContent>
            </Card>
          )}

          {filteredContacts.length > 0 && (
            <div className="space-y-6">
              {/* Primary Contacts */}
              {primaryContacts.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                    Primary Contacts
                  </h2>
                  <div className="grid gap-4">
                    {primaryContacts.map((contact) => (
                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {contact.firstName} {contact.lastName}
                                  </h3>
                                  <Badge variant="default">Primary</Badge>
                                </div>
                                {contact.title && (
                                  <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <Link 
                                      href={`/target-companies/${contact.company.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {contact.company.companyName}
                                    </Link>
                                  </div>
                                  {contact.company.industry && (
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.company.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {contact.email && (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </a>
                                  )}
                                  {contact.phone && (
                                    <span className="text-gray-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Link href={`/target-companies/${contact.company.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-3 h-3 mr-1" />
                                View Company
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Contacts */}
              {otherContacts.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    Other Contacts
                  </h2>
                  <div className="grid gap-4">
                    {otherContacts.map((contact) => (
                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-gray-600" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {contact.firstName} {contact.lastName}
                                </h3>
                                {contact.title && (
                                  <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <Link 
                                      href={`/target-companies/${contact.company.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {contact.company.companyName}
                                    </Link>
                                  </div>
                                  {contact.company.industry && (
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.company.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {contact.email && (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </a>
                                  )}
                                  {contact.phone && (
                                    <span className="text-gray-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Link href={`/target-companies/${contact.company.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-3 h-3 mr-1" />
                                View Company
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}