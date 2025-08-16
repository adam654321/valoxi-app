import { useParams } from 'wouter';
import { EnhancedPortalDisplay } from '@/components/enhanced-portal-display';

export default function PortalPage() {
  const { token } = useParams();

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Portal Link</h1>
          <p className="text-gray-600">The portal link appears to be invalid or incomplete.</p>
        </div>
      </div>
    );
  }

  return <EnhancedPortalDisplay token={token} />;
}