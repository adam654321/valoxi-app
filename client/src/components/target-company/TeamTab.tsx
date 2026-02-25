import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Plus, Edit, Trash2, Mail, Phone } from "lucide-react";
import type { TargetContact } from "@shared/schema";

interface TeamTabProps {
  companyName: string;
  totalContacts: number;
  contacts: TargetContact[];
  primaryContact: TargetContact | undefined;
  otherContacts: TargetContact[];
  onAddContact: () => void;
  onEditContact: (contact: TargetContact) => void;
  onDeleteContact: (contactId: number) => void;
}

export function TeamTab({
  companyName,
  totalContacts,
  contacts,
  primaryContact,
  otherContacts,
  onAddContact,
  onEditContact,
  onDeleteContact,
}: TeamTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Contact Directory</CardTitle>
        <CardDescription>
          Key people at {companyName} ({totalContacts} contacts)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No contacts added yet</p>
            <p className="text-sm mb-4">Add contacts to track key people at this company</p>
            <Button onClick={onAddContact} data-testid="button-add-first-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add First Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Contact Highlight */}
            {primaryContact && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/60 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">Primary Contact</h3>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xl font-bold" data-testid="primary-contact-name">
                        {primaryContact.firstName} {primaryContact.lastName}
                      </h4>
                      {primaryContact.title && (
                        <p className="text-muted-foreground font-medium" data-testid="primary-contact-title">
                          {primaryContact.title}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      {primaryContact.email && (
                        <a 
                          href={`mailto:${primaryContact.email}`} 
                          className="flex items-center gap-2 text-blue-600 hover:underline"
                          data-testid="primary-contact-email"
                        >
                          <Mail className="w-4 h-4" />
                          {primaryContact.email}
                        </a>
                      )}
                      {primaryContact.phone && (
                        <a 
                          href={`tel:${primaryContact.phone}`} 
                          className="flex items-center gap-2 text-blue-600 hover:underline"
                          data-testid="primary-contact-phone"
                        >
                          <Phone className="w-4 h-4" />
                          {primaryContact.phone}
                        </a>
                      )}
                    </div>
                    
                    {primaryContact.notes && (
                      <p className="text-sm text-muted-foreground bg-card p-3 rounded border" data-testid="primary-contact-notes">
                        {primaryContact.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 lg:flex-col">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditContact(primaryContact)}
                      data-testid="button-edit-primary-contact"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Other Contacts */}
            {otherContacts.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-4">Other Contacts</h3>
                <div className="grid gap-4">
                  {otherContacts.map((contact) => (
                    <Card key={contact.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold" data-testid={`contact-name-${contact.id}`}>
                                {contact.firstName} {contact.lastName}
                              </h4>
                            </div>
                            
                            {contact.title && (
                              <p className="text-sm text-muted-foreground mb-2" data-testid={`contact-title-${contact.id}`}>
                                {contact.title}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-3 text-sm">
                              {contact.email && (
                                <a 
                                  href={`mailto:${contact.email}`} 
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                  data-testid={`contact-email-${contact.id}`}
                                >
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </a>
                              )}
                              {contact.phone && (
                                <a 
                                  href={`tel:${contact.phone}`} 
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                  data-testid={`contact-phone-${contact.id}`}
                                >
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </a>
                              )}
                            </div>
                            
                            {contact.notes && (
                              <p className="text-sm text-muted-foreground mt-2" data-testid={`contact-notes-${contact.id}`}>
                                {contact.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditContact(contact)}
                              data-testid={`button-edit-contact-${contact.id}`}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDeleteContact(contact.id)}
                              data-testid={`button-delete-contact-${contact.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
