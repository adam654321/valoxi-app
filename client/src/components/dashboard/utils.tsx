import {
  Activity,
  Phone,
  Mail,
  Users2,
  FileText,
  Calendar,
  Search,
} from "lucide-react";

export const getActivityIcon = (type: string) => {
  switch (type) {
    case 'Phone Call': return <Phone className="w-4 h-4" />;
    case 'Email': return <Mail className="w-4 h-4" />;
    case 'Meeting': return <Users2 className="w-4 h-4" />;
    case 'Note': return <FileText className="w-4 h-4" />;
    case 'Follow-up': return <Calendar className="w-4 h-4" />;
    case 'Research': return <Search className="w-4 h-4" />;
    case 'Document': return <FileText className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
};
